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
  currentSeq?: number;
  createdAt: number;
}

export interface GameActionPacket {
  seq: number;
  clientActionId?: string;
  type: string;
  roomCode: string;
  playerId?: string;
  color?: PlayerColor;
  rollValue?: number;
  turnsWithoutSix?: number;
  tokenId?: number;
  forceDiceValue?: number;
  lastActionSequenceId?: number;
  fullSync?: boolean;
  gameState?: any;
  missingSeqs?: number[];
  packets?: GameActionPacket[];
  nextActiveIndex?: number;
  isOffline?: boolean;
  timestamp?: number;
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
  currentSeq: number;
  actionRingBuffer: GameActionPacket[];
  processedClientActionIds: Set<string>;
  activePlayerIndex: number;
  turnTimer10?: NodeJS.Timeout | null;
  turnTimer20?: NodeJS.Timeout | null;
  turnTimer23?: NodeJS.Timeout | null;
  playerMissedTurns: Map<string, number>;
}

// Per-socket session tracking (works across lobby, auto-match, and rejoin)
const wsSessions = new WeakMap<WebSocket, { roomCode: string | null; playerId: string | null }>();

function getWsSession(ws: WebSocket): { roomCode: string | null; playerId: string | null } {
  return wsSessions.get(ws) || { roomCode: null, playerId: null };
}

function setWsSession(ws: WebSocket | undefined, roomCode: string | null, playerId: string | null) {
  if (!ws) return;
  wsSessions.set(ws, { roomCode, playerId });
}

// In-Memory Room Store
const rooms = new Map<string, RoomData>();

// --- RING BUFFER & RELAY TIMEOUT HELPERS ---
function pushActionToRingBuffer(room: RoomData, packet: any) {
  if (!room.actionRingBuffer) {
    room.actionRingBuffer = [];
  }
  room.actionRingBuffer.push(packet);
  if (room.actionRingBuffer.length > 100) {
    room.actionRingBuffer.shift(); // Keep latest 100 sequential packets for retransmission
  }
}

function createInitialGameState(room: RoomData) {
  return {
    mode: "ONLINE",
    gameStarted: true,
    winnerColor: null,
    rankings: [],
    activePlayerIndex: 0,
    diceQueue: [],
    diceRollCountThisTurn: 0,
    consecutiveSixesCount: 0,
    extraRollsCount: 0,
    isBonusRolling: false,
    safeDiceQueue: [],
    bonusConsecutiveSixesCount: 0,
    hasBustedThisTurn: false,
    selectedDiceValue: null,
    isTeamUpMode: room.isTeamUpMode,
    isHomeEntryLockEnabled: room.isHomeEntryLockEnabled,
    isTokenBlockEnabled: room.isTokenBlockEnabled,
    players: room.players.map((p, idx) => ({
      color: p.color,
      name: p.name,
      surname: p.surname || "",
      isBot: Boolean(p.isBot),
      isOffline: Boolean(p.isOffline),
      hasQuit: Boolean(p.hasQuit),
      hasKilledOpponent: false,
      tokens: [0, 1, 2, 3].map((id) => ({
        id,
        color: p.color,
        state: "BASE",
        position: -1,
      })),
      isActive: idx === 0,
      rollHistory: [],
      lastRolledValue: 6,
      turnsWithoutSix: 0,
    })),
    logs: [`🎮 Online Ludo Match Started with ${room.players.length} Warriors!`],
  };
}

function clearRoomTurnTimer(room: RoomData) {
  if (room.turnTimer10) {
    clearTimeout(room.turnTimer10);
    room.turnTimer10 = null;
  }
  if (room.turnTimer20) {
    clearTimeout(room.turnTimer20);
    room.turnTimer20 = null;
  }
  if (room.turnTimer23) {
    clearTimeout(room.turnTimer23);
    room.turnTimer23 = null;
  }
}

