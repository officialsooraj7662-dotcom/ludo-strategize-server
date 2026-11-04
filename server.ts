/**
 * STANDALONE LUDO MULTIPLAYER SOCKET.IO & HTTP SERVER
 */
import express from "express";
import http from "http";
import path from "path";
import { Server, Socket } from "socket.io";

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
  socketId?: string;
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
  createdAt: number;
}

export interface GameActionPacket {
  seq: number;
  type: string;
  roomCode: string;
  playerId?: string;
  color?: PlayerColor;
  rollValue?: number;
  tokenId?: number;
  forceDiceValue?: number;
  lastActionSequenceId?: number;
  gameState?: any;
  missingSeqs?: number[];
  packets?: GameActionPacket[];
  nextActiveIndex?: number;
  isOffline?: boolean;
  timestamp?: number;
  giftId?: string;
  senderColor?: PlayerColor;
  receiverColor?: PlayerColor;
  turnsWithoutSix?: number;
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
  activePlayerIndex: number;
  turnTimer10?: NodeJS.Timeout | null;
  turnTimer20?: NodeJS.Timeout | null;
  turnTimer23?: NodeJS.Timeout | null;
  playerMissedTurns: Map<string, number>;
}

const rooms = new Map<string, RoomData>();

function pushActionToRingBuffer(room: RoomData, packet: GameActionPacket) {
  if (!room.actionRingBuffer) {
    room.actionRingBuffer = [];
  }
  room.actionRingBuffer.push(packet);
  if (room.actionRingBuffer.length > 10) {
    room.actionRingBuffer.shift();
  }
}

function clearRoomTurnTimer(room: RoomData) {
  if (room.turnTimer10) { clearTimeout(room.turnTimer10); room.turnTimer10 = null; }
  if (room.turnTimer20) { clearTimeout(room.turnTimer20); room.turnTimer20 = null; }
  if (room.turnTimer23) { clearTimeout(room.turnTimer23); room.turnTimer23 = null; }
}

function startRoomTurnTimer(io: Server, room: RoomData) {
  clearRoomTurnTimer(room);
  if (!room.gameStarted || room.winnerColor) return;
  const activeIndex = room.activePlayerIndex ?? 0;
  const activePlayer = room.players[activeIndex];
  if (!activePlayer) return;
  const isOffline = activePlayer.isOffline || activePlayer.hasQuit;
  if (isOffline) {
    room.turnTimer23 = setTimeout(() => {
      advanceRoomTurnOnTimeout(io, room, activePlayer, true);
    }, 1000);
    return;
  }
  room.turnTimer10 = setTimeout(() => {
    if (activePlayer.socketId) {
      io.to(activePlayer.socketId).emit("message", {
        type: "TURN_PING",
        seq: room.currentSeq,
        timeElapsed: 10,
      });
    }
  }, 10000);
  room.turnTimer20 = setTimeout(() => {
    if (activePlayer.socketId) {
      io.to(activePlayer.socketId).emit("message", {
        type: "TURN_PING",
        seq: room.currentSeq,
        timeElapsed: 20,
      });
    }
  }, 20000);
  room.turnTimer23 = setTimeout(() => {
    advanceRoomTurnOnTimeout(io, room, activePlayer, false);
  }, 23000);
}

function broadcastToRoom(io: Server, room: RoomData, message: object) {
  io.to(room.code).emit("message", message);
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
    createdAt: room.createdAt,
  };
}

