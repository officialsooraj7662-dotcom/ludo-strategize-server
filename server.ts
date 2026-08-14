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
  isBot?: boolean;
  isOffline?: boolean;
  hasQuit?: boolean;
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
    isBot?: boolean;
    isOffline?: boolean;
    hasQuit?: boolean;
  }[];
  isTeamUpMode: boolean;
  isHomeEntryLockEnabled: boolean;
  isTokenBlockEnabled: boolean;
  gameStarted: boolean;
  gameState?: any;
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
  gameState?: any;
  winnerColor?: string | null;
  createdAt: number;
}

// In-Memory Room Store
const rooms = new Map<string, RoomData>();

// 40 realistic English names for opponents in online matchmaking
const OPPONENT_NAMES = [
  "Oliver", "Emma", "Liam", "Olivia", "Noah",
  "Ava", "Ethan", "Sophia", "Mason", "Isabella",
  "William", "Mia", "James", "Charlotte", "Benjamin",
  "Amelia", "Lucas", "Harper", "Alexander", "Evelyn",
  "Daniel", "Emily", "Henry", "Abigail", "Michael",
  "Ella", "Jackson", "Scarlett", "Sebastian", "Grace",
  "Jack", "Chloe", "Aiden", "Victoria", "Matthew",
  "Lily", "Samuel", "Zoe", "David", "Luna"
];

// Helper to get random distinct names from OPPONENT_NAMES
function getRandomOpponentNames(count: number, excludeNames: string[] = []): string[] {
  const available = OPPONENT_NAMES.filter((n) => !excludeNames.includes(n));
  // Shuffle array
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = available[i];
    available[i] = available[j];
    available[j] = temp;
  }
  return available.slice(0, count);
}

// --- GLOBAL AUTO MATCHMAKING QUEUE (60 SECONDS TIMEOUT) ---
interface QueuePlayer {
  ws: WebSocket;
  playerId: string;
  playerName: string;
  playerSurname?: string;
  playerAvatar?: string;
  joinedAt: number;
}

let activeQueue: QueuePlayer[] = [];
let matchmakingTimerInterval: NodeJS.Timeout | null = null;
let matchmakingCountdown = 60;
const MATCHMAKING_TIMEOUT = 60;

function broadcastQueueUpdate() {
  const payload = JSON.stringify({
    type: "QUEUE_UPDATE",
    count: activeQueue.length,
    timeLeft: matchmakingCountdown,
    totalTime: MATCHMAKING_TIMEOUT,
    players: activeQueue.map((qp, idx) => ({
      id: qp.playerId,
      name: qp.playerName || `Player ${idx + 1}`,
      surname: qp.playerSurname || "",
      avatar: qp.playerAvatar || "",
    })),
  });
  for (const qp of activeQueue) {
    if (qp.ws && qp.ws.readyState === WebSocket.OPEN) {
      try {
        qp.ws.send(payload);
      } catch (err) {
        console.error("[WS] Error sending queue update:", err);
      }
    }
  }
}

function launchAutoMatch(batch: QueuePlayer[]) {
  if (batch.length === 0) return;

  const roomCode = generateRoomCode();
  const colors: PlayerColor[] = ["RED", "GREEN", "YELLOW", "BLUE"];
  const roomPlayers: RoomPlayer[] = [];

  // Add real players from queue batch
  batch.forEach((qp, idx) => {
    roomPlayers.push({
      id: qp.playerId,
      name: qp.playerName || `Player ${idx + 1}`,
      surname: qp.playerSurname || "",
      avatar: qp.playerAvatar || "",
      color: colors[idx],
      isCreator: idx === 0,
      isBot: false,
      ws: qp.ws,
    });
  });

  // Fill remaining empty slots up to 4 with unique random realistic player names
  const realCount = batch.length;
  const realPlayerNames = batch.map((qp) => qp.playerName || "");
  const assignedOpponentNames = getRandomOpponentNames(4 - realCount, realPlayerNames);

  for (let i = realCount; i < 4; i++) {
    const slotColor = colors[i];
    const opponentName = assignedOpponentNames[i - realCount] || `Player ${i + 1}`;
    roomPlayers.push({
      id: `player_${slotColor.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`,
      name: opponentName,
      surname: "",
      avatar: "",
      color: slotColor,
      isCreator: false,
      isBot: true,
    });
  }

  const newRoom: RoomData = {
    code: roomCode,
    hostId: roomPlayers[0].id,
    players: roomPlayers,
    isTeamUpMode: false,
    isHomeEntryLockEnabled: true,
    isTokenBlockEnabled: false,
    gameStarted: true,
    createdAt: Date.now(),
  };

  rooms.set(roomCode, newRoom);
  console.log(`[WS] Auto Match Launched in Room ${roomCode}! Total players: ${roomPlayers.length} (Real: ${realCount}, Matched: ${4 - realCount})`);

  const sanitized = getSanitizedRoom(newRoom);
  broadcastToRoom(newRoom, {
    type: "GAME_STARTED",
    room: sanitized,
    isAutoMatch: true,
    realCount,
  });
}