function startRoomTurnTimer(room: RoomData) {
  clearRoomTurnTimer(room);
  if (!room.gameStarted || room.winnerColor) return;

  const activeIndex = room.activePlayerIndex ?? 0;
  const activePlayer = room.players[activeIndex];
  if (!activePlayer) return;

  const isOffline = activePlayer.isOffline || activePlayer.hasQuit;

  if (isOffline) {
    // Fast 1s auto-skip for Offline/Quit players
    room.turnTimer23 = setTimeout(() => {
      advanceRoomTurnOnTimeout(room, activePlayer, true);
    }, 1000);
    return;
  }

  // 10s Silent Ping Check
  room.turnTimer10 = setTimeout(() => {
    if (activePlayer.ws && activePlayer.ws.readyState === WebSocket.OPEN) {
      try {
        activePlayer.ws.send(
          JSON.stringify({
            type: "TURN_PING",
            seq: room.currentSeq,
            timeElapsed: 10,
            secondsRemaining: 10,
          })
        );
      } catch (err) {}
    }
  }, 10000);

  // 20s Warning Ping Check
  room.turnTimer20 = setTimeout(() => {
    if (activePlayer.ws && activePlayer.ws.readyState === WebSocket.OPEN) {
      try {
        activePlayer.ws.send(
          JSON.stringify({
            type: "TURN_PING",
            seq: room.currentSeq,
            timeElapsed: 20,
            secondsRemaining: 2,
          })
        );
      } catch (err) {}
    }
  }, 20000);

  // 23s Authoritative Server Skip Buffer (20s client + 3s network grace margin)
  room.turnTimer23 = setTimeout(() => {
    advanceRoomTurnOnTimeout(room, activePlayer, false);
  }, 23000);
}

function handlePlayerDisconnectOrForfeit(room: RoomData, playerId: string, isPermanentLeave: boolean = false) {
  const p = room.players.find((player) => player.id === playerId);
  if (!p) return;

  p.isOffline = true;
  if (isPermanentLeave) {
    p.hasQuit = true;
  }

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

  // Check if game has started and winner is not already declared
  if (!room.gameStarted || room.winnerColor) {
    return;
  }

  // Count remaining active (not quit and not offline) players
  const activePlayers = room.players.filter((pl) => !pl.hasQuit && !pl.isOffline);

  // RULE: Winner is declared ONLY when exactly 1 active player remains in the match
  if (activePlayers.length === 1) {
    const winnerPlayer = activePlayers[0];
    room.winnerColor = winnerPlayer.color;
    clearRoomTurnTimer(room);

    // Synchronize game state with winner
    const updatedPlayers = room.players.map((pl) => {
      const existing = room.gameState?.players?.find((gp: any) => gp.color === pl.color);
      return {
        ...(existing || {
          color: pl.color,
          name: pl.name,
          tokens: [0, 1, 2, 3].map((id) => ({ id, color: pl.color, state: "BASE", position: -1 })),
        }),
        isOffline: Boolean(pl.isOffline),
        hasQuit: Boolean(pl.hasQuit),
      };
    });

    const winLog = `🏆 CONGRATULATIONS! ${winnerPlayer.name} is declared the WINNER as opponent disconnected / left the match!`;
    const existingLogs = Array.isArray(room.gameState?.logs) ? room.gameState.logs : [];

    room.gameState = {
      ...(room.gameState || {}),
      gameStarted: true,
      winnerColor: winnerPlayer.color,
      rankings: [winnerPlayer.color],
      players: updatedPlayers,
      logs: [winLog, ...existingLogs],
    };

    room.currentSeq = (room.currentSeq || 0) + 1;

    // 1. Send WINNER_DECLARED to the remaining player
    broadcastToRoom(room, {
      type: "WINNER_DECLARED",
      roomCode: room.code,
      winnerColor: winnerPlayer.color,
      winnerName: winnerPlayer.name,
      reason: "OPPONENT_OFFLINE",
      gameState: room.gameState,
      room: getSanitizedRoom(room),
    });

    // 2. Send SYNC_GAME_STATE so all client state synchronizes seamlessly
    broadcastToRoom(room, {
      type: "SYNC_GAME_STATE",
      roomCode: room.code,
      seq: room.currentSeq,
      gameState: room.gameState,
    });

    // 3. Send ROOM_UPDATED
    broadcastToRoom(room, {
      type: "ROOM_UPDATED",
      room: getSanitizedRoom(room),
    });

    // 4. Server Room Deletion strictly AFTER Winner Declaration:
    setTimeout(() => {
      if (rooms.has(room.code)) {
        clearRoomTurnTimer(room);
        rooms.delete(room.code);
      }
    }, 5000);
  } else if (activePlayers.length === 0) {
    // All players left -> delete room immediately
    clearRoomTurnTimer(room);
    rooms.delete(room.code);
  } else {
    // 2 or more active players remain in match! Match continues seamlessly!
    // If the player who just left/went offline was the current active player, immediately advance turn to next active player
    const currentActivePlayer = room.players[room.activePlayerIndex];
    if (currentActivePlayer && currentActivePlayer.id === playerId) {
      clearRoomTurnTimer(room);
      advanceRoomTurnOnTimeout(room, currentActivePlayer, true);
    }
  }
}

