/**
 * STANDALONE LUDO MULTIPLAYER WEBSOCKET & HTTP SERVER
 * 
 * Ready to run directly on Render, Railway, Heroku, or VPS.
 * Port is read dynamically from process.env.PORT (Render sets this automatically).
 */

import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";

export type PlayerColor = "RED" | "GREEN" | "YELLOW" | "BLUE";

export interface RoomPlayer {
  id: string;
  name: string;
  surname?: string;
  avatar?: string;
  color: PlayerColor;
  isCreator: boolean;
  ws?: WebSocket;
  isAlive?: boolean;
}

export interface SignalingRoom {
  code: string;
  players: {
    id: string;
    color: PlayerColor;
    name: string;
    surname?: string;
    avatar?: string;
    isCreator: boolean;
  }[];
  isTeamUpMode: boolean;
  isHomeEntryLockEnabled: boolean;
  isTokenBlockEnabled: boolean;
  gameStarted: boolean;
  createdAt: number;
}

interface RoomData {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  isTeamUpMode: boolean;
  isHomeEntryLockEnabled: boolean;
  isTokenBlockEnabled: boolean;
  gameStarted: boolean;
  createdAt: number;
}

// In-Memory Room Store
const rooms = new Map<string, RoomData>();

// Color assignment order: 1st=RED, 2nd=GREEN, 3rd=YELLOW, 4th=BLUE
const COLOR_ORDER: PlayerColor[] = ["RED", "GREEN", "YELLOW", "BLUE"];

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

function getSanitizedRoom(room: RoomData): SignalingRoom {
  return {
    code: room.code,
    players: room.players.map((p) => ({
      id: p.id,
      color: p.color,
      name: p.name,
      surname: p.surname,
      avatar: p.avatar,
      isCreator: p.isCreator,
    })),
    isTeamUpMode: room.isTeamUpMode,
    isHomeEntryLockEnabled: room.isHomeEntryLockEnabled,
    isTokenBlockEnabled: room.isTokenBlockEnabled,
    gameStarted: room.gameStarted,
    createdAt: room.createdAt,
  };
}

