/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as expressImport from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

interface RoomPlayer {
  id: string;
  name: string;
  color: string;
  isCreator: boolean;
  appVersion?: string;
}

interface Room {
  code: string;
  creatorId: string;
  players: RoomPlayer[];
  colorToPlayer: Record<string, string>;
  gameState: any;
  lastActivity: number;
}

const rooms: Record<string, Room> = {};

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms[code] ? generateRoomCode() : code;
}

// Clean up stale rooms older than 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const code in rooms) {
    if (now - rooms[code].lastActivity > 30 * 60 * 1000) {
      delete rooms[code];
      console.log(`[Ludo Server] Room ${code} cleaned up due to inactivity.`);
    }
  }
}, 30 * 60 * 1000);

async function startServer() {
  const express = (expressImport as any).default || expressImport;
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  const httpServer = createHttpServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // REST endpoints for health check & quick room creation
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeRooms: Object.keys(rooms).length,
      timestamp: Date.now(),
    });
  });

  app.post('/api/rooms/create', (req, res) => {
    const { playerName, appVersion } = req.body;
    const roomCode = generateRoomCode();
    const playerId = 'ply-' + Math.random().toString(36).substring(2, 11);

    rooms[roomCode] = {
      code: roomCode,
      creatorId: playerId,
      players: [
        {
          id: playerId,
          name: playerName || 'Player 1',
          color: 'red',
          isCreator: true,
          appVersion,
        },
      ],
      colorToPlayer: { red: playerId },
      gameState: null,
      lastActivity: Date.now(),
    };

    console.log(`[Ludo Server] Room created: ${roomCode} by ${playerName || 'Player 1'}`);

    res.json({
      roomCode,
      playerId,
      playerColor: 'red',
    });
  });

  // Socket.IO real-time gameplay handler
  io.on('connection', (socket) => {
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    socket.on('join_room', ({ roomCode, playerName, playerId: reqPlayerId }) => {
      const code = roomCode.toUpperCase();
      const room = rooms[code];

      if (!room) {
        socket.emit('error_message', 'Room not found. Please check the code.');
        return;
      }

      if (room.players.length >= 4) {
        socket.emit('error_message', 'Room is full (max 4 players).');
        return;
      }

      const playerId = reqPlayerId || 'ply-' + Math.random().toString(36).substring(2, 11);
      
      const availableColors = ['red', 'green', 'yellow', 'blue'].filter(
        (c) => !room.players.some((p) => p.color === c)
      );
      const assignedColor = availableColors[0] || 'blue';

      const existingPlayerIndex = room.players.findIndex((p) => p.id === playerId);
      if (existingPlayerIndex === -1) {
        room.players.push({
          id: playerId,
          name: playerName || `Player ${room.players.length + 1}`,
          color: assignedColor,
          isCreator: false,
        });
        room.colorToPlayer[assignedColor] = playerId;
      }

      room.lastActivity = Date.now();
      currentRoomCode = code;
      currentPlayerId = playerId;

      socket.join(code);

      console.log(`[Ludo Server] Player ${playerName} joined room: ${code}`);

      io.to(code).emit('room_updated', {
        roomCode: code,
        players: room.players,
        gameState: room.gameState,
      });

      socket.emit('joined_successfully', {
        playerId,
        assignedColor,
        roomCode: code,
        players: room.players,
        gameState: room.gameState,
      });
    });

    socket.on('rejoin_room', ({ roomCode, playerId }) => {
      const code = roomCode.toUpperCase();
      const room = rooms[code];

      if (!room) {
        socket.emit('error_message', 'Room no longer exists.');
        return;
      }

      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        socket.emit('error_message', 'Player not recognized in this room.');
        return;
      }

      currentRoomCode = code;
      currentPlayerId = playerId;
      room.lastActivity = Date.now();

      socket.join(code);

      socket.emit('joined_successfully', {
        playerId,
        assignedColor: player.color,
        roomCode: code,
        players: room.players,
        gameState: room.gameState,
      });
    });

    socket.on('game_action', ({ roomCode, action, payload }) => {
      const room = rooms[roomCode];
      if (!room) return;

      room.lastActivity = Date.now();

      if (action === 'SYNC_STATE') {
        room.gameState = payload;
      }

      socket.to(roomCode).emit('game_action_received', {
        action,
        payload,
        senderId: currentPlayerId,
      });
    });

    socket.on('chat_message', ({ roomCode, senderName, text }) => {
      const room = rooms[roomCode];
      if (!room) return;

      io.to(roomCode).emit('new_chat_message', {
        id: Math.random().toString(36).substring(2, 9),
        senderName,
        text,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', () => {
      if (currentRoomCode && currentPlayerId) {
        const room = rooms[currentRoomCode];
        if (room) {
          room.players = room.players.filter((p) => p.id !== currentPlayerId);
          
          for (const color in room.colorToPlayer) {
            if (room.colorToPlayer[color] === currentPlayerId) {
              delete room.colorToPlayer[color];
            }
          }

          console.log(`[Ludo Server] Player ${currentPlayerId} left room ${currentRoomCode}. Colors reassigned.`);

          if (room.players.length === 0) {
            delete rooms[currentRoomCode];
            console.log(`[Ludo Server] Room ${currentRoomCode} deleted as all players left.`);
          } else {
            io.to(currentRoomCode).emit('room_updated', {
              roomCode: currentRoomCode,
              players: room.players,
              gameState: room.gameState,
            });
          }
        }
      }
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

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ludo Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Ludo Server] Failed to start:', err);
});