function advanceRoomTurnOnTimeout(room: RoomData, activePlayer: RoomPlayer, isAlreadyOffline: boolean) {
  clearRoomTurnTimer(room);
  if (!room.gameStarted || room.winnerColor) return;

  if (!isAlreadyOffline) {
    const currentMisses = (room.playerMissedTurns.get(activePlayer.id) || 0) + 1;
    room.playerMissedTurns.set(activePlayer.id, currentMisses);

    if (currentMisses >= 3) {
      handlePlayerDisconnectOrForfeit(room, activePlayer.id, false);
      // handlePlayerDisconnectOrForfeit already declares a winner or advances the active player's turn
      return;
    }
  }

  // Find next active & eligible player (skip quit players, and skip all-HOME players unless Team Up teammate still has tokens)
  const getTeammateColor = (c: string) => {
    if (c === "RED") return "YELLOW";
    if (c === "YELLOW") return "RED";
    if (c === "GREEN") return "BLUE";
    if (c === "BLUE") return "GREEN";
    return c;
  };
  const statePlayers: any[] = Array.isArray(room.gameState?.players) ? room.gameState.players : [];
  const isTeamUpMode = Boolean(room.isTeamUpMode || room.gameState?.isTeamUpMode);

  let nextIndex = (room.activePlayerIndex + 1) % room.players.length;
  let attempts = 0;
  while (attempts < room.players.length) {
    const candidate = room.players[nextIndex];
    if (candidate && !candidate.hasQuit) {
      const stateCandidate = statePlayers.find((sp) => sp.color === candidate.color);
      const allHome = stateCandidate && Array.isArray(stateCandidate.tokens)
        ? stateCandidate.tokens.every((t: any) => t.state === "HOME")
        : false;
      if (!allHome) {
        break;
      }
      if (isTeamUpMode) {
        const tmColor = getTeammateColor(candidate.color);
        const tmState = statePlayers.find((sp) => sp.color === tmColor);
        const tmAllHome = tmState && Array.isArray(tmState.tokens)
          ? tmState.tokens.every((t: any) => t.state === "HOME")
          : true;
        if (!tmAllHome) {
          break;
        }
      }
    }
    nextIndex = (nextIndex + 1) % room.players.length;
    attempts++;
  }

  room.activePlayerIndex = nextIndex;
  room.currentSeq = (room.currentSeq || 0) + 1;

  const skipPacket: GameActionPacket = {
    seq: room.currentSeq,
    type: "TURN_TIMEOUT_SKIP",
    roomCode: room.code,
    playerId: activePlayer.id,
    color: activePlayer.color,
    nextActiveIndex: nextIndex,
    isOffline: activePlayer.isOffline,
    timestamp: Date.now(),
  };

  pushActionToRingBuffer(room, skipPacket);
  broadcastToRoom(room, skipPacket);

  // Start timer for the next active player
  startRoomTurnTimer(room);
}

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

  // Case 1: 1 Player Only (60s timer elapsed with no real opponent)
  // ZERO SERVER LOAD CLIENT-SIDE BOT: No room created, no socket timers, no server state syncing.
  if (batch.length === 1) {
    const singlePlayer = batch[0];
    const assignedOpponentNames = getRandomOpponentNames(1, [singlePlayer.playerName]);
    const opponentName = assignedOpponentNames[0] || "Oliver";

    if (singlePlayer.ws && singlePlayer.ws.readyState === WebSocket.OPEN) {
      try {
        singlePlayer.ws.send(
          JSON.stringify({
            type: "START_LOCAL_VIRTUAL_MATCH",
            yourColor: "RED",
            opponent: {
              name: opponentName,
              color: "YELLOW",
            },
          })
        );
      } catch (err) {
        console.error("[WS] Error sending START_LOCAL_VIRTUAL_MATCH:", err);
      }
    }
    return;
  }

  // Case 2: 2, 3, or 4 Real Players Found!
  // Start 100% Real Online Multiplayer Game with strictly real players - ZERO BOTS ADDED!
  const realCount = batch.length;
  const roomCode = generateRoomCode();

  // Color assignments:
  // 2 players -> RED, YELLOW (opposite corners for classic 2-player board)
  // 3 players -> RED, GREEN, YELLOW
  // 4 players -> RED, GREEN, YELLOW, BLUE
  let assignedColors: PlayerColor[] = COLOR_ORDER_2_PLAYERS;
  if (realCount === 3) {
    assignedColors = COLOR_ORDER_3_PLAYERS;
  } else if (realCount >= 4) {
    assignedColors = COLOR_ORDER_4_PLAYERS;
  }

  const roomPlayers: RoomPlayer[] = batch.map((qp, idx) => ({
    id: qp.playerId,
    name: qp.playerName || `Player ${idx + 1}`,
    surname: qp.playerSurname || "",
    color: assignedColors[idx],
    isCreator: idx === 0,
    isBot: false,
    ws: qp.ws,
  }));

  const newRoom: RoomData = {
    code: roomCode,
    hostId: roomPlayers[0].id,
    players: roomPlayers,
    isTeamUpMode: false,
    isHomeEntryLockEnabled: true,
    isTokenBlockEnabled: true,
    gameStarted: true,
    createdAt: Date.now(),
    currentSeq: 0,
    actionRingBuffer: [],
    processedClientActionIds: new Set(),
    activePlayerIndex: 0,
    playerMissedTurns: new Map(),
  };
  newRoom.gameState = createInitialGameState(newRoom);

  rooms.set(roomCode, newRoom);

  // Bind every matched player's socket session to this room so disconnect/leave works cleanly
  for (const qp of batch) {
    setWsSession(qp.ws, roomCode, qp.playerId);
  }

  const sanitized = getSanitizedRoom(newRoom);
  broadcastToRoom(newRoom, {
    type: "GAME_STARTED",
    room: sanitized,
    isAutoMatch: true,
    realCount,
  });

  // Start turn timer for first active player
  startRoomTurnTimer(newRoom);
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

      // 60 seconds finished -> Launch match with available real players (2/3 players = no bots; 1 player = 1v1 Play with Bot)
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