function handlePlayerDisconnectOrForfeit(io: Server, room: RoomData, playerId: string, isPermanentLeave: boolean = false) {
  const p = room.players.find((player) => player.id === playerId);
  if (!p) return;
  p.isOffline = true;
  if (isPermanentLeave) {
    p.hasQuit = true;
  }
  const sanitized = getSanitizedRoom(room);
  broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: sanitized });
  broadcastToRoom(io, room, { type: "PLAYER_OFFLINE", playerId: p.id, color: p.color, name: p.name, room: sanitized });

  if (!room.gameStarted || room.winnerColor) return;

  const activePlayers = room.players.filter((pl) => !pl.hasQuit && !pl.isOffline);
  if (activePlayers.length === 1) {
    const winnerPlayer = activePlayers[0];
    room.winnerColor = winnerPlayer.color;
    clearRoomTurnTimer(room);
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
    const winLog = `👑 CONGRATULATIONS! ${winnerPlayer.name} is declared the WINNER as opponent disconnected / left the match!`;
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

    broadcastToRoom(io, room, {
      type: "WINNER_DECLARED",
      roomCode: room.code,
      winnerColor: winnerPlayer.color,
      winnerName: winnerPlayer.name,
      reason: "OPPONENT_OFFLINE",
      gameState: room.gameState,
      room: getSanitizedRoom(room),
    });
    broadcastToRoom(io, room, {
      type: "SYNC_GAME_STATE",
      roomCode: room.code,
      seq: room.currentSeq,
      gameState: room.gameState,
    });
    broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: getSanitizedRoom(room) });

    setTimeout(() => {
      if (rooms.has(room.code)) {
        clearRoomTurnTimer(room);
        rooms.delete(room.code);
      }
    }, 5000);
  } else if (activePlayers.length === 0) {
    clearRoomTurnTimer(room);
    rooms.delete(room.code);
  } else {
    const currentActivePlayer = room.players[room.activePlayerIndex];
    if (currentActivePlayer && currentActivePlayer.id === playerId) {
      clearRoomTurnTimer(room);
      advanceRoomTurnOnTimeout(io, room, currentActivePlayer, true);
    }
  }
}

function advanceRoomTurnOnTimeout(io: Server, room: RoomData, activePlayer: RoomPlayer, isAlreadyOffline: boolean) {
  clearRoomTurnTimer(room);
  if (!room.gameStarted || room.winnerColor) return;
  if (!isAlreadyOffline) {
    const currentMisses = (room.playerMissedTurns.get(activePlayer.id) || 0) + 1;
    room.playerMissedTurns.set(activePlayer.id, currentMisses);
    if (currentMisses >= 3) {
      handlePlayerDisconnectOrForfeit(io, room, activePlayer.id, false);
      if (room.winnerColor) return;
    }
  }
  let nextIndex = (room.activePlayerIndex + 1) % room.players.length;
  let attempts = 0;
  while (attempts < room.players.length) {
    const candidate = room.players[nextIndex];
    if (candidate && !candidate.hasQuit) break;
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
  broadcastToRoom(io, room, skipPacket);
  startRoomTurnTimer(io, room);
}

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

function getRandomOpponentNames(count: number, excludeNames: string[] = []): string[] {
  const available = OPPONENT_NAMES.filter((n) => !excludeNames.includes(n));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = available[i];
    available[i] = available[j];
    available[j] = temp;
  }
  return available.slice(0, count);
}

interface QueuePlayer {
  socketId: string;
  socket: Socket;
  playerId: string;
  playerName: string;
  playerSurname?: string;
  joinedAt: number;
}

let activeQueue: QueuePlayer[] = [];
let matchmakingTimerInterval: NodeJS.Timeout | null = null;
let matchmakingCountdown = 60;
const MATCHMAKING_TIMEOUT = 60;

function broadcastQueueUpdate(io: Server) {
  const payload = {
    type: "QUEUE_UPDATE",
    count: activeQueue.length,
    timeLeft: matchmakingCountdown,
    totalTime: MATCHMAKING_TIMEOUT,
    players: activeQueue.map((qp, idx) => ({
      id: qp.playerId,
      name: qp.playerName || `Player ${idx + 1}`,
      surname: qp.playerSurname || "",
    })),
  };
  for (const qp of activeQueue) {
    io.to(qp.socketId).emit("message", payload);
  }
}