function broadcastToRoom(room: RoomData, message: object) {
  const payload = JSON.stringify(message);
  for (const player of room.players) {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      try {
        player.ws.send(payload);
      } catch (err) {
        console.error(`[WS] Error broadcasting to player ${player.id}:`, err);
      }
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // CORS Middleware for Render & cross-origin frontend requests
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json());

  // Root Server Info
  app.get("/", (_req, res) => {
    res.json({
      service: "Ludo Multiplayer Live Server",
      status: "running",
      activeRooms: rooms.size,
      uptime: process.uptime(),
      wsEndpoint: "/ws",
    });
  });

  // Health check endpoint (for Render health check probes)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size });
  });

  // App version check endpoint
  app.get("/api/app-version", (_req, res) => {
    res.json({
      latestVersion: "1.0.0",
      minRequiredVersion: "1.0.0",
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.gamers.ludo",
      appStoreUrl: "https://apps.apple.com/app/id123456789",
    });
  });

  // REST endpoint to get room info
  app.get("/api/rooms/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    return res.json(getSanitizedRoom(room));
  });

  const server = http.createServer(app);

  // WebSocket Server setup
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Keep-alive heartbeat (prevents Render 55-second idle WebSocket timeout)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: WebSocket & { isAlive?: boolean }) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  wss.on("connection", (ws: WebSocket & { isAlive?: boolean }) => {
    ws.isAlive = true;
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const { type } = data;

        // PING / HEARTBEAT
        if (type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", time: Date.now() }));
          return;
        }

        // 1. CREATE_ROOM
        if (type === "CREATE_ROOM") {
          const {
            playerId,
            playerName,
            playerSurname,
            playerAvatar,
            isTeamUpMode = false,
            isHomeEntryLockEnabled = true,
            isTokenBlockEnabled = false,
          } = data;

          if (!playerId) return;

          const code = generateRoomCode();
          const hostPlayer: RoomPlayer = {
            id: playerId,
            name: playerName || "Host",
            surname: playerSurname || "",
            avatar: playerAvatar || "",
            color: "RED",
            isCreator: true,
            ws,
          };

          const newRoom: RoomData = {
            code,
            hostId: playerId,
            players: [hostPlayer],
            isTeamUpMode: Boolean(isTeamUpMode),
            isHomeEntryLockEnabled: Boolean(isHomeEntryLockEnabled),
            isTokenBlockEnabled: Boolean(isTokenBlockEnabled),
            gameStarted: false,
            createdAt: Date.now(),
          };

          rooms.set(code, newRoom);
          currentRoomCode = code;
          currentPlayerId = playerId;

          const sanitized = getSanitizedRoom(newRoom);
          ws.send(
            JSON.stringify({
              type: "ROOM_CREATED",
              room: sanitized,
              yourColor: "RED",
            })
          );
          console.log(`[WS] Room ${code} created by host ${playerName} (${playerId})`);
          return;
        }

        // 2. JOIN_ROOM
        if (type === "JOIN_ROOM") {
          const { roomCode, playerId, playerName, playerSurname, playerAvatar } = data;
          if (!roomCode || !playerId) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Invalid room code or player ID" }));
            return;
          }

          const code = roomCode.trim().toUpperCase();
          const room = rooms.get(code);

          if (!room) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Room not found. Check the 6-digit code." }));
            return;
          }

          if (room.gameStarted) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Game already started in this room." }));
            return;
          }

          // Check if reconnecting
          const existingPlayer = room.players.find((p) => p.id === playerId);
          if (existingPlayer) {
            existingPlayer.ws = ws;
            existingPlayer.name = playerName || existingPlayer.name;
            existingPlayer.surname = playerSurname || existingPlayer.surname;
            existingPlayer.avatar = playerAvatar || existingPlayer.avatar;
            currentRoomCode = code;
            currentPlayerId = playerId;

            const sanitized = getSanitizedRoom(room);
            broadcastToRoom(room, {
              type: "ROOM_UPDATED",
              room: sanitized,
            });
            ws.send(
              JSON.stringify({
                type: "JOIN_SUCCESS",
                room: sanitized,
                yourColor: existingPlayer.color,
              })
            );
            return;
          }

          if (room.players.length >= 4) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Room is already full (Max 4 Players)." }));
            return;
          }

          // Assign next available color from COLOR_ORDER
          const takenColors = room.players.map((p) => p.color);
          const availableColor = COLOR_ORDER.find((c) => !takenColors.includes(c)) || "GREEN";

          const newPlayer: RoomPlayer = {
            id: playerId,
            name: playerName || `Player ${room.players.length + 1}`,
            surname: playerSurname || "",
            avatar: playerAvatar || "",
            color: availableColor,
            isCreator: false,
            ws,
          };

          room.players.push(newPlayer);
          currentRoomCode = code;
          currentPlayerId = playerId;

          const sanitized = getSanitizedRoom(room);
          broadcastToRoom(room, {
            type: "ROOM_UPDATED",
            room: sanitized,
          });
          ws.send(
            JSON.stringify({
              type: "JOIN_SUCCESS",
              room: sanitized,
              yourColor: availableColor,
            })
          );
          console.log(`[WS] Player ${newPlayer.name} (${playerId}) joined room ${code} as ${availableColor}`);
          return;
        }

        // 3. UPDATE_LOBBY_SETTINGS
        if (type === "UPDATE_LOBBY_SETTINGS") {
          const { roomCode, playerId, isTeamUpMode, isHomeEntryLockEnabled, isTokenBlockEnabled } = data;
          const room = rooms.get(roomCode?.toUpperCase());
          if (!room || room.hostId !== playerId) return;

          if (isTeamUpMode !== undefined) room.isTeamUpMode = Boolean(isTeamUpMode);
          if (isHomeEntryLockEnabled !== undefined) room.isHomeEntryLockEnabled = Boolean(isHomeEntryLockEnabled);
          if (isTokenBlockEnabled !== undefined) room.isTokenBlockEnabled = Boolean(isTokenBlockEnabled);

          const sanitized = getSanitizedRoom(room);
          broadcastToRoom(room, {
            type: "ROOM_UPDATED",
            room: sanitized,
          });
          return;
        }

        // 4. ROTATE_PLAYERS
        if (type === "ROTATE_PLAYERS") {
          const { roomCode, playerId } = data;
          const room = rooms.get(roomCode?.toUpperCase());
          if (!room || room.hostId !== playerId || room.players.length < 2) return;

          const currentColors = room.players.map((p) => p.color);
          const rotatedColors = [currentColors[currentColors.length - 1], ...currentColors.slice(0, -1)];
          room.players.forEach((p, idx) => {
            p.color = rotatedColors[idx];
          });

          const sanitized = getSanitizedRoom(room);
          broadcastToRoom(room, {
            type: "ROOM_UPDATED",
            room: sanitized,
          });
          return;
        }

        // 5. START_GAME
        if (type === "START_GAME") {
          const { roomCode, playerId } = data;
          const room = rooms.get(roomCode?.toUpperCase());
          if (!room) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Room not found" }));
            return;
          }

          if (room.hostId !== playerId) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Only the host can start the match." }));
            return;
          }

          if (room.players.length < 2) {
            ws.send(JSON.stringify({ type: "ERROR", message: "At least 2 players are required to start." }));
            return;
          }

          room.gameStarted = true;
          const sanitized = getSanitizedRoom(room);

          console.log(`[WS] Game STARTING in room ${room.code} with ${room.players.length} players!`);

          broadcastToRoom(room, {
            type: "GAME_STARTED",
            room: sanitized,
          });
          return;
        }

        // 6. LEAVE_ROOM
        if (type === "LEAVE_ROOM") {
          if (currentRoomCode && currentPlayerId) {
            const room = rooms.get(currentRoomCode);
            if (room) {
              room.players = room.players.filter((p) => p.id !== currentPlayerId);
              if (room.players.length === 0) {
                rooms.delete(currentRoomCode);
                console.log(`[WS] Room ${currentRoomCode} deleted (all players left).`);
              } else {
                if (room.hostId === currentPlayerId) {
                  room.hostId = room.players[0].id;
                  room.players[0].isCreator = true;
                }
                const sanitized = getSanitizedRoom(room);
                broadcastToRoom(room, {
                  type: "ROOM_UPDATED",
                  room: sanitized,
                });
              }
            }
          }
          currentRoomCode = null;
          currentPlayerId = null;
          return;
        }
      } catch (err) {
        console.error("[WS] Message processing error:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoomCode && currentPlayerId) {
        const room = rooms.get(currentRoomCode);
        if (room && !room.gameStarted) {
          room.players = room.players.filter((p) => p.id !== currentPlayerId);
          if (room.players.length === 0) {
            rooms.delete(currentRoomCode);
            console.log(`[WS] Room ${currentRoomCode} cleaned up after disconnect.`);
          } else {
            if (room.hostId === currentPlayerId) {
              room.hostId = room.players[0].id;
              room.players[0].isCreator = true;
            }
            const sanitized = getSanitizedRoom(room);
            broadcastToRoom(room, {
              type: "ROOM_UPDATED",
              room: sanitized,
            });
          }
        }
      }
    });
  });

  // Client Static Files / Vite Dev fallback (keeps preview working)
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch {
      // Ignored if Vite is not present on Render standalone production build
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Standalone Ludo Server listening on port ${PORT}`);
  });
}

startServer();
