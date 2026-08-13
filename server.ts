/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

interface RoomPlayer {
  id: string;
  name: string;
  surname?: string;
  color: string;
  isCreator: boolean;
  appVersion?: string;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  gameState: any; // Complete board state sync
  isTeamUpMode?: boolean;
  isHomeEntryLockEnabled?: boolean;
  isTokenBlockEnabled?: boolean;
  updatedAt: number;
  version: number;
}

const activeRooms: Record<string, Room> = {};

// Clean up idle rooms older than 2 hours periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(activeRooms).forEach((code) => {
    if (now - activeRooms[code].updatedAt > 2 * 60 * 60 * 1000) {
      delete activeRooms[code];
    }
  });
}, 30 * 60 * 1000);

// WebSocket Client Metadata interface
interface ClientMeta {
  ws: WebSocket;
  roomCode: string;
  playerId: string;
  playerName?: string;
  playerColor?: string;
}

const connectedClients = new Map<WebSocket, ClientMeta>();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // --- CORS MIDDLEWARE (Required for Render and external app connections) ---
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json());

  // --- API ENDPOINTS ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeRoomsCount: Object.keys(activeRooms).length,
      connectedWsClients: connectedClients.size,
    });
  });

  // Get latest App Version and upgrade links
  app.get('/api/app-version', (req, res) => {
    res.json({
      latestVersion: '1.0.0',
      minRequiredVersion: '1.0.0',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.gamers.ludo',
      appStoreUrl: 'https://apps.apple.com/app/ludo-battle-king/id1234567890',
    });
  });

  // Create room
  app.post('/api/rooms/create', (req, res) => {
    const { playerName, playerSurname, playerId, isTeamUpMode, isHomeEntryLockEnabled, isTokenBlockEnabled, appVersion } = req.body;
    
    // Generate a unique 6-digit uppercase alphanumeric room code
    let code = '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like I, O, 1, 0
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (activeRooms[code]);

    const newRoom: Room = {
      code,
      players: [
        {
          id: playerId || 'player-1',
          name: playerName || 'Player 1',
          surname: playerSurname || '',
          color: 'RED',
          isCreator: true,
          appVersion: appVersion || '1.0.0',
        },
      ],
      gameState: null,
      isTeamUpMode: false,
      isHomeEntryLockEnabled: isHomeEntryLockEnabled !== false,
      isTokenBlockEnabled: !!isTokenBlockEnabled,
      updatedAt: Date.now(),
      version: 0,
    };

    activeRooms[code] = newRoom;
    console.log(`[Ludo Server] Room created: ${code} by ${playerName}`);
    res.json(newRoom);
  });

  // Join room
  app.post('/api/rooms/join', (req, res) => {
    const { code, playerName, playerSurname, playerId, appVersion } = req.body;
    const cleanCode = (code || '').toUpperCase().trim();
    const room = activeRooms[cleanCode];

    if (!room) {
      return res.status(404).json({ error: 'Room not found. Please verify the code.' });
    }

    if (room.players.length >= 4) {
      return res.status(400).json({ error: 'Room is full (maximum 4 players).' });
    }

    // Check if player already in room
    const exists = room.players.find((p) => p.id === playerId);
    if (!exists) {
      // Allocate the next Ludo color sequentially
      const colors = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
      const usedColors = room.players.map((p) => p.color);
      const color = colors.find((c) => !usedColors.includes(c)) || 'YELLOW';

      room.players.push({
        id: playerId,
        name: playerName || `Player ${room.players.length + 1}`,
        surname: playerSurname || '',
        color,
        isCreator: false,
        appVersion: appVersion || '1.0.0',
      });
      room.version++;
    } else {
      if (appVersion) {
        exists.appVersion = appVersion;
      }
      if (playerSurname) {
        exists.surname = playerSurname;
      }
    }

    room.updatedAt = Date.now();
    console.log(`[Ludo Server] Player ${playerName} joined room: ${cleanCode}`);

    // Broadcast room update to connected WS clients in this room
    broadcastToRoom(cleanCode, {
      type: 'LOBBY_UPDATE',
      room,
    });

    res.json(room);
  });

  // Leave room
  app.post('/api/rooms/:code/leave', (req, res) => {
    const code = req.params.code.toUpperCase().trim();
    const { playerId } = req.body;
    const room = activeRooms[code];

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      const wasCreator = room.players[playerIndex].isCreator;
      room.players.splice(playerIndex, 1);

      if (room.players.length === 0) {
        delete activeRooms[code];
        console.log(`[Ludo Server] Room ${code} is empty. Room deleted.`);
        return res.json({ success: true, roomDeleted: true });
      } else {
        // If the host left, assign host to the next remaining player
        if (wasCreator) {
          room.players[0].isCreator = true;
          console.log(`[Ludo Server] Host left room ${code}. New host is ${room.players[0].name}`);
        }

        // Reassign colors sequentially
        const colors = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
        room.players.forEach((player, idx) => {
          player.color = colors[idx] || 'YELLOW';
        });

        if (room.players.length < 4) {
          room.isTeamUpMode = false;
        }

        room.version++;
        room.updatedAt = Date.now();
        console.log(`[Ludo Server] Player ${playerId} left room ${code}. Colors reassigned.`);

        // Broadcast to WS clients
        broadcastToRoom(code, {
          type: 'LOBBY_UPDATE',
          room,
        });

        return res.json({ success: true, roomDeleted: false, players: room.players, version: room.version });
      }
    }

    res.json({ success: true, message: 'Player was not in the room' });
  });

  // Rotate non-host player colors
  app.post('/api/rooms/:code/rotate', (req, res) => {
    const code = req.params.code.toUpperCase().trim();
    const { playerId } = req.body;
    const room = activeRooms[code];

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Verify player count is at least 3 (3 or 4 players)
    if (room.players.length < 3) {
      return res.status(400).json({ error: 'Swap players requires at least 3 players in the lobby' });
    }

    // Verify if requester is indeed the host (isCreator: true)
    const requester = room.players.find((p) => p.id === playerId);
    if (!requester || !requester.isCreator) {
      return res.status(403).json({ error: 'Only the host can rotate players' });
    }

    room.players = room.players.map((player) => {
      if (player.isCreator) {
        return player;
      }
      if (player.color === 'YELLOW') {
        player.color = 'BLUE';
      } else if (player.color === 'GREEN') {
        player.color = 'YELLOW';
      } else if (player.color === 'BLUE') {
        player.color = 'GREEN';
      }
      return player;
    });

    const colorOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2, BLUE: 3 };
    room.players.sort((a, b) => (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99));

    room.version++;
    room.updatedAt = Date.now();
    console.log(`[Ludo Server] Room ${code} players rotated by host. New version: ${room.version}`);

    broadcastToRoom(code, {
      type: 'LOBBY_UPDATE',
      room,
    });

    res.json(room);
  });

  // Get room state
  app.get('/api/rooms/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = activeRooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const clientVersion = req.query.v ? parseInt(req.query.v as string, 10) : undefined;
    if (clientVersion !== undefined && room.version === clientVersion) {
      return res.json({ changed: false, version: room.version });
    }

    res.json({
      changed: true,
      ...room
    });
  });

  // Update room gameState
  app.post('/api/rooms/:code/update', (req, res) => {
    const code = req.params.code.toUpperCase();
    const { gameState } = req.body;
    const room = activeRooms[code];

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.gameState = gameState;
    room.version++;
    room.updatedAt = Date.now();
    res.json({ success: true, version: room.version });
  });

  // Toggle room teamUp mode
  app.post('/api/rooms/:code/teamup', (req, res) => {
    const code = req.params.code.toUpperCase();
    const { isTeamUpMode } = req.body;
    const room = activeRooms[code];

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.isTeamUpMode = room.players.length === 4 ? !!isTeamUpMode : false;
    room.version++;
    room.updatedAt = Date.now();

    broadcastToRoom(code, {
      type: 'LOBBY_UPDATE',
      room,
    });

    res.json({ success: true, version: room.version, isTeamUpMode: room.isTeamUpMode });
  });

  // Update room settings (toggles)
  app.post('/api/rooms/:code/settings', (req, res) => {
    const code = req.params.code.toUpperCase().trim();
    const { isTeamUpMode, isHomeEntryLockEnabled, isTokenBlockEnabled, playerId } = req.body;
    const room = activeRooms[code];

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const requester = room.players.find((p) => p.id === playerId);
    if (requester && !requester.isCreator) {
      return res.status(403).json({ error: 'Only the host can modify room settings' });
    }

    if (isTeamUpMode !== undefined) {
      room.isTeamUpMode = room.players.length === 4 ? !!isTeamUpMode : false;
    }
    if (isHomeEntryLockEnabled !== undefined) {
      room.isHomeEntryLockEnabled = !!isHomeEntryLockEnabled;
    }
    if (isTokenBlockEnabled !== undefined) {
      room.isTokenBlockEnabled = !!isTokenBlockEnabled;
    }

    room.version++;
    room.updatedAt = Date.now();
    console.log(`[Ludo Server] Room ${code} settings updated. New version: ${room.version}`);

    broadcastToRoom(code, {
      type: 'LOBBY_UPDATE',
      room,
    });

    res.json(room);
  });

  // Create HTTP Server
  const server = http.createServer(app);

  // --- WEBSOCKET REALTIME ENGINE ---
  const wss = new WebSocketServer({ server });

  // Broadcast helper function to send message to room members
  function broadcastToRoom(roomCode: string, message: any, excludeWs?: WebSocket) {
    const serialized = JSON.stringify(message);
    connectedClients.forEach((meta, clientWs) => {
      if (meta.roomCode === roomCode && clientWs.readyState === WebSocket.OPEN) {
        if (!excludeWs || clientWs !== excludeWs) {
          try {
            clientWs.send(serialized);
          } catch (err) {
            console.error(`[WebSocket] Error broadcasting to player ${meta.playerId}:`, err);
          }
        }
      }
    });
  }

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] New client connected');

    ws.on('message', (messageRaw: string) => {
      try {
        const messageStr = messageRaw.toString();
        const data = JSON.parse(messageStr);

        // 1. JOIN_ROOM Event
        if (data.type === 'JOIN_ROOM') {
          const roomCode = (data.roomCode || '').toUpperCase().trim();
          const playerId = data.playerId || data.userId || 'unknown';
          const playerName = data.playerName || 'Player';
          const playerColor = data.playerColor || 'RED';

          connectedClients.set(ws, {
            ws,
            roomCode,
            playerId,
            playerName,
            playerColor,
          });

          console.log(`[WebSocket] Client ${playerId} (${playerName}) joined room ${roomCode}`);

          // Acknowledge connection to sender
          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            roomCode,
            playerId,
            success: true,
          }));

          // Notify other clients in the room that a player is active
          broadcastToRoom(roomCode, {
            type: 'PLAYER_CONNECTED',
            playerId,
            playerName,
            playerColor,
          }, ws);

          // If room exists and has gameState, send current snapshot to this client
          const existingRoom = activeRooms[roomCode];
          if (existingRoom && existingRoom.gameState) {
            ws.send(JSON.stringify({
              type: 'STATE_SYNC',
              gameState: existingRoom.gameState,
            }));
          }
          return;
        }

        // 2. Ping / Keep-Alive
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          return;
        }

        // 3. Gameplay Relay Actions
        const meta = connectedClients.get(ws);
        const roomCode = (data.roomCode || meta?.roomCode || '').toUpperCase().trim();

        if (roomCode) {
          // Update room's cached gameState on server if provided
          if (data.gameState && activeRooms[roomCode]) {
            activeRooms[roomCode].gameState = data.gameState;
            activeRooms[roomCode].updatedAt = Date.now();
            activeRooms[roomCode].version++;
          }

          // Relay action to all other peers in the room immediately
          broadcastToRoom(roomCode, data, ws);
        }
      } catch (err) {
        console.error('[WebSocket] Message parsing error:', err);
      }
    });

    ws.on('close', () => {
      const meta = connectedClients.get(ws);
      if (meta) {
        console.log(`[WebSocket] Client ${meta.playerId} disconnected from room ${meta.roomCode}`);
        connectedClients.delete(ws);

        // Notify remaining players
        if (meta.roomCode) {
          broadcastToRoom(meta.roomCode, {
            type: 'PLAYER_DISCONNECTED',
            playerId: meta.playerId,
          });
        }
      }
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Socket error:', err);
    });
  });

  // --- VITE MIDDLEWARE & STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('Ludo Game Backend Server is Active!');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ludo Server] Express + WebSocket server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
