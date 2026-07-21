/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  isCreator: boolean;
  appVersion?: string;
}

interface Room {
  code: string;
  players: RoomPlayer[];
  gameState: any; // Complete board state sync
  isTeamUpMode?: boolean;
  signalingData: {
    from: string;
    type: string;
    payload: any;
  }[];
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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // --- CORS MIDDLEWARE (Required for Render and external app connections) ---
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
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
    res.json({ status: 'ok', activeRoomsCount: Object.keys(activeRooms).length });
  });

  // Get latest App Version and upgrade links
  app.get('/api/app-version', (req, res) => {
    res.json({
      latestVersion: '2.4',
      minRequiredVersion: '2.4',
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.gamers.ludo',
      appStoreUrl: 'https://apps.apple.com/app/ludo-battle-king/id1234567890',
    });
  });

  // Create room
  app.post('/api/rooms/create', (req, res) => {
    const { playerName, playerId, isTeamUpMode, appVersion } = req.body;
    
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
          color: 'RED',
          isCreator: true,
          appVersion: appVersion || '2.4',
        },
      ],
      gameState: null,
      isTeamUpMode: !!isTeamUpMode,
      signalingData: [],
      updatedAt: Date.now(),
      version: 0,
    };

    activeRooms[code] = newRoom;
    console.log(`[Ludo Server] Room created: ${code} by ${playerName}`);
    res.json(newRoom);
  });

  // Join room
  app.post('/api/rooms/join', (req, res) => {
    const { code, playerName, playerId, appVersion } = req.body;
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
        color,
        isCreator: false,
        appVersion: appVersion || '2.4',
      });
      room.version++;
    } else {
      if (appVersion) {
        exists.appVersion = appVersion;
      }
    }

    room.updatedAt = Date.now();
    console.log(`[Ludo Server] Player ${playerName} joined room: ${cleanCode}`);
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

        // Reassign colors sequentially so that remaining players sit in RED, YELLOW, GREEN, BLUE in order
        const colors = ['RED', 'YELLOW', 'GREEN', 'BLUE'];
        room.players.forEach((player, idx) => {
          player.color = colors[idx] || 'YELLOW';
        });

        room.version++;
        room.updatedAt = Date.now();
        console.log(`[Ludo Server] Player ${playerId} left room ${code}. Colors reassigned.`);
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

    // Verify if requester is indeed the host (isCreator: true)
    const requester = room.players.find((p) => p.id === playerId);
    if (!requester || !requester.isCreator) {
      return res.status(403).json({ error: 'Only the host can rotate players' });
    }

    // Update player positions/colors:
    // Green (GREEN) -> Yellow (YELLOW)
    // Blue (BLUE) -> Green (GREEN)
    // Yellow (YELLOW) -> Blue (BLUE)
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

    // Sort players so order is consistent in DB representation
    const colorOrder: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2, BLUE: 3 };
    room.players.sort((a, b) => (colorOrder[a.color] ?? 99) - (colorOrder[b.color] ?? 99));

    room.version++;
    room.updatedAt = Date.now();
    console.log(`[Ludo Server] Room ${code} players rotated by host. New version: ${room.version}`);
    res.json(room);
  });

  // Get room state (polling fallback with version-based fast polling)
  app.get('/api/rooms/:code', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = activeRooms[code];
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check client version
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

    room.isTeamUpMode = !!isTeamUpMode;
    room.version++;
    room.updatedAt = Date.now();
    res.json({ success: true, version: room.version, isTeamUpMode: room.isTeamUpMode });
  });

  // WebRTC signaling exchange
  app.post('/api/rooms/:code/signaling', (req, res) => {
    const code = req.params.code.toUpperCase();
    const { from, type, payload } = req.body;
    const room = activeRooms[code];

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Push new signaling message
    room.signalingData.push({ from, type, payload });
    // Keep only last 20 signaling messages to save memory
    if (room.signalingData.length > 20) {
      room.signalingData.shift();
    }

    room.updatedAt = Date.now();
    res.json({ success: true });
  });

  // Clear signaling (once connected)
  app.post('/api/rooms/:code/signaling/clear', (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = activeRooms[code];
    if (room) {
      room.signalingData = [];
    }
    res.json({ success: true });
  });

  // --- VITE MIDDLEWARE & STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ludo Server] Express custom server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