// Color assignment constants (consistent clockwise board seat order)
const COLOR_ORDER_2_PLAYERS: PlayerColor[] = ["RED", "YELLOW"];
const COLOR_ORDER_3_PLAYERS: PlayerColor[] = ["RED", "GREEN", "YELLOW"];
const COLOR_ORDER_4_PLAYERS: PlayerColor[] = ["RED", "GREEN", "YELLOW", "BLUE"];

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
    currentSeq: room.currentSeq,
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
  const portArgIndex = process.argv.lastIndexOf("--port");
  const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : null;
  const envPort =
    process.env.PORT && (!process.env.NGINX_PORT || process.env.PORT !== process.env.NGINX_PORT)
      ? parseInt(process.env.PORT, 10)
      : null;
  const defaultPort = process.env.DEFAULT_APP_PORT ? parseInt(process.env.DEFAULT_APP_PORT, 10) : 3000;
  const PORT = (cliPort && !Number.isNaN(cliPort)) ? cliPort : (envPort && !Number.isNaN(envPort) ? envPort : defaultPort);

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

  // Server Info endpoint
  app.get("/api/info", (_req, res) => {
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
      latestVersion: "1.0.3",
      minSupportedVersion: "1.0.3",
      minRequiredVersion: "1.0.3",
      versionCode: 4,
      minVersionCode: 4,
      updateUrl: "https://strategizestudio-commits.github.io/ludo-strategize/",
      playStoreUrl: "https://strategizestudio-commits.github.io/ludo-strategize/",
      appStoreUrl: "https://strategizestudio-commits.github.io/ludo-strategize/",
      releaseNotes: "Optimized online multiplayer and security enhancements",
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

  // REST endpoint to leave/forfeit an active match
  app.post("/api/player-leave-match", (req, res) => {
    const { playerId, roomCode } = req.body || {};
    if (!playerId) {
      return res.status(400).json({ error: "Missing playerId" });
    }
    for (const [code, room] of rooms.entries()) {
      if (roomCode && code !== String(roomCode).toUpperCase()) continue;
      const p = room.players.find((player) => player.id === playerId);
      if (p) {
        if (!room.gameStarted) {
          room.players = room.players.filter((pl) => pl.id !== playerId);
          if (room.players.length === 0) {
            rooms.delete(code);
          } else {
            if (room.hostId === playerId) {
              room.hostId = room.players[0].id;
              room.players[0].isCreator = true;
            }
            broadcastToRoom(room, {
              type: "ROOM_UPDATED",
              room: getSanitizedRoom(room),
            });
          }
        } else {
          handlePlayerDisconnectOrForfeit(room, playerId, true);
        }
      }
    }
    return res.json({ success: true });
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
    setWsSession(ws, null, null);

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
          const { playerId, playerName, playerSurname } = data;
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
            joinedAt: Date.now(),
          };

          activeQueue.push(queuePlayer);
          setWsSession(ws, null, playerId);

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
            isTeamUpMode = false,
            isHomeEntryLockEnabled = true,
            isTokenBlockEnabled = true,
          } = data;

          if (!playerId) return;

          const code = generateRoomCode();
          const hostPlayer: RoomPlayer = {
            id: playerId,
            name: playerName || "Host",
            surname: playerSurname || "",
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
            currentSeq: 0,
            actionRingBuffer: [],
            processedClientActionIds: new Set(),
            activePlayerIndex: 0,
            playerMissedTurns: new Map(),
          };

          rooms.set(code, newRoom);
          setWsSession(ws, code, playerId);

          const sanitized = getSanitizedRoom(newRoom);
          ws.send(
            JSON.stringify({
              type: "ROOM_CREATED",
              room: sanitized,
              yourColor: "RED",
            })
          );
          return;
        }

        // 2. JOIN_ROOM
        if (type === "JOIN_ROOM") {
          const { roomCode, playerId, playerName, playerSurname } = data;
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
            setWsSession(ws, code, playerId);

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
            availableColor = COLOR_ORDER_4_PLAYERS.find((c) => !takenColors.includes(c)) || "GREEN";
          }

          const newPlayer: RoomPlayer = {
            id: playerId,
            name: playerName || `Player ${room.players.length + 1}`,
            surname: playerSurname || "",
            color: availableColor,
            isCreator: false,
            ws,
          };

          room.players.push(newPlayer);
          setWsSession(ws, code, playerId);

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

          // Preserve distinct valid colors configured in lobby (including ROTATE_PLAYERS);
          // only repair if any color is missing or duplicated.
          const expectedColors =
            room.players.length === 2
              ? COLOR_ORDER_2_PLAYERS
              : room.players.length === 3
                ? COLOR_ORDER_3_PLAYERS
                : COLOR_ORDER_4_PLAYERS;
          const currentColors = room.players.map((p) => p.color);
          const hasUniqueValidColors =
            new Set(currentColors).size === room.players.length &&
            currentColors.every((c) => expectedColors.includes(c));
          if (!hasUniqueValidColors) {
            room.players.forEach((p, idx) => {
              p.color = expectedColors[idx] || COLOR_ORDER_4_PLAYERS[idx];
            });
          }

          room.gameStarted = true;
          room.currentSeq = 0;
          room.actionRingBuffer = [];
          room.processedClientActionIds = new Set();
          room.activePlayerIndex = 0;
          room.playerMissedTurns = new Map();
          room.gameState = createInitialGameState(room);

          const sanitized = getSanitizedRoom(room);

          broadcastToRoom(room, {
            type: "GAME_STARTED",
            room: sanitized,
          });

          // Start authoritative 23s turn timer for the initial active player
          startRoomTurnTimer(room);
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
                    currentSeq: room.currentSeq,
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
          if (!room || !room.gameStarted || room.winnerColor) {
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
          room.playerMissedTurns.set(playerId, 0);
          setWsSession(ws, code, playerId);

          const sanitized = getSanitizedRoom(room);
          ws.send(
            JSON.stringify({
              type: "REJOIN_SUCCESS",
              room: sanitized,
              yourColor: player.color,
              currentSeq: room.currentSeq,
              gameState: room.gameState || createInitialGameState(room),
            })
          );

          broadcastToRoom(room, {
            type: "PLAYER_RECONNECTED",
            playerId: player.id,
            color: player.color,
            name: player.name,
            room: sanitized,
          });
          return;
        }

        // 8. FORFEIT_MATCH / forfeit_match / LEAVE_MATCH
        if (type === "FORFEIT_MATCH" || type === "forfeit_match" || type === "LEAVE_MATCH") {
          const session = getWsSession(ws);
          const targetCode = (data.roomCode || session.roomCode || "").toUpperCase();
          const targetPlayerId = data.playerId || session.playerId;
          if (targetCode && targetPlayerId) {
            const room = rooms.get(targetCode);
            if (room && room.gameStarted) {
              handlePlayerDisconnectOrForfeit(room, targetPlayerId, true);
            }
          }
          if (session.roomCode === targetCode) {
            setWsSession(ws, null, session.playerId);
          }
          return;
        }

        // 8.5 INDEPENDENT REAL-TIME GIFT CHANNEL
        if (type === "GIFT_EVENT" || type === "SEND_GIFT_EVENT" || type === "SEND_GIFT") {
          const { roomCode, giftId, senderColor, receiverColor, senderPlayerId, timestamp } = data;
          if (!roomCode) return;
          const room = rooms.get(roomCode.toUpperCase());
          if (!room) return;

          broadcastToRoom(room, {
            type: "GIFT_EVENT",
            roomCode,
            giftId,
            senderColor,
            receiverColor,
            senderPlayerId,
            timestamp: timestamp || Date.now(),
          });
          return;
        }

        // 9. EVENT-BASED RELAY ARCHITECTURE (Server-Authoritative Sequence Numbering)
        if (
          type === "ROLL_DICE" ||
          type === "MOVE_PAWN" ||
          type === "TURN_TIMEOUT_SKIP" ||
          type === "FULL_BOARD_STATE" ||
          type === "SYNC_GAME_STATE" ||
          type === "GAME_ACTION"
        ) {
          const { roomCode, playerId, gameState, clientActionId } = data;
          if (!roomCode) return;
          const room = rooms.get(roomCode.toUpperCase());
          if (!room || room.winnerColor) return;

          // Deduplicate retries carrying the same clientActionId
          if (typeof clientActionId === "string" && clientActionId.length > 0) {
            if (!room.processedClientActionIds) {
              room.processedClientActionIds = new Set();
            }
            if (room.processedClientActionIds.has(clientActionId)) {
              return;
            }
            room.processedClientActionIds.add(clientActionId);
            if (room.processedClientActionIds.size > 200) {
              const firstKey = room.processedClientActionIds.values().next().value;
              if (firstKey) room.processedClientActionIds.delete(firstKey);
            }
          }

          // Reset missed turn strikes for active player on valid action
          if (playerId) {
            room.playerMissedTurns.set(playerId, 0);
          }

          // Strict server-authoritative monotonic sequence number (eliminates multi-client seq collision)
          room.currentSeq = (room.currentSeq || 0) + 1;
          data.seq = room.currentSeq;
          if (type === "FULL_BOARD_STATE" || type === "SYNC_GAME_STATE") {
            data.lastActionSequenceId = room.currentSeq;
          }
          data.timestamp = Date.now();

          // Update authoritative room.gameState cache on full-state syncs (avoid stale pre-roll snapshots)
          if (gameState && (type === "FULL_BOARD_STATE" || type === "SYNC_GAME_STATE" || type === "GAME_ACTION" || !room.gameState)) {
            room.gameState = gameState;
            if (gameState.winnerColor) {
              room.winnerColor = gameState.winnerColor;
              clearRoomTurnTimer(room);
              setTimeout(() => {
                if (rooms.has(room.code)) {
                  clearRoomTurnTimer(room);
                  rooms.delete(room.code);
                }
              }, 5000);
            } else if (typeof gameState.activePlayerIndex === "number") {
              room.activePlayerIndex = gameState.activePlayerIndex;
              startRoomTurnTimer(room);
            }
          } else if (type === "TURN_TIMEOUT_SKIP" && typeof data.nextActiveIndex === "number") {
            room.activePlayerIndex = data.nextActiveIndex;
            if (room.gameState) {
              room.gameState.activePlayerIndex = data.nextActiveIndex;
            }
            startRoomTurnTimer(room);
          } else if (type === "ROLL_DICE" || type === "MOVE_PAWN") {
            // Keep server turn timer aligned with active player's per-phase 20s client timer
            startRoomTurnTimer(room);
          }

          // Push into 100-packet ring buffer
          pushActionToRingBuffer(room, data);

          // Relay action packet to all clients in the room
          broadcastToRoom(room, data);
          return;
        }

        // 10. FETCH_SEQ / RESEND_SEQ (Retransmission & full-sync recovery for missing packets)
        if (type === "FETCH_SEQ" || type === "fetch_seq") {
          const { roomCode, missingSeqs } = data;
          if (!roomCode || !Array.isArray(missingSeqs) || missingSeqs.length === 0) return;
          const room = rooms.get(roomCode.toUpperCase());
          if (!room) return;

          const buffer = room.actionRingBuffer || [];
          const foundPackets = buffer.filter((p) => missingSeqs.includes(p.seq));

          // Check if client is asking for past seqs already evicted from ring buffer
          const oldestBufferedSeq = buffer.length > 0 ? buffer[0].seq : room.currentSeq + 1;
          const hasEvictedMissingSeq = missingSeqs.some(
            (s: number) => typeof s === "number" && s <= room.currentSeq && s < oldestBufferedSeq && !foundPackets.some((fp) => fp.seq === s)
          );

          if (hasEvictedMissingSeq && room.gameState) {
            ws.send(
              JSON.stringify({
                type: "SYNC_GAME_STATE",
                roomCode: room.code,
                seq: room.currentSeq,
                lastActionSequenceId: room.currentSeq,
                fullSync: true,
                gameState: room.gameState,
              })
            );
            return;
          }

          ws.send(
            JSON.stringify({
              type: "RESEND_SEQ",
              roomCode: room.code,
              packets: foundPackets,
            })
          );
          return;
        }

        // 11. LEAVE_ROOM / leave_lobby
        if (type === "LEAVE_ROOM" || type === "leave_lobby") {
          const session = getWsSession(ws);
          const targetCode = (data.roomCode || session.roomCode || "").toUpperCase();
          const targetPlayerId = data.playerId || session.playerId;
          if (targetCode && targetPlayerId) {
            const room = rooms.get(targetCode);
            if (room) {
              if (!room.gameStarted) {
                room.players = room.players.filter((p) => p.id !== targetPlayerId);
                if (room.players.length === 0) {
                  rooms.delete(targetCode);
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
                handlePlayerDisconnectOrForfeit(room, targetPlayerId, true);
              }
            }
          }
          setWsSession(ws, null, session.playerId);
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

      // 2. Room handling on disconnect using WeakMap session (works for auto-match too)
      const session = getWsSession(ws);
      if (session.roomCode && session.playerId) {
        const room = rooms.get(session.roomCode);
        if (room) {
          const targetPlayer = room.players.find((p) => p.id === session.playerId);
          // Guard against stale-socket close after rapid reconnect: only handle if this ws is still the player's active socket
          if (targetPlayer && targetPlayer.ws && targetPlayer.ws !== ws) {
            return;
          }

          if (!room.gameStarted) {
            room.players = room.players.filter((p) => p.id !== session.playerId);
            if (room.players.length === 0) {
              rooms.delete(session.roomCode);
            } else {
              if (room.hostId === session.playerId) {
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
            handlePlayerDisconnectOrForfeit(room, session.playerId, false);
          }
        }
      }
    });
  });

  // Serve public assets (l.jpg, logo.svg, etc.) directly
  const publicPath = path.join(process.cwd(), "public");
  app.use(express.static(publicPath));

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