function startMatchmakingTimer() {
  if (matchmakingTimerInterval) return;
  matchmakingCountdown = MATCHMAKING_TIMEOUT;
  broadcastQueueUpdate();

  matchmakingTimerInterval = setInterval(() => {
    matchmakingCountdown -= 1;
    broadcastQueueUpdate();

    if (matchmakingCountdown <= 0) {
      if (matchmakingTimerInterval) {
        clearInterval(matchmakingTimerInterval);
        matchmakingTimerInterval = null;
      }

      // 60 seconds finished -> Take up to 4 available players, fill rest with Bots, start match!
      if (activeQueue.length > 0) {
        const batch = activeQueue.splice(0, 4);
        launchAutoMatch(batch);
      }

      // If more players are still in queue (e.g. 5th player), restart timer for next batch
      if (activeQueue.length > 0) {
        startMatchmakingTimer();
      } else {
        matchmakingCountdown = MATCHMAKING_TIMEOUT;
      }
    }
  }, 1000);
}

function stopMatchmakingTimerIfEmpty() {
  if (activeQueue.length === 0 && matchmakingTimerInterval) {
    clearInterval(matchmakingTimerInterval);
    matchmakingTimerInterval = null;
    matchmakingCountdown = MATCHMAKING_TIMEOUT;
  }
}

