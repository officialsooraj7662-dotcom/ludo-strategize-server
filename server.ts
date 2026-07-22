import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

interface Player {
  id: string;
  color: string;
  name: string;
  isCreator: boolean;
  appVersion?: string;
}

interface Room {
  code: string;
  players: Player[];
  isTeamUpMode?: boolean;
  createdAt: number;
  gameState?: any;
}

const rooms = new Map<string, Room>();
const roomSignals = new Map<string, any[]>();

// Clean expired rooms (> 24 hrs old)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 24 * 60 * 60 * 1000) {
      rooms.delete(code);
      roomSignals.delete(code);
    }
  }
}, 60 * 60 * 1000);

// Generate 6-digit uppercase alphanumeric room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Version configuration endpoint
app.get('/api/app-version', (req, res) => {
  res.json({
    latestVersion: '2.4',
    minRequiredVersion: '2.0',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.gamers.ludo',
    appStoreUrl: 'https://apps.apple.com/app/ludo-strategic/id123456789',
  });
});

// Create Room
app.post('/api/rooms/create', (req, res) => {
  const { playerId, playerName, isTeamUpMode, appVersion } = req.body;
  if (!playerId || !playerName) {
    return res.status(400).json({ error: 'Player ID and Name are required' });
  }

  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const newRoom: Room = {
    code,
    players: [
      {
        id: playerId,
        color: 'RED',
        name: playerName,
        isCreator: true,
        appVersion: appVersion || '2.4',
      },
    ],
    isTeamUpMode: !!isTeamUpMode,
    createdAt: Date.now(),
  };

  rooms.set(code, newRoom);
  roomSignals.set(code, []);

  console.log(`[Room Created] Code: ${code} by ${playerName} (${playerId})`);
  res.json(newRoom);
});

// Join Room
app.post('/api/rooms/join', (req, res) => {
  const { code, playerId, playerName, appVersion } = req.body;
  if (!code || !playerId || !playerName) {
    return res.status(400).json({ error: 'Room code, Player ID, and Name are required' });
  }

  const uppercaseCode = code.trim().toUpperCase();
  const room = rooms.get(uppercaseCode);

  if (!room) {
    return res.status(404).json({ error: 'Room not found. Please check the code and try again.' });
  }

  if (room.players.length >= 4) {
    return res.status(400).json({ error: 'Room is full (Maximum 4 players allowed).' });
  }

  // Check if player already in room
  let player = room.players.find((p) => p.id === playerId);
  if (!player) {
    const availableColors = ['RED', 'GREEN', 'YELLOW', 'BLUE'].filter(
      (c) => !room.players.some((p) => p.color === c)
    );

    player = {
      id: playerId,
      color: availableColors[0] || 'BLUE',
      name: playerName,
      isCreator: false,
      appVersion: appVersion || '2.4',
    };
    room.players.push(player);
  }

  console.log(`[Player Joined] Room: ${uppercaseCode}, Player: ${playerName} (${playerId})`);
  res.json(room);
});

// Get Room State
app.get('/api/rooms/:code', (req, res) => {
  const uppercaseCode = req.params.code.trim().toUpperCase();
  const room = rooms.get(uppercaseCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json(room);
});

// Update Room State / Game State (Host/Client Sync Fallback)
app.post('/api/rooms/:code/update', (req, res) => {
  const uppercaseCode = req.params.code.trim().toUpperCase();
  const room = rooms.get(uppercaseCode);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const { players, isTeamUpMode, gameState } = req.body;
  if (players && Array.isArray(players)) {
    room.players = players;
  }
  if (typeof isTeamUpMode === 'boolean') {
    room.isTeamUpMode = isTeamUpMode;
  }
  if (gameState) {
    room.gameState = gameState;
  }

  res.json(room);
});

// Send Signal
app.post('/api/rooms/:code/signal', (req, res) => {
  const uppercaseCode = req.params.code.trim().toUpperCase();
  const { senderId, targetId, signal } = req.body;

  if (!senderId || !signal) {
    return res.status(400).json({ error: 'Sender ID and signal data required' });
  }

  const signals = roomSignals.get(uppercaseCode) || [];
  signals.push({
    senderId,
    targetId: targetId || null,
    signal,
    timestamp: Date.now(),
  });

  // Keep max 100 signals
  if (signals.length > 100) {
    signals.splice(0, signals.length - 100);
  }
  roomSignals.set(uppercaseCode, signals);

  res.json({ success: true });
});

// Get Signals
app.get('/api/rooms/:code/signals', (req, res) => {
  const uppercaseCode = req.params.code.trim().toUpperCase();
  const playerId = req.query.playerId as string;

  if (!playerId) {
    return res.status(400).json({ error: 'Player ID required' });
  }

  const signals = roomSignals.get(uppercaseCode) || [];
  const mySignals = signals.filter(
    (s) => s.targetId === playerId || s.targetId === null
  );

  // Clear delivered signals for this player
  const remainingSignals = signals.filter(
    (s) => s.targetId !== playerId && s.targetId !== null
  );
  roomSignals.set(uppercaseCode, remainingSignals);

  res.json({ signals: mySignals });
});

// Serve frontend static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Ludo Server] Running on port ${PORT}`);
});