const COLOR_ORDER_2_PLAYERS: PlayerColor[] = ["RED", "YELLOW"];
const COLOR_ORDER_3_PLAYERS: PlayerColor[] = ["RED", "YELLOW", "GREEN"];
const COLOR_ORDER_4_PLAYERS: PlayerColor[] = ["RED", "YELLOW", "GREEN", "BLUE"];

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function launchAutoMatch(io: Server, batch: QueuePlayer[]) {
  if (batch.length === 0) return;
  if (batch.length === 1) {
    const singlePlayer = batch[0];
    const assignedOpponentNames = getRandomOpponentNames(1, [singlePlayer.playerName]);
    const opponentName = assignedOpponentNames[0] || "Oliver";
    singlePlayer.socket.emit("message", {
      type: "START_LOCAL_VIRTUAL_MATCH",
      yourColor: "RED",
      opponent: { name: opponentName, color: "YELLOW" },
    });
    return;
  }

  const realCount = batch.length;
  const roomCode = generateRoomCode();
  let assignedColors: PlayerColor[] = COLOR_ORDER_2_PLAYERS;
  if (realCount === 3) assignedColors = COLOR_ORDER_3_PLAYERS;
  else if (realCount >= 4) assignedColors = COLOR_ORDER_4_PLAYERS;

  const roomPlayers: RoomPlayer[] = batch.map((qp, idx) => ({
    id: qp.playerId,
    name: qp.playerName || `Player ${idx + 1}`,
    surname: qp.playerSurname || "",
    color: assignedColors[idx],
    isCreator: idx === 0,
    isBot: false,
    socketId: qp.socketId,
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
    activePlayerIndex: 0,
    playerMissedTurns: new Map(),
  };

  rooms.set(roomCode, newRoom);
  batch.forEach(qp => qp.socket.join(roomCode));

  const sanitized = getSanitizedRoom(newRoom);
  broadcastToRoom(io, newRoom, { type: "GAME_STARTED", room: sanitized, isAutoMatch: true, realCount });
  startRoomTurnTimer(io, newRoom);
}

function startMatchmakingTimer(io: Server) {
  if (matchmakingTimerInterval) return;
  matchmakingCountdown = MATCHMAKING_TIMEOUT;
  broadcastQueueUpdate(io);
  matchmakingTimerInterval = setInterval(() => {
    matchmakingCountdown -= 1;
    broadcastQueueUpdate(io);
    if (matchmakingCountdown <= 0) {
      if (matchmakingTimerInterval) {
        clearInterval(matchmakingTimerInterval);
        matchmakingTimerInterval = null;
      }
      if (activeQueue.length > 0) {
        const batch = activeQueue.splice(0, 4);
        launchAutoMatch(io, batch);
      }
      if (activeQueue.length > 0) {
        startMatchmakingTimer(io);
      } else {
        matchmakingCountdown = MATCHMAKING_TIMEOUT;
      }
    }
  }, 1000);
}

function stopMatchmakingTimerIfEmpty(io: Server) {
  if (activeQueue.length === 0 && matchmakingTimerInterval) {
    clearInterval(matchmakingTimerInterval);
    matchmakingTimerInterval = null;
    matchmakingCountdown = MATCHMAKING_TIMEOUT;
  }
}

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf("--port");
  const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : null;
  const PORT = cliPort || (process.env.NODE_ENV === "production" && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });
  app.use(express.json());

  app.get("/api/info", (_req, res) => {
    res.json({ service: "Ludo Multiplayer Socket.io Server", status: "running", activeRooms: rooms.size, uptime: process.uptime() });
  });
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", activeRooms: rooms.size });
  });
  app.get("/api/app-version", (_req, res) => {
    res.json({
      latestVersion: "1.0.1",
      minSupportedVersion: "1.0.1",
      minRequiredVersion: "1.0.1",
      updateUrl: "https://strategizestudio-commits.github.io/ludo-strategize/",
      releaseNotes: "Optimized online multiplayer with Socket.io",
    });
  });
  app.get("/api/rooms/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return res.status(404).json({ error: "Room not found" });
    return res.json(getSanitizedRoom(room));
  });
  app.get("/api/player-active-match/:playerId", (req, res) => {
    const { playerId } = req.params;
    if (!playerId) return res.json({ hasActiveMatch: false });
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
  app.post("/api/player-leave-match", (req, res) => {
    const { playerId, roomCode } = req.body || {};
    if (!playerId) return res.status(400).json({ error: "Missing playerId" });
    for (const [code, room] of rooms.entries()) {
      if (roomCode && code !== roomCode.toUpperCase()) continue;
      const p = room.players.find((player) => player.id === playerId);
      if (p) {
        handlePlayerDisconnectOrForfeit(io, room, playerId, true);
      }
    }
    return res.json({ success: true });
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket: Socket) => {
    let currentRoomCode: string | null = null;
    let currentPlayerId: string | null = null;

    socket.on("message", (raw) => {
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        const { type } = data;

        if (type === "PING") {
          socket.emit("message", { type: "PONG", time: Date.now() });
          return;
        }

        if (type === "JOIN_AUTO_QUEUE" || type === "join_auto_queue") {
          const { playerId, playerName, playerSurname } = data;
          if (!playerId) {
            socket.emit("message", { type: "ERROR", message: "Invalid player ID" });
            return;
          }
          activeQueue = activeQueue.filter((qp) => qp.playerId !== playerId && qp.socketId !== socket.id);
          const queuePlayer: QueuePlayer = {
            socketId: socket.id,
            socket,
            playerId,
            playerName: playerName || `Player`,
            playerSurname: playerSurname || "",
            joinedAt: Date.now(),
          };
          activeQueue.push(queuePlayer);
          currentPlayerId = playerId;

          if (activeQueue.length >= 4) {
            const batch = activeQueue.splice(0, 4);
            launchAutoMatch(io, batch);
            if (activeQueue.length === 0) {
              if (matchmakingTimerInterval) {
                clearInterval(matchmakingTimerInterval);
                matchmakingTimerInterval = null;
                matchmakingCountdown = MATCHMAKING_TIMEOUT;
              }
            } else {
              matchmakingCountdown = MATCHMAKING_TIMEOUT;
              broadcastQueueUpdate(io);
            }
          } else {
            startMatchmakingTimer(io);
            broadcastQueueUpdate(io);
          }
          return;
        }

        if (type === "LEAVE_AUTO_QUEUE" || type === "leave_auto_queue") {
          const { playerId } = data;
          activeQueue = activeQueue.filter((qp) => qp.socketId !== socket.id && (!playerId || qp.playerId !== playerId));
          stopMatchmakingTimerIfEmpty(io);
          broadcastQueueUpdate(io);
          return;
        }

        if (type === "CREATE_ROOM") {
          const { playerId, playerName, playerSurname, isTeamUpMode = false, isHomeEntryLockEnabled = true, isTokenBlockEnabled = true } = data;
          if (!playerId) return;
          const code = generateRoomCode();
          const hostPlayer: RoomPlayer = {
            id: playerId,
            name: playerName || "Host",
            surname: playerSurname || "",
            color: "RED",
            isCreator: true,
            socketId: socket.id,
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
            activePlayerIndex: 0,
            playerMissedTurns: new Map(),
          };
          rooms.set(code, newRoom);
          socket.join(code);
          currentRoomCode = code;
          currentPlayerId = playerId;

          socket.emit("message", {
            type: "ROOM_CREATED",
            room: getSanitizedRoom(newRoom),
            yourColor: "RED",
          });
          return;
        }

        if (type === "JOIN_ROOM") {
          const { roomCode, playerId, playerName, playerSurname } = data;
          if (!roomCode || !playerId) {
            socket.emit("message", { type: "ERROR", message: "Invalid room code or player ID" });
            return;
          }
          const code = roomCode.trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            socket.emit("message", { type: "ERROR", message: "Room not found. Check the 6-digit code." });
            return;
          }
          if (room.gameStarted) {
            socket.emit("message", { type: "ERROR", message: "Game already started in this room." });
            return;
          }

          const existingPlayer = room.players.find((p) => p.id === playerId);
          if (existingPlayer) {
            existingPlayer.socketId = socket.id;
            existingPlayer.name = playerName || existingPlayer.name;
            existingPlayer.surname = playerSurname || existingPlayer.surname;
            socket.join(code);
            currentRoomCode = code;
            currentPlayerId = playerId;
            const sanitized = getSanitizedRoom(room);
            broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: sanitized });
            socket.emit("message", { type: "JOIN_SUCCESS", room: sanitized, yourColor: existingPlayer.color });
            return;
          }

          if (room.players.length >= 4) {
            socket.emit("message", { type: "ERROR", message: "Room is already full (Max 4 Players)." });
            return;
          }

          let availableColor: PlayerColor = "YELLOW";
          if (room.players.length === 1) availableColor = "YELLOW";
          else if (room.players.length === 2) {
            room.players[0].color = "RED";
            room.players[1].color = "GREEN";
            availableColor = "YELLOW";
          } else if (room.players.length === 3) availableColor = "BLUE";
          else {
            const takenColors = room.players.map((p) => p.color);
            availableColor = COLOR_ORDER_4_PLAYERS.find((c) => !takenColors.includes(c)) || "GREEN";
          }

          const newPlayer: RoomPlayer = {
            id: playerId,
            name: playerName || `Player ${room.players.length + 1}`,
            surname: playerSurname || "",
            color: availableColor,
            isCreator: false,
            socketId: socket.id,
          };
          room.players.push(newPlayer);
          socket.join(code);
          currentRoomCode = code;
          currentPlayerId = playerId;

          const sanitized = getSanitizedRoom(room);
          broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: sanitized });
          socket.emit("message", { type: "JOIN_SUCCESS", room: sanitized, yourColor: availableColor });
          return;
        }

        if (type === "UPDATE_LOBBY_SETTINGS") {
          const { roomCode, playerId, isTeamUpMode, isHomeEntryLockEnabled, isTokenBlockEnabled } = data;
          const room = rooms.get(roomCode?.toUpperCase());
          if (!room || room.hostId !== playerId) return;
          if (isTeamUpMode !== undefined) room.isTeamUpMode = Boolean(isTeamUpMode);
          if (isHomeEntryLockEnabled !== undefined) room.isHomeEntryLockEnabled = Boolean(isHomeEntryLockEnabled);
          if (isTokenBlockEnabled !== undefined) room.isTokenBlockEnabled = Boolean(isTokenBlockEnabled);
          broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: getSanitizedRoom(room) });
          return;
        }

        if (type === "ROTATE_PLAYERS") {
          const { roomCode, playerId } = data;
          const room = rooms.get(roomCode?.toUpperCase());
          if (!room || room.hostId !== playerId || room.players.length < 2) return;
          const currentColors = room.players.map((p) => p.color);
          const rotatedColors = [currentColors[currentColors.length - 1], ...currentColors.slice(0, -1)];
          room.players.forEach((p, idx) => { p.color = rotatedColors[idx]; });
          broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: getSanitizedRoom(room) });
          return;
        }

        if (type === "START_GAME") {
          const { roomCode, playerId } = data;
          const room = rooms.get(roomCode?.toUpperCase());
          if (!room) { socket.emit("message", { type: "ERROR", message: "Room not found" }); return; }
          if (room.hostId !== playerId) { socket.emit("message", { type: "ERROR", message: "Only the host can start." }); return; }
          if (room.players.length < 2) { socket.emit("message", { type: "ERROR", message: "At least 2 players required." }); return; }

          if (room.players.length === 2) {
            room.players[0].color = "RED"; room.players[1].color = "YELLOW";
          } else if (room.players.length === 3) {
            room.players[0].color = "RED"; room.players[1].color = "GREEN"; room.players[2].color = "YELLOW";
          } else if (room.players.length >= 4) {
            room.players[0].color = "RED"; room.players[1].color = "GREEN"; room.players[2].color = "YELLOW"; room.players[3].color = "BLUE";
          }
          room.gameStarted = true;
          room.currentSeq = 0;
          room.actionRingBuffer = [];
          room.activePlayerIndex = 0;
          room.playerMissedTurns = new Map();

          broadcastToRoom(io, room, { type: "GAME_STARTED", room: getSanitizedRoom(room) });
          startRoomTurnTimer(io, room);
          return;
        }

        if (type === "CHECK_ACTIVE_MATCH" || type === "check_active_match") {
          const { playerId } = data;
          if (!playerId) { socket.emit("message", { type: "NO_ACTIVE_MATCH" }); return; }
          let found = false;
          for (const [code, room] of rooms.entries()) {
            if (room.gameStarted && !room.winnerColor) {
              const p = room.players.find((player) => player.id === playerId && !player.hasQuit);
              if (p) {
                found = true;
                socket.emit("message", {
                  type: "ACTIVE_MATCH_FOUND",
                  roomCode: code,
                  yourColor: p.color,
                  room: getSanitizedRoom(room),
                  gameState: room.gameState,
                });
                break;
              }
            }
          }
          if (!found) socket.emit("message", { type: "NO_ACTIVE_MATCH" });
          return;
        }

        if (type === "REJOIN_MATCH" || type === "rejoin_match") {
          const { roomCode, playerId, playerName } = data;
          if (!roomCode || !playerId) return;
          const code = roomCode.trim().toUpperCase();
          const room = rooms.get(code);
          if (!room || !room.gameStarted) return;
          const player = room.players.find((p) => p.id === playerId);
          if (!player) return;

          player.socketId = socket.id;
          player.isOffline = false;
          player.hasQuit = false;
          if (playerName) player.name = playerName;
          socket.join(code);
          currentRoomCode = code;
          currentPlayerId = playerId;

          const sanitized = getSanitizedRoom(room);
          socket.emit("message", { type: "REJOIN_SUCCESS", room: sanitized, yourColor: player.color, gameState: room.gameState });
          broadcastToRoom(io, room, { type: "PLAYER_RECONNECTED", playerId: player.id, color: player.color, name: player.name, room: sanitized });
          return;
        }

        if (type === "FORFEIT_MATCH" || type === "forfeit_match" || type === "LEAVE_MATCH") {
          const targetCode = data.roomCode || currentRoomCode;
          const targetPlayerId = data.playerId || currentPlayerId;
          if (targetCode && targetPlayerId) {
            const room = rooms.get(targetCode.toUpperCase());
            if (room && room.gameStarted) {
              handlePlayerDisconnectOrForfeit(io, room, targetPlayerId, true);
            }
          }
          return;
        }

        if (type === "GIFT_EVENT" || type === "SEND_GIFT_EVENT" || type === "SEND_GIFT") {
          const { roomCode, giftId, senderColor, receiverColor, senderPlayerId, timestamp } = data;
          if (!roomCode) return;
          const room = rooms.get(roomCode.toUpperCase());
          if (!room) return;
          broadcastToRoom(io, room, {
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

        if (type === "ROLL_DICE" || type === "MOVE_PAWN" || type === "FULL_BOARD_STATE" || type === "SYNC_GAME_STATE" || type === "GAME_ACTION") {
          const { roomCode, playerId, gameState, seq } = data;
          if (!roomCode) return;
          const room = rooms.get(roomCode.toUpperCase());
          if (!room) return;
          if (playerId) room.playerMissedTurns.set(playerId, 0);

          if (typeof seq === "number" && seq > (room.currentSeq || 0)) {
            room.currentSeq = seq;
          } else if (!data.seq) {
            data.seq = ++room.currentSeq;
          }
          data.timestamp = Date.now();

          if (gameState) {
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
              if (gameState.activePlayerIndex !== room.activePlayerIndex) {
                room.activePlayerIndex = gameState.activePlayerIndex;
                startRoomTurnTimer(io, room);
              }
            }
          }

          pushActionToRingBuffer(room, data);
          broadcastToRoom(io, room, data);
          return;
        }

        if (type === "FETCH_SEQ" || type === "fetch_seq") {
          const { roomCode, missingSeqs } = data;
          if (!roomCode || !Array.isArray(missingSeqs)) return;
          const room = rooms.get(roomCode.toUpperCase());
          if (!room) return;
          // Send authoritative full board state snapshot for instant sequence reconciliation
          socket.emit("message", {
            type: "FULL_BOARD_STATE",
            roomCode,
            seq: room.currentSeq,
            lastActionSequenceId: room.currentSeq,
            gameState: room.gameState,
          });
          const foundPackets = (room.actionRingBuffer || []).filter((p) => missingSeqs.includes(p.seq));
          socket.emit("message", { type: "RESEND_SEQ", roomCode, packets: foundPackets });
          return;
        }

        if (type === "LEAVE_ROOM" || type === "leave_lobby") {
          const targetCode = data.roomCode || currentRoomCode;
          const targetPlayerId = data.playerId || currentPlayerId;
          if (targetCode && targetPlayerId) {
            const room = rooms.get(targetCode.toUpperCase());
            if (room) {
              if (!room.gameStarted) {
                room.players = room.players.filter((p) => p.id !== targetPlayerId);
                if (room.players.length === 0) rooms.delete(targetCode.toUpperCase());
                else {
                  if (room.hostId === targetPlayerId) {
                    room.hostId = room.players[0].id;
                    room.players[0].isCreator = true;
                  }
                  broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: getSanitizedRoom(room) });
                }
              } else {
                handlePlayerDisconnectOrForfeit(io, room, targetPlayerId, true);
              }
            }
          }
          currentRoomCode = null;
          currentPlayerId = null;
          return;
        }
      } catch (err) {
        console.error("[Socket.io] Message processing error:", err);
      }
    });

    socket.on("disconnect", () => {
      activeQueue = activeQueue.filter((qp) => qp.socketId !== socket.id);
      stopMatchmakingTimerIfEmpty(io);
      broadcastQueueUpdate(io);

      if (currentRoomCode && currentPlayerId) {
        const room = rooms.get(currentRoomCode);
        if (room) {
          if (!room.gameStarted) {
            room.players = room.players.filter((p) => p.id !== currentPlayerId);
            if (room.players.length === 0) {
              rooms.delete(currentRoomCode);
            } else {
              if (room.hostId === currentPlayerId) {
                room.hostId = room.players[0].id;
                room.players[0].isCreator = true;
              }
              broadcastToRoom(io, room, { type: "ROOM_UPDATED", room: getSanitizedRoom(room) });
            }
          } else {
            handlePlayerDisconnectOrForfeit(io, room, currentPlayerId, false);
          }
        }
      }
    });
  });

  const publicPath = path.join(process.cwd(), "public");
  app.use(express.static(publicPath));

  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch {}
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Standalone Ludo Socket.io Server listening on port ${PORT}`);
  });
}

startServer();