// Color assignment order: 1st=RED, 2nd=YELLOW (for 2-players opposite start), 3rd=GREEN, 4th=BLUE
const COLOR_ORDER_2_PLAYERS: PlayerColor[] = ["RED", "YELLOW"];
const COLOR_ORDER_DEFAULT: PlayerColor[] = ["RED", "GREEN", "YELLOW", "BLUE"];

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
      isBot: Boolean(p.isBot),
      isOffline: Boolean(p.isOffline),
      hasQuit: Boolean(p.hasQuit),
    })),
    isTeamUpMode: room.isTeamUpMode,
    isHomeEntryLockEnabled: room.isHomeEntryLockEnabled,
    isTokenBlockEnabled: room.isTokenBlockEnabled,
    gameStarted: room.gameStarted,
    gameState: room.gameState,
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

  // REST endpoint to check if a player has an active ongoing match
  app.get("/api/player-active-match/:playerId", (req, res) => {
    const { playerId } = req.params;
    if (!playerId) {
      return res.json({ hasActiveMatch: false });
    }
    for (const [code, room] of rooms.entries()) {
      if (room.gameStarted && !room.winnerColor) {
        const p = room.players.find((player) => player.id === playerId && !player.hasQuit);
        if (p) {
          return res.json({
            hasActiveMatch: true,
            roomCode: code,
            yourColor: p.color,
            isTeamUpMode: room.isTeamUpMode,
            createdAt: room.createdAt,
          });
        }
      }
    }
    return res.json({ hasActiveMatch: false });
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

        // 1. JOIN_AUTO_QUEUE / join_auto_queue (Global 4-Player Matchmaking Queue)
        if (type === "JOIN_AUTO_QUEUE" || type === "join_auto_queue") {
          const { playerId, playerName, playerSurname, playerAvatar } = data;
          if (!playerId) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Invalid player ID" }));
            return;
          }

          // Remove any existing entry for this player / socket first to prevent duplicates
          activeQueue = activeQueue.filter((qp) => qp.playerId !== playerId && qp.ws !== ws);

          const queuePlayer: QueuePlayer = {
            ws,
            playerId,
            playerName: playerName || `Player`,
            playerSurname: playerSurname || "",
            playerAvatar: playerAvatar || "",
            joinedAt: Date.now(),
          };

          activeQueue.push(queuePlayer);
          currentPlayerId = playerId;
          console.log(`[WS] Player ${queuePlayer.playerName} (${playerId}) joined Global Auto Queue. Total queued: ${activeQueue.length}`);

          // Condition A: If 4 real players join, immediately launch 4-player real match!
          if (activeQueue.length >= 4) {
            const batch = activeQueue.splice(0, 4);
            launchAutoMatch(batch);
            if (activeQueue.length === 0) {
              if (matchmakingTimerInterval) {
                clearInterval(matchmakingTimerInterval);
                matchmakingTimerInterval = null;
                matchmakingCountdown = MATCHMAKING_TIMEOUT;
              }
            } else {
              matchmakingCountdown = MATCHMAKING_TIMEOUT;
              broadcastQueueUpdate();
            }
          } else {
            // Start 60-second countdown timer if not already running
            startMatchmakingTimer();
            broadcastQueueUpdate();
          }
          return;
        }

        // 2. LEAVE_AUTO_QUEUE / leave_auto_queue
        if (type === "LEAVE_AUTO_QUEUE" || type === "leave_auto_queue") {
          const { playerId } = data;
          activeQueue = activeQueue.filter((qp) => qp.ws !== ws && (!playerId || qp.playerId !== playerId));
          console.log(`[WS] Player left Global Auto Queue. Remaining: ${activeQueue.length}`);
          stopMatchmakingTimerIfEmpty();
          broadcastQueueUpdate();
          return;
        }

        // 3. CREATE_ROOM
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

          // Color Assignment Logic based on Player Count:
          // If 2 players: 1st=RED, 2nd=YELLOW (Opposite corners)
          // If 3 players: 1st=RED, 2nd=GREEN, 3rd=YELLOW
          // If 4 players: 1st=RED, 2nd=GREEN, 3rd=YELLOW, 4th=BLUE
          let availableColor: PlayerColor = "YELLOW";
          if (room.players.length === 1) {
            availableColor = "YELLOW";
          } else if (room.players.length === 2) {
            // Re-align player 2 to GREEN and assign YELLOW to player 3 for standard 3-player match
            room.players[0].color = "RED";
            room.players[1].color = "GREEN";
            availableColor = "YELLOW";
          } else if (room.players.length === 3) {
            availableColor = "BLUE";
          } else {
            const takenColors = room.players.map((p) => p.color);
            availableColor = COLOR_ORDER_DEFAULT.find((c) => !takenColors.includes(c)) || "GREEN";
          }

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

          // Strictly enforce player colors based on count:
          // 2 Players -> RED & YELLOW (Opposite start positions across the board)
          // 3 Players -> RED, GREEN, YELLOW
          // 4 Players -> RED, GREEN, YELLOW, BLUE
          if (room.players.length === 2) {
            room.players[0].color = "RED";
            room.players[1].color = "YELLOW";
          } else if (room.players.length === 3) {
            room.players[0].color = "RED";
            room.players[1].color = "GREEN";
            room.players[2].color = "YELLOW";
          } else if (room.players.length >= 4) {
            room.players[0].color = "RED";
            room.players[1].color = "GREEN";
            room.players[2].color = "YELLOW";
            room.players[3].color = "BLUE";
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

        // 6. CHECK_ACTIVE_MATCH
        if (type === "CHECK_ACTIVE_MATCH" || type === "check_active_match") {
          const { playerId } = data;
          if (!playerId) {
            ws.send(JSON.stringify({ type: "NO_ACTIVE_MATCH" }));
            return;
          }
          let found = false;
          for (const [code, room] of rooms.entries()) {
            if (room.gameStarted && !room.winnerColor) {
              const p = room.players.find((player) => player.id === playerId && !player.hasQuit);
              if (p) {
                found = true;
                ws.send(
                  JSON.stringify({
                    type: "ACTIVE_MATCH_FOUND",
                    roomCode: code,
                    yourColor: p.color,
                    room: getSanitizedRoom(room),
                    gameState: room.gameState,
                  })
                );
                break;
              }
            }
          }
          if (!found) {
            ws.send(JSON.stringify({ type: "NO_ACTIVE_MATCH" }));
          }
          return;
        }

        // 7. REJOIN_MATCH / rejoin_match
        if (type === "REJOIN_MATCH" || type === "rejoin_match") {
          const { roomCode, playerId, playerName } = data;
          if (!roomCode || !playerId) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Missing room code or player ID" }));
            return;
          }
          const code = roomCode.trim().toUpperCase();
          const room = rooms.get(code);
          if (!room || !room.gameStarted) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Match is no longer active or room has closed." }));
            return;
          }
          const player = room.players.find((p) => p.id === playerId);
          if (!player) {
            ws.send(JSON.stringify({ type: "ERROR", message: "Player not found in this match." }));
            return;
          }
          player.ws = ws;
          player.isOffline = false;
          player.hasQuit = false;
          if (playerName) player.name = playerName;
          currentRoomCode = code;
          currentPlayerId = playerId;

          const sanitized = getSanitizedRoom(room);
          ws.send(
            JSON.stringify({
              type: "REJOIN_SUCCESS",
              room: sanitized,
              yourColor: player.color,
              gameState: room.gameState,
            })
          );

          broadcastToRoom(room, {
            type: "PLAYER_RECONNECTED",
            playerId: player.id,
            color: player.color,
            name: player.name,
            room: sanitized,
          });
          console.log(`[WS] Player ${player.name} (${playerId}) REJOINED active room ${code}!`);
          return;
        }

        // 8. FORFEIT_MATCH / forfeit_match / LEAVE_MATCH
        if (type === "FORFEIT_MATCH" || type === "forfeit_match" || type === "LEAVE_MATCH") {
          const targetCode = data.roomCode || currentRoomCode;
          const targetPlayerId = data.playerId || currentPlayerId;
          if (targetCode && targetPlayerId) {
            const room = rooms.get(targetCode.toUpperCase());
            if (room && room.gameStarted) {
              const p = room.players.find((player) => player.id === targetPlayerId);
              if (p) {
                p.isOffline = true;
                p.hasQuit = true;
                const sanitized = getSanitizedRoom(room);
                broadcastToRoom(room, {
                  type: "ROOM_UPDATED",
                  room: sanitized,
                });
                broadcastToRoom(room, {
                  type: "PLAYER_OFFLINE",
                  playerId: p.id,
                  color: p.color,
                  name: p.name,
                  room: sanitized,
                });
              }
            }
          }
          if (currentRoomCode === targetCode) currentRoomCode = null;
          if (currentPlayerId === targetPlayerId) currentPlayerId = null;
          return;
        }

        // 9. SYNC_GAME_STATE / GAME_ACTION (Live state synchronization for online room matches)
        if (type === "SYNC_GAME_STATE" || type === "GAME_ACTION") {
          const { roomCode, gameState } = data;
          if (!roomCode) return;
          const room = rooms.get(roomCode.toUpperCase());
          if (!room) return;
          if (gameState) {
            room.gameState = gameState;
            if (gameState.winnerColor) {
              room.winnerColor = gameState.winnerColor;
            }
          }
          broadcastToRoom(room, data);
          return;
        }

        // 10. LEAVE_ROOM / leave_lobby
        if (type === "LEAVE_ROOM" || type === "leave_lobby") {
          const targetCode = data.roomCode || currentRoomCode;
          const targetPlayerId = data.playerId || currentPlayerId;
          if (targetCode && targetPlayerId) {
            const room = rooms.get(targetCode.toUpperCase());
            if (room) {
              if (!room.gameStarted) {
                // In Lobby: Remove player and immediately make slot vacant for others
                room.players = room.players.filter((p) => p.id !== targetPlayerId);
                if (room.players.length === 0) {
                  rooms.delete(targetCode.toUpperCase());
                  console.log(`[WS] Room ${targetCode} deleted (all players left lobby).`);
                } else {
                  if (room.hostId === targetPlayerId) {
                    room.hostId = room.players[0].id;
                    room.players[0].isCreator = true;
                  }
                  const sanitized = getSanitizedRoom(room);
                  broadcastToRoom(room, {
                    type: "ROOM_UPDATED",
                    room: sanitized,
                  });
                }
              } else {
                // In Active Match: Mark player as Offline so pawns remain on board
                const p = room.players.find((player) => player.id === targetPlayerId);
                if (p) {
                  p.isOffline = true;
                  const sanitized = getSanitizedRoom(room);
                  broadcastToRoom(room, {
                    type: "ROOM_UPDATED",
                    room: sanitized,
                  });
                  broadcastToRoom(room, {
                    type: "PLAYER_OFFLINE",
                    playerId: p.id,
                    color: p.color,
                    name: p.name,
                    room: sanitized,
                  });
                }
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
      // 1. Remove from global auto matchmaking queue if present
      const wasInQueue = activeQueue.some((qp) => qp.ws === ws);
      if (wasInQueue) {
        activeQueue = activeQueue.filter((qp) => qp.ws !== ws);
        stopMatchmakingTimerIfEmpty();
        broadcastQueueUpdate();
      }

      // 2. Private room handling on disconnect
      if (currentRoomCode && currentPlayerId) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          if (!room.gameStarted) {
            // Before game start: Remove player from lobby
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
          } else {
            // After game start: Mark player as offline so their pawns remain and turn is auto-skipped
            const p = room.players.find((player) => player.id === currentPlayerId);
            if (p) {
              p.isOffline = true;
              const sanitized = getSanitizedRoom(room);
              broadcastToRoom(room, {
                type: "ROOM_UPDATED",
                room: sanitized,
              });
              broadcastToRoom(room, {
                type: "PLAYER_OFFLINE",
                playerId: p.id,
                color: p.color,
                name: p.name,
                room: sanitized,
              });
              console.log(`[WS] Player ${p.name} (${currentPlayerId}) marked OFFLINE in room ${currentRoomCode}.`);
            }
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
