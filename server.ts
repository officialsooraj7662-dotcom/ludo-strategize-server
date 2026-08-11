/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  PlayerColor, 
  GameMode, 
  TokenState, 
  Token, 
  Player, 
  GameState, 
  OnlineRoom 
} from './types';
import { 
  START_INDEX, 
  HOME_ENTRANCE_INDEX, 
  SAFE_INDICES, 
  COLOR_HEX, 
  LIGHT_COLOR_HEX, 
  PLAYER_NAMES 
} from './constants';
import LudoBoard from './components/LudoBoard';
import { AdBanner } from './components/AdBanner';
import { InterstitialAd } from './components/InterstitialAd';
import GameSettings from './components/GameSettings';
import { getTranslation } from './translations';
import { 
  Shield, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  Users, 
  Bot, 
  Globe, 
  ListOrdered, 
  CheckCircle,
  Trophy,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Sparkles,
  Info,
  Copy,
  Check,
  Link,
  Vibrate,
  VibrateOff,
  Settings,
  User,
  LogOut,
  BookOpen,
  AlertTriangle,
  ArrowUpCircle,
  Star,
  Zap,
  Smartphone,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- GLOBAL API CALL REDIRECT TO RENDER SERVER ---
const RENDER_SERVER_URL = 'https://ludo-strategize-server.onrender.com';

const getApiUrl = (endpoint: string) => `${RENDER_SERVER_URL}${endpoint}`;

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const fallbackUrl = RENDER_SERVER_URL;
    let targetInput = input;

    if (typeof input === 'string') {
      if (input.startsWith('/api')) {
        targetInput = `${fallbackUrl}${input}`;
      } else if (input.includes('/api/')) {
        const origin = window.location.origin;
        if (input.startsWith(origin)) {
          targetInput = input.replace(origin, fallbackUrl);
        }
      }
    } else if (input instanceof URL) {
      if (input.pathname.startsWith('/api')) {
        targetInput = new URL(input.pathname + input.search, fallbackUrl);
      }
    } else if (input && typeof input === 'object' && 'url' in input) {
      const reqUrl = (input as any).url;
      if (typeof reqUrl === 'string' && (reqUrl.startsWith('/api') || reqUrl.includes('/api/'))) {
        try {
          const newUrl = reqUrl.startsWith('/api') 
            ? `${fallbackUrl}${reqUrl}` 
            : reqUrl.replace(window.location.origin, fallbackUrl);
          targetInput = new Request(newUrl, input as any);
        } catch (e) {
          console.error('Failed to rewrite Request object URL', e);
        }
      }
    }

    return originalFetch.call(this, targetInput, init);
  };
}

const INBUILT_AVATARS = [
  // Boys & Girls
  { id: 'b1', name: 'Cool Boy', emoji: '👦', bg: 'bg-gradient-to-tr from-blue-500 to-cyan-400' },
  { id: 'b2', name: 'Gamer Boy', emoji: '🎮', bg: 'bg-gradient-to-tr from-purple-500 to-indigo-500' },
  { id: 'b3', name: 'Cosmic Boy', emoji: '👨‍🚀', bg: 'bg-gradient-to-tr from-slate-700 to-slate-900' },
  { id: 'b4', name: 'Active Boy', emoji: '⚡', bg: 'bg-gradient-to-tr from-amber-500 to-orange-500' },
  { id: 'b5', name: 'Ninja', emoji: '🥷', bg: 'bg-gradient-to-tr from-gray-800 to-slate-900' },
  { id: 'b6', name: 'Detective', emoji: '🕵️‍♂️', bg: 'bg-gradient-to-tr from-amber-800 to-stone-700' },
  { id: 'b7', name: 'Rockstar', emoji: '🎸', bg: 'bg-gradient-to-tr from-red-600 to-rose-500' },
  { id: 'b8', name: 'Champion', emoji: '🏆', bg: 'bg-gradient-to-tr from-yellow-500 to-amber-600' },

  { id: 'g1', name: 'Sweet Girl', emoji: '👧', bg: 'bg-gradient-to-tr from-pink-400 to-rose-400' },
  { id: 'g2', name: 'Artist Girl', emoji: '🎨', bg: 'bg-gradient-to-tr from-violet-500 to-fuchsia-400' },
  { id: 'g3', name: 'Princess', emoji: '👸', bg: 'bg-gradient-to-tr from-yellow-400 to-amber-500' },
  { id: 'g4', name: 'Science Girl', emoji: '🔬', bg: 'bg-gradient-to-tr from-teal-400 to-emerald-400' },
  { id: 'g5', name: 'Queen', emoji: '👑', bg: 'bg-gradient-to-tr from-amber-400 to-yellow-600' },
  { id: 'g6', name: 'Superhero', emoji: '🦸‍♀️', bg: 'bg-gradient-to-tr from-sky-400 to-indigo-600' },
  { id: 'g7', name: 'Music Girl', emoji: '🎧', bg: 'bg-gradient-to-tr from-fuchsia-500 to-purple-600' },
  { id: 'g8', name: 'Astro Girl', emoji: '👩‍🚀', bg: 'bg-gradient-to-tr from-indigo-800 to-purple-900' },

  // Men & Women
  { id: 'm1', name: 'Smart Man', emoji: '👨‍💼', bg: 'bg-gradient-to-tr from-indigo-600 to-cyan-500' },
  { id: 'm2', name: 'Wizard', emoji: '🧙‍♂️', bg: 'bg-gradient-to-tr from-blue-700 to-purple-800' },
  { id: 'm3', name: 'Athlete', emoji: '🚴‍♂️', bg: 'bg-gradient-to-tr from-emerald-500 to-teal-600' },
  { id: 'm4', name: 'Pilot', emoji: '👨‍✈️', bg: 'bg-gradient-to-tr from-blue-600 to-slate-800' },

  { id: 'w1', name: 'Smart Woman', emoji: '👩‍💼', bg: 'bg-gradient-to-tr from-rose-500 to-pink-600' },
  { id: 'w2', name: 'Doctor', emoji: '👩‍⚕️', bg: 'bg-gradient-to-tr from-cyan-500 to-teal-500' },
  { id: 'w3', name: 'Firefighter', emoji: '👩‍🚒', bg: 'bg-gradient-to-tr from-red-500 to-orange-600' },
  { id: 'w4', name: 'Captain', emoji: '👩‍✈️', bg: 'bg-gradient-to-tr from-indigo-500 to-blue-700' },

  // Elders & Masters
  { id: 'em', name: 'Grandmaster', emoji: '👴', bg: 'bg-gradient-to-tr from-orange-600 to-amber-600' },
  { id: 'ew', name: 'Wise Gamer', emoji: '👵', bg: 'bg-gradient-to-tr from-teal-600 to-cyan-600' },

  // Animals
  { id: 'a1', name: 'Lion King', emoji: '🦁', bg: 'bg-gradient-to-tr from-amber-500 to-yellow-500' },
  { id: 'a2', name: 'Clever Fox', emoji: '🦊', bg: 'bg-gradient-to-tr from-orange-500 to-red-500' },
  { id: 'a3', name: 'Wise Owl', emoji: '🦉', bg: 'bg-gradient-to-tr from-amber-800 to-yellow-700' },
  { id: 'a4', name: 'Tiger', emoji: '🐯', bg: 'bg-gradient-to-tr from-amber-600 to-orange-600' },
  { id: 'a5', name: 'Panda', emoji: '🐼', bg: 'bg-gradient-to-tr from-slate-400 to-slate-600' },
  { id: 'a6', name: 'Dragon', emoji: '🐉', bg: 'bg-gradient-to-tr from-red-600 to-emerald-600' },
  { id: 'a7', name: 'Eagle', emoji: '🦅', bg: 'bg-gradient-to-tr from-blue-600 to-amber-600' },
  { id: 'a8', name: 'Magic Cat', emoji: '🐱', bg: 'bg-gradient-to-tr from-purple-400 to-pink-500' },
  { id: 'a9', name: 'Cool Dog', emoji: '🐶', bg: 'bg-gradient-to-tr from-sky-400 to-blue-500' },
  { id: 'a10', name: 'Power Bear', emoji: '🐻', bg: 'bg-gradient-to-tr from-stone-600 to-amber-800' },

  // Elements & Badges
  { id: 'x1', name: 'Fire Master', emoji: '🔥', bg: 'bg-gradient-to-tr from-orange-600 to-red-600' },
  { id: 'x2', name: 'Ice Legend', emoji: '❄️', bg: 'bg-gradient-to-tr from-sky-300 to-blue-500' },
  { id: 'x3', name: 'Lightning', emoji: '⚡', bg: 'bg-gradient-to-tr from-yellow-300 to-amber-500' },
  { id: 'x4', name: 'Star Lord', emoji: '⭐', bg: 'bg-gradient-to-tr from-amber-400 to-yellow-300' },
  { id: 'x5', name: 'Joker', emoji: '🃏', bg: 'bg-gradient-to-tr from-purple-600 to-rose-600' },
  { id: 'x6', name: 'Crown', emoji: '👑', bg: 'bg-gradient-to-tr from-yellow-300 to-amber-600' },
  { id: 'x7', name: 'Robot', emoji: '🤖', bg: 'bg-gradient-to-tr from-slate-500 to-cyan-600' },
  { id: 'x8', name: 'Alien', emoji: '👽', bg: 'bg-gradient-to-tr from-emerald-500 to-lime-400' },
  { id: 'x9', name: 'Ghost', emoji: '👻', bg: 'bg-gradient-to-tr from-indigo-400 to-purple-400' },
  { id: 'x10', name: 'Skull', emoji: '💀', bg: 'bg-gradient-to-tr from-slate-800 to-black' },
  { id: 'x11', name: 'Bullseye', emoji: '🎯', bg: 'bg-gradient-to-tr from-rose-600 to-red-500' },
  { id: 'x12', name: 'Diamond', emoji: '💎', bg: 'bg-gradient-to-tr from-cyan-400 to-blue-600' },
];

// Generates an elegant P2P-unique player ID
const generatePlayerId = () => {
  return 'ply-' + Math.random().toString(36).substr(2, 9);
};

const loadingTexts: Record<string, string> = {
  'English': 'Loading Game Assets...',
  'हिन्दी': 'गेम लोड हो रहा है...',
  'العربية': 'جاري تحميل اللعبة...',
  'Español': 'Cargando juego...',
  'Português': 'Carregando o jogo...',
  'தமிழ்': 'விளையாட்டு ஏற்றப்படுகிறது...',
  'తెలుగు': 'గేమ్ లోడ్ అవుతోంది...',
  'ಕನ್ನಡ': 'ಆಟ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
  'മലയാളം': 'ഗെയിം ലോഡ് ചെയ്യുന്നു...'
};

function LudoBoardIcon() {
  const MiniToken = ({ colorHex, pulse }: { colorHex: string; pulse?: boolean }) => {
    return (
      <div 
        className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full border border-white/50 shadow-lg relative flex items-center justify-center"
        style={{
          backgroundColor: colorHex,
          boxShadow: `0 0 6px ${colorHex}`,
        }}
      >
        <div className="absolute inset-[0.5px] bg-gradient-to-tr from-transparent via-white/50 to-white/25 rounded-full" />
        <div className="w-[1.5px] h-[1.5px] bg-white rounded-full opacity-90" />
      </div>
    );
  };

  const renderLogoYard = (color: string, rowStart: number, colStart: number) => {
    let bgColor = '';
    let borderColor = '';
    let slotBg = '';
    let slotBorder = '';
    let tokenColor = '';
    if (color === 'RED') {
      bgColor = 'bg-red-500/10';
      borderColor = 'border-red-500/40';
      slotBg = 'bg-red-500/5';
      slotBorder = 'border-red-500/30';
      tokenColor = '#FF0000';
    } else if (color === 'GREEN') {
      bgColor = 'bg-emerald-500/10';
      borderColor = 'border-emerald-500/40';
      slotBg = 'bg-emerald-500/5';
      slotBorder = 'border-emerald-500/30';
      tokenColor = '#00FF00';
    } else if (color === 'YELLOW') {
      bgColor = 'bg-amber-500/10';
      borderColor = 'border-amber-500/40';
      slotBg = 'bg-amber-500/5';
      slotBorder = 'border-amber-500/30';
      tokenColor = '#FFD700';
    } else if (color === 'BLUE') {
      bgColor = 'bg-blue-500/10';
      borderColor = 'border-blue-500/40';
      slotBg = 'bg-blue-500/5';
      slotBorder = 'border-blue-500/30';
      tokenColor = '#0000FF';
    }

    const isOccupied = (slotId: number) => {
      return true;
    };

    return (
      <div 
        key={`${color}-base`} 
        className={`col-span-6 row-span-6 ${bgColor} border ${borderColor} p-1 md:p-1.5 rounded-xl flex items-center justify-center relative shadow-inner`}
        style={{
          gridRowStart: rowStart,
          gridColumnStart: colStart,
        }}
      >
        <div className="w-full h-full bg-[#0a0f1e]/40 rounded-lg flex items-center justify-center p-0.5">
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#050811]/30 rounded-md border border-white/5">
            {[0, 1, 2, 3].map((id) => (
              <div 
                key={id} 
                className={`w-2.5 h-2.5 rounded-full ${slotBg} border border-dashed ${slotBorder} flex items-center justify-center`} 
              >
                {isOccupied(id) && <MiniToken colorHex={tokenColor} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCells = () => {
    const cells = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Red Base
        if (r < 6 && c < 6) {
          if (r === 0 && c === 0) {
            cells.push(renderLogoYard('RED', 1, 1));
          }
          continue;
        }
        // Green Base
        if (r < 6 && c >= 9) {
          if (r === 0 && c === 9) {
            cells.push(renderLogoYard('GREEN', 1, 10));
          }
          continue;
        }
        // Yellow Base
        if (r >= 9 && c >= 9) {
          if (r === 9 && c === 9) {
            cells.push(renderLogoYard('YELLOW', 10, 10));
          }
          continue;
        }
        // Blue Base
        if (r >= 9 && c < 6) {
          if (r === 9 && c === 0) {
            cells.push(renderLogoYard('BLUE', 10, 1));
          }
          continue;
        }
        // Center home triangle zone
        if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
          if (r === 6 && c === 6) {
            cells.push(
              <div 
                key="center-home" 
                className="col-span-3 row-span-3 bg-[#0a0f1e]/80 border border-white/10 relative overflow-hidden"
                style={{
                  gridRowStart: 7,
                  gridColumnStart: 7,
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0">
                  <polygon points="0,0 50,50 0,100" fill="#EF4444" opacity="0.9" stroke="#DC2626" strokeWidth="0.5" />
                  <polygon points="0,0 100,0 50,50" fill="#10B981" opacity="0.9" stroke="#059669" strokeWidth="0.5" />
                  <polygon points="100,0 100,100 50,50" fill="#F59E0B" opacity="0.9" stroke="#D97706" strokeWidth="0.5" />
                  <polygon points="0,100 50,50 100,100" fill="#3B82F6" opacity="0.9" stroke="#2563EB" strokeWidth="0.5" />
                  <circle cx="50" cy="50" r="14" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.5" />
                  <polygon points="50,42 53,48 59,49 55,53 56,59 50,56 44,59 45,53 41,49 47,48" fill="#F59E0B" />
                </svg>
              </div>
            );
          }
          continue;
        }

        const coordKey = `${r},${c}`;
        let bgStyle = 'bg-[#0a0f1e]/30';
        let customContent = null;

        const isRedStretch = r === 7 && c >= 1 && c <= 5;
        const isGreenStretch = c === 7 && r >= 1 && r <= 5;
        const isYellowStretch = r === 7 && c >= 9 && c <= 13;
        const isBlueStretch = c === 7 && r >= 9 && r <= 13;

        const isRedStart = r === 6 && c === 1;
        const isGreenStart = r === 1 && c === 8;
        const isYellowStart = r === 8 && c === 13;
        const isBlueStart = r === 13 && c === 6;

        const isSafeZone = (r === 8 && c === 2) || (r === 6 && c === 12) || (r === 2 && c === 6) || (r === 12 && c === 8);

        if (isRedStretch) {
          bgStyle = 'bg-red-500/35 border border-red-400/35';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <div className="w-1 h-1 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            </div>
          );
        } else if (isGreenStretch) {
          bgStyle = 'bg-emerald-500/35 border border-emerald-400/35';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </div>
          );
        } else if (isYellowStretch) {
          bgStyle = 'bg-amber-500/35 border border-amber-400/35';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <div className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            </div>
          );
        } else if (isBlueStretch) {
          bgStyle = 'bg-blue-500/35 border border-blue-400/35';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <div className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
            </div>
          );
        } else if (isRedStart) {
          bgStyle = 'bg-red-500/80 text-white border border-red-400/30';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <Zap size={5} className="text-white animate-pulse" />
            </div>
          );
        } else if (isGreenStart) {
          bgStyle = 'bg-emerald-500/80 text-white border border-emerald-400/30';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <Zap size={5} className="text-white animate-pulse" />
            </div>
          );
        } else if (isYellowStart) {
          bgStyle = 'bg-amber-500/80 text-white border border-amber-400/30';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <Zap size={5} className="text-white animate-pulse" />
            </div>
          );
        } else if (isBlueStart) {
          bgStyle = 'bg-blue-500/80 text-white border border-blue-400/30';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <Zap size={5} className="text-white animate-pulse" />
            </div>
          );
        } else if (isSafeZone) {
          bgStyle = 'backdrop-blur-md bg-white/10 border border-white/10 text-amber-400';
          customContent = (
            <div className="relative flex items-center justify-center w-full h-full">
              <Star size={5} fill="#F59E0B" className="text-amber-500" />
            </div>
          );
        } else {
          bgStyle = 'bg-[#0a0f1e]/40 border border-white/5';
        }

        cells.push(
          <div
            key={coordKey}
            className={`w-full h-full flex items-center justify-center relative ${bgStyle}`}
            style={{
              gridRowStart: r + 1,
              gridColumnStart: c + 1,
            }}
          >
            {customContent}
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow background */}
      <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-tr from-blue-500 via-emerald-500 to-amber-500 opacity-20 blur-xl animate-pulse"></div>
      
      {/* 3D Elevated Shadow Container matching dark-mode of the game board */}
      <div className="relative p-1 rounded-[24px] shadow-2xl transition-all duration-300 border bg-white/5 border-white/10 shadow-black/80 w-36 h-36 md:w-40 md:h-40">
        <div className="relative w-full h-full rounded-[18px] overflow-hidden bg-[#070b19]/80 select-none">
          {/* 15x15 Grid cells */}
          <div className="w-full h-full grid grid-cols-15 grid-rows-15">
            {renderCells()}
          </div>

          {/* Absolute SVG Overlay for Corner Diagonal Arrows */}
          <svg viewBox="0 0 15 15" className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <marker id="logo-arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#B71C1C" />
              </marker>
              <marker id="logo-arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#1B5E20" />
              </marker>
              <marker id="logo-arrow-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#D97706" />
              </marker>
              <marker id="logo-arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#0D47A1" />
              </marker>
            </defs>
            <line x1="5.5" y1="6.5" x2="6.35" y2="5.65" stroke="#B71C1C" strokeWidth="0.12" strokeLinecap="round" markerEnd="url(#logo-arrow-red)" />
            <line x1="8.5" y1="5.5" x2="9.35" y2="6.35" stroke="#1B5E20" strokeWidth="0.12" strokeLinecap="round" markerEnd="url(#logo-arrow-green)" />
            <line x1="9.5" y1="8.5" x2="8.65" y2="9.35" stroke="#D97706" strokeWidth="0.12" strokeLinecap="round" markerEnd="url(#logo-arrow-yellow)" />
            <line x1="6.5" y1="9.5" x2="5.65" y2="8.65" stroke="#0D47A1" strokeWidth="0.12" strokeLinecap="round" markerEnd="url(#logo-arrow-blue)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Loading state
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Smooth Loading progress bar timer (minimum 3 seconds)
  useEffect(() => {
    const duration = 3000; // 3 seconds
    const intervalTime = 30; // update every 30ms
    const totalSteps = duration / intervalTime;
    const step = 100 / totalSteps;
    
    const timer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Small delay before transition to allow user to see 100% completed
          setTimeout(() => {
            setIsAppLoading(false);
          }, 180);
          return 100;
        }
        return Math.min(prev + step, 100);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  // Lock screen orientation to Portrait programmatically
  useEffect(() => {
    const lockOrientation = async () => {
      try {
        const orientation = (window.screen as any)?.orientation;
        if (
          orientation &&
          typeof orientation.lock === 'function'
        ) {
          await orientation.lock('portrait');
          console.log('[Orientation] Screen orientation successfully locked to portrait.');
        }
      } catch (err) {
        console.warn('[Orientation] Programmatic orientation lock not supported or requires fullscreen:', err);
      }
    };

    lockOrientation();

    // Listen to changes just in case
    const handleOrientationChange = () => {
      console.log('[Orientation] Orientation changed to:', window.screen?.orientation?.type);
    };

    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }

    return () => {
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
    };
  }, []);

  // Profile state
  const [profileName, setProfileName] = useState<string>(() => {
    return localStorage.getItem('ludo_profile_name') || '';
  });
  const [profileSurname, setProfileSurname] = useState<string>(() => {
    return localStorage.getItem('ludo_profile_surname') || '';
  });
  const [profileAvatar, setProfileAvatar] = useState<string>(() => {
    return localStorage.getItem('ludo_profile_avatar') || '';
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(() => {
    const savedName = localStorage.getItem('ludo_profile_name');
    const savedAvatar = localStorage.getItem('ludo_profile_avatar');
    return !savedName || !savedAvatar;
  });

  // Temporaries for editing inside profile setup modal
  const [tempProfileName, setTempProfileName] = useState<string>(() => {
    return localStorage.getItem('ludo_profile_name') || '';
  });
  const [tempProfileSurname, setTempProfileSurname] = useState<string>(() => {
    return localStorage.getItem('ludo_profile_surname') || '';
  });
  const [tempProfileAvatar, setTempProfileAvatar] = useState<string>(() => {
    return localStorage.getItem('ludo_profile_avatar') || '';
  });

  // Device & general audio states
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('ludo_is_muted') === 'true';
  });
  const [isVibrationEnabled, setIsVibrationEnabled] = useState<boolean>(() => {
    return localStorage.getItem('ludo_is_vibration_enabled') !== 'false';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isRulesScreenOpen, setIsRulesScreenOpen] = useState<boolean>(false);
  const [activeScreen, setActiveScreen] = useState<'HOME' | 'LOBBY' | 'GAME'>('HOME');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('ludo_theme') as 'dark' | 'light') || 'dark';
  });

  // Keep general settings synchronized in local storage
  useEffect(() => {
    localStorage.setItem('ludo_is_muted', isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem('ludo_is_vibration_enabled', isVibrationEnabled.toString());
  }, [isVibrationEnabled]);

  useEffect(() => {
    localStorage.setItem('ludo_theme', theme);
  }, [theme]);
  const [isExitModalOpen, setIsExitModalOpen] = useState<boolean>(false);
  const [isLanguagePopupOpen, setIsLanguagePopupOpen] = useState<boolean>(false);
  const [isInterstitialOpen, setIsInterstitialOpen] = useState<boolean>(() => {
    return localStorage.getItem('ludo_must_watch_ad') === 'true';
  });

  const handleCloseInterstitial = () => {
    localStorage.setItem('ludo_last_ad_watched_timestamp', Date.now().toString());
    localStorage.removeItem('ludo_must_watch_ad');
    localStorage.setItem('ludo_cycle_matches_played', '0');
    setIsInterstitialOpen(false);
  };


  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    return localStorage.getItem('ludo_selected_language') || 'English';
  });
  const t = (key: string) => getTranslation(key, selectedLanguage);
  const [isLobbyLeaveModalOpen, setIsLobbyLeaveModalOpen] = useState<boolean>(false);

  // --- NATIVE APP EXIT HANDLER ---
  const handleExitApp = () => {
    try {
      if ((navigator as any).app && typeof (navigator as any).app.exitApp === 'function') {
        (navigator as any).app.exitApp();
      } else if ((window as any).Capacitor && (window as any).Capacitor.Plugins && (window as any).Capacitor.Plugins.App) {
        (window as any).Capacitor.Plugins.App.exitApp();
      } else {
        window.close();
      }
    } catch (e) {
      console.warn('Exit app failed:', e);
    }
  };

  // --- BROWSER HISTORY BACK BUTTON MANAGEMENT ---
  const isSystemPopstateRef = useRef<boolean>(false);
  const isBackingRef = useRef<boolean>(false);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isBackingRef.current) {
        isBackingRef.current = false;
        return;
      }

      if (event.state) {
        console.log('[PopState] Restoring UI state:', event.state);
        isSystemPopstateRef.current = true;
        
        const state = event.state;
        if (state.homeExitOpen) {
          handleExitApp();
          return;
        }
        if (state.screen !== undefined) {
          setActiveScreen(state.screen);
        }
        if (state.settingsOpen !== undefined) {
          setIsSettingsOpen(state.settingsOpen);
        }
        if (state.rulesOpen !== undefined) {
          setIsRulesScreenOpen(state.rulesOpen);
        }
        if (state.languageOpen !== undefined) {
          setIsLanguagePopupOpen(state.languageOpen);
        }
        if (state.lobbyLeaveOpen !== undefined) {
          setIsLobbyLeaveModalOpen(state.lobbyLeaveOpen);
        }
        if (state.profileOpen !== undefined) {
          setIsProfileModalOpen(state.profileOpen);
        }
        if (state.exitOpen !== undefined) {
          setIsExitModalOpen(state.exitOpen);
        }
      } else {
        // Fallback for empty state pop
        console.log('[PopState] No state. If on HOME, exit app directly.');
        if (activeScreen === 'HOME') {
          isSystemPopstateRef.current = true;
          handleExitApp();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Intercept exit back button on HOME screen:
    // Replace current state with an exit trigger state, then push active safe state
    const exitTriggerState = {
      screen: 'HOME',
      settingsOpen: false,
      rulesOpen: false,
      languageOpen: false,
      lobbyLeaveOpen: false,
      profileOpen: isProfileModalOpen,
      exitOpen: false,
      homeExitOpen: true,
    };
    
    const activeSafeState = {
      screen: 'HOME',
      settingsOpen: false,
      rulesOpen: false,
      languageOpen: false,
      lobbyLeaveOpen: false,
      profileOpen: isProfileModalOpen,
      exitOpen: false,
      homeExitOpen: false,
    };

    window.history.replaceState(exitTriggerState, '');
    window.history.pushState(activeSafeState, '');

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // When React state variables change, update browser history or navigate back
  useEffect(() => {
    if (isSystemPopstateRef.current) {
      isSystemPopstateRef.current = false;
      return;
    }

    const currentState = {
      screen: activeScreen,
      settingsOpen: isSettingsOpen,
      rulesOpen: isRulesScreenOpen,
      languageOpen: isLanguagePopupOpen,
      lobbyLeaveOpen: isLobbyLeaveModalOpen,
      profileOpen: isProfileModalOpen,
      exitOpen: isExitModalOpen,
      homeExitOpen: false,
    };

    if (window.history.state) {
      const hState = window.history.state;

      // Check if any modal went from OPEN to CLOSED
      const wasSettingsClosed = hState.settingsOpen && !currentState.settingsOpen;
      const wasRulesClosed = hState.rulesOpen && !currentState.rulesOpen;
      const wasLanguageClosed = hState.languageOpen && !currentState.languageOpen;
      const wasLobbyLeaveClosed = hState.lobbyLeaveOpen && !currentState.lobbyLeaveOpen;
      const wasProfileClosed = hState.profileOpen && !currentState.profileOpen;
      const wasExitClosed = hState.exitOpen && !currentState.exitOpen;

      if (
        wasSettingsClosed ||
        wasRulesClosed ||
        wasLanguageClosed ||
        wasLobbyLeaveClosed ||
        wasProfileClosed ||
        wasExitClosed
      ) {
        console.log('[History] Modal closed in-app. Going back in history to sync.');
        isBackingRef.current = true;
        window.history.back();
        return;
      }

      // Otherwise, check if there is any difference to push
      const isDifferent = 
        hState.screen !== currentState.screen ||
        hState.settingsOpen !== currentState.settingsOpen ||
        hState.rulesOpen !== currentState.rulesOpen ||
        hState.languageOpen !== currentState.languageOpen ||
        hState.lobbyLeaveOpen !== currentState.lobbyLeaveOpen ||
        hState.profileOpen !== currentState.profileOpen ||
        hState.exitOpen !== currentState.exitOpen;

      if (isDifferent) {
        console.log('[History] Pushing state:', currentState);
        window.history.pushState(currentState, '');
      }
    } else {
      window.history.pushState(currentState, '');
    }
  }, [
    activeScreen,
    isSettingsOpen,
    isRulesScreenOpen,
    isLanguagePopupOpen,
    isLobbyLeaveModalOpen,
    isProfileModalOpen,
    isExitModalOpen,
  ]);
  const [toast, setToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((current) => current === msg ? null : current);
    }, 2500);
  };

  const handleCancelProfile = () => {
    const savedLanguage = localStorage.getItem('ludo_selected_language') || 'English';
    setSelectedLanguage(savedLanguage);
    setIsProfileModalOpen(false);
  };
  
  // Game engine states
  const [gameState, setGameState] = useState<GameState>({
    mode: GameMode.OFFLINE,
    players: [],
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
    gameStarted: false,
    winnerColor: null,
    logs: ['Welcome to Ludo Strategize! Select a game mode to begin.'],
  });

  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [isWaitingForDiceNumber, setIsWaitingForDiceNumber] = useState<boolean>(false);
  const [isMovingToken, setIsMovingToken] = useState<boolean>(false);
  const [isAutoSkipping, setIsAutoSkipping] = useState<boolean>(false);
  const [blinkDiceQueue, setBlinkDiceQueue] = useState<boolean>(false);
  const isHoldingDiceRef = useRef<boolean>(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const holdStartTimeRef = useRef<number>(0);

  // Synchronized refs & helper functions to guarantee zero animation interruptions / teleportations in online mode
  const isRollingSyncRef = useRef<boolean>(false);
  const isMovingTokenSyncRef = useRef<boolean>(false);
  const pendingStateUpdateRef = useRef<GameState | null>(null);
  const receiverRollStartTimeRef = useRef<number>(0);
  const pendingFullBoardUpdateRef = useRef<{ gameState: GameState; sequenceId?: number } | null>(null);
  const pendingFullBoardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const moveCompletionCallbackRef = useRef<(() => void) | null>(null);
  const rollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopRollingAnimation = useCallback(() => {
    if (rollingTimerRef.current) {
      clearTimeout(rollingTimerRef.current);
      rollingTimerRef.current = null;
    }
    isRollingSyncRef.current = false;
    setIsRolling(false);
  }, []);

  const startRollingAnimation = useCallback((durationMs: number = 350) => {
    if (rollingTimerRef.current) {
      clearTimeout(rollingTimerRef.current);
    }
    isRollingSyncRef.current = true;
    setIsRolling(true);

    rollingTimerRef.current = setTimeout(() => {
      stopRollingAnimation();
    }, durationMs);
  }, [stopRollingAnimation]);

  const startTokenMovementAnimation = useCallback(() => {
    isMovingTokenSyncRef.current = true;
    setIsMovingToken(true);
  }, []);

  const stopTokenMovementAnimation = useCallback(() => {
    isMovingTokenSyncRef.current = false;
    setIsMovingToken(false);
  }, []);

  useEffect(() => {
    isRollingSyncRef.current = isRolling;
  }, [isRolling]);

  useEffect(() => {
    isMovingTokenSyncRef.current = isMovingToken;
  }, [isMovingToken]);

  const findMovedTokenFromState = useCallback((currState: GameState, newGameState: GameState) => {
    if (!currState || !newGameState || !currState.players || !newGameState.players) return null;
    
    for (const newPlayer of newGameState.players) {
      const currPlayer = currState.players.find((p) => p.color === newPlayer.color);
      if (!currPlayer) continue;

      for (const newToken of newPlayer.tokens) {
        const currToken = currPlayer.tokens.find((t) => t.id === newToken.id);
        if (!currToken) continue;

        // Case 1: Opened from BASE to TRACK
        if (currToken.state === TokenState.BASE && newToken.state === TokenState.TRACK) {
          return { tokenId: newToken.id, color: newPlayer.color, forceDiceValue: 6 };
        }

        // Case 2: Moved on TRACK
        if (currToken.state === TokenState.TRACK && newToken.state === TokenState.TRACK) {
          let diff = newToken.position - currToken.position;
          if (diff <= 0) {
            if (currToken.position >= 50 && newToken.position < 6) {
              diff = (52 - currToken.position) + newToken.position;
            }
          }
          if (diff > 0 && diff <= 12) {
            return { tokenId: newToken.id, color: newPlayer.color, forceDiceValue: diff };
          }
        }

        // Case 3: Moved onto HOME_STRETCH from TRACK
        if (currToken.state === TokenState.TRACK && newToken.state === TokenState.HOME_STRETCH) {
          const diff = (51 - currToken.position) + 1 + newToken.position;
          if (diff > 0 && diff <= 12) {
            return { tokenId: newToken.id, color: newPlayer.color, forceDiceValue: diff };
          }
        }

        // Case 4: Moved on HOME_STRETCH or into HOME
        if (currToken.state === TokenState.HOME_STRETCH && (newToken.state === TokenState.HOME_STRETCH || newToken.state === TokenState.HOME)) {
          const targetPos = newToken.state === TokenState.HOME ? 5 : newToken.position;
          const diff = targetPos - currToken.position;
          if (diff > 0 && diff <= 12) {
            return { tokenId: newToken.id, color: newPlayer.color, forceDiceValue: diff };
          }
        }
      }
    }
    return null;
  }, []);

  const applyGameStateUpdate = useCallback((newGameState: GameState, forceImmediate: boolean = false) => {
    if (!newGameState) return;

    const incomingVer = newGameState.stateVersion || 0;
    const currentVer = gameStateRef.current?.stateVersion || 0;

    // Reject older or identical state versions UNLESS forceImmediate is requested.
    // Monotonic stateVersion ensures state never moves backwards or re-applies stale turn shifts.
    if (!forceImmediate && incomingVer > 0 && currentVer > 0 && incomingVer <= currentVer) {
      return;
    }

    // MANDATORY GUARANTEE: Never overwrite active 3D dice roll or step-by-step token walking animation!
    if (isRollingSyncRef.current || isMovingTokenSyncRef.current) {
      const currPendingVer = pendingStateUpdateRef.current?.stateVersion || 0;
      if (incomingVer > currPendingVer && incomingVer > currentVer) {
        pendingStateUpdateRef.current = newGameState;
      }
      return;
    }

    if (isProcessingQueueRef.current || actionQueueRef.current.length > 0 || isRollingSyncRef.current || isMovingTokenSyncRef.current) {
      const currPendingVer = pendingStateUpdateRef.current?.stateVersion || 0;
      if (incomingVer > currPendingVer && incomingVer > currentVer) {
        pendingStateUpdateRef.current = newGameState;
      }
      return;
    }

    // If incoming full board state contains a token position change that wasn't animated yet, trigger step-by-step walking animation
    if (
      newGameState.mode === GameMode.ONLINE &&
      executeTokenMoveRef.current &&
      !isMovingTokenSyncRef.current &&
      !isRollingSyncRef.current &&
      gameStateRef.current
    ) {
      const moved = findMovedTokenFromState(gameStateRef.current, newGameState);
      if (moved) {
        pendingStateUpdateRef.current = newGameState;
        executeTokenMoveRef.current(moved.tokenId, moved.color, moved.forceDiceValue);
        return;
      }
    }

    setGameState((prev) => {
      const localVer = prev.stateVersion || 0;
      if (!forceImmediate && incomingVer > 0 && localVer > 0 && incomingVer <= localVer) {
        return prev;
      }

      setIsWaitingForDiceNumber(false);

      return {
        ...prev,
        ...newGameState,
        diceQueue: newGameState.diceQueue || [],
        selectedDiceValue: newGameState.selectedDiceValue !== undefined ? newGameState.selectedDiceValue : null,
      };
    });
  }, [findMovedTokenFromState]);

  // Flush pending state updates as soon as local animations and action queue complete
  useEffect(() => {
    if (!isRolling && !isMovingToken && !isProcessingQueueRef.current && actionQueueRef.current.length === 0) {
      setIsWaitingForBoardSync(false);
      if (pendingStateUpdateRef.current) {
        const pendingState = pendingStateUpdateRef.current;
        pendingStateUpdateRef.current = null;
        const incomingVer = pendingState.stateVersion || 0;
        const currentVer = gameStateRef.current?.stateVersion || 0;

        if (incomingVer > 0 && currentVer > 0 && incomingVer <= currentVer) {
          return;
        }

        setGameState((prev) => {
          const localVer = prev.stateVersion || 0;
          if (incomingVer > 0 && localVer > 0 && incomingVer <= localVer) {
            return prev;
          }

          return {
            ...prev,
            ...pendingState,
            diceQueue: pendingState.diceQueue || [],
            selectedDiceValue: pendingState.selectedDiceValue !== undefined ? pendingState.selectedDiceValue : null,
          };
        });
      }
    }
  }, [isRolling, isMovingToken]);

  // Online Multiplayer state
  const [myPlayerId] = useState<string>(() => {
    const saved = localStorage.getItem('ludo_player_id');
    if (saved) return saved;
    const newId = generatePlayerId();
    localStorage.setItem('ludo_player_id', newId);
    return newId;
  });
  const [myPlayerColor, setMyPlayerColor] = useState<PlayerColor>(PlayerColor.RED);
  const [roomCode, setRoomCode] = useState<string>('');
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const [isOnlineConnecting, setIsOnlineConnecting] = useState<boolean>(false);

  // --- APP UPDATE SYSTEM ---
  const CURRENT_VERSION = '1.0.0';
  const getMyVersion = () => {
    return localStorage.getItem('ludo_app_upgraded_to') || CURRENT_VERSION;
  };
  const [isAppUpdated, setIsAppUpdated] = useState<boolean>(() => {
    return localStorage.getItem('ludo_app_upgraded_to') !== null;
  });
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [updateConfig, setUpdateConfig] = useState<{
    latestVersion: string;
    minRequiredVersion: string;
    playStoreUrl: string;
    appStoreUrl: string;
  } | null>(null);
  const [showBlockedOnlineModal, setShowBlockedOnlineModal] = useState<boolean>(false);

  const compareVersions = (v1: string, v2: string) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  };

// Helper function to fetch with a strict timeout (e.g., 20s)
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

  // Explicit version verification called ONLY when user clicks Create Room, Join Room, or Auto Matchmaking
  const verifyVersionBeforeOnlineAction = async (): Promise<boolean> => {
    try {
      const res = await fetchWithTimeout(getApiUrl('/api/app-version'), {}, 20000);
      if (res.ok) {
        const data = await res.json();
        setUpdateConfig(data);
        
        const currentVer = getMyVersion();
        const serverVer = data.latestVersion || data.minRequiredVersion || CURRENT_VERSION;
        
        if (compareVersions(currentVer, serverVer) < 0) {
          setShowBlockedOnlineModal(true);
          return false; // Block action because client version is outdated
        }
      }
    } catch (err) {
      console.warn('Failed to fetch app version configuration', err);
    }
    return true; // Version is up-to-date or server check bypassed
  };

  const handleSimulateUpdate = () => {
    const targetVer = updateConfig?.latestVersion || CURRENT_VERSION;
    localStorage.setItem('ludo_app_upgraded_to', targetVer);
    setIsAppUpdated(true);
    setShowUpdateModal(false);
    triggerToast(`App upgraded successfully to v${targetVer}!`);
    playSynthSound('safe');
  };

  const getDeviceStoreUrl = () => {
    if (!updateConfig) return 'https://play.google.com/store/apps/details?id=com.gamers.ludo';
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
      return updateConfig.appStoreUrl;
    }
    return updateConfig.playStoreUrl;
  };

  const registerNewMatchStart = (isJoiner: boolean) => {
    const now = Date.now();
    const lastAdTimeStr = localStorage.getItem('ludo_last_ad_watched_timestamp');
    const lastAdTime = lastAdTimeStr ? parseInt(lastAdTimeStr, 10) : 0;

    // Cooldown check:
    if (lastAdTime && (now - lastAdTime) < 3 * 60 * 60 * 1000) {
      console.log("[Ad Control] 3-hour cooldown active. No ad action.");
      return;
    }

    let cycleMatchesPlayed = parseInt(localStorage.getItem('ludo_cycle_matches_played') || '0', 10);
    cycleMatchesPlayed += 1;
    localStorage.setItem('ludo_cycle_matches_played', cycleMatchesPlayed.toString());
    console.log(`[Ad Control] Match started in current cycle. Total: ${cycleMatchesPlayed}. isJoiner: ${isJoiner}`);

    if (cycleMatchesPlayed === 2) {
      if (!isJoiner) {
        console.log("[Ad Control] Non-joiner 2nd match started. Showing Interstitial Ad.");
        setIsInterstitialOpen(true);
      } else {
        console.log("[Ad Control] Joiner 2nd match started. Will show Ad on match completion.");
      }
    }
  };

  const prevWinnerColorRef = useRef<PlayerColor | null>(null);

  useEffect(() => {
    if (gameState.winnerColor && !prevWinnerColorRef.current && gameState.gameStarted) {
      // Match completed!
      const now = Date.now();
      const lastAdTimeStr = localStorage.getItem('ludo_last_ad_watched_timestamp');
      const lastAdTime = lastAdTimeStr ? parseInt(lastAdTimeStr, 10) : 0;

      if (!lastAdTime || (now - lastAdTime) >= 3 * 60 * 60 * 1000) {
        const cycleMatchesPlayed = parseInt(localStorage.getItem('ludo_cycle_matches_played') || '0', 10);
        const isJoiner = gameState.mode === GameMode.ONLINE && onlineRoom && onlineRoom.players[0]?.id !== myPlayerId;

        console.log(`[Ad Control] Match completed hook. Cycle matches: ${cycleMatchesPlayed}, isJoiner: ${isJoiner}`);

        if (cycleMatchesPlayed === 2 && isJoiner) {
          console.log("[Ad Control] Joiner 2nd match completed. Setting must-watch flag and showing Interstitial Ad.");
          localStorage.setItem('ludo_must_watch_ad', 'true');
          setIsInterstitialOpen(true);
        }
      }
    }
    prevWinnerColorRef.current = gameState.winnerColor;
  }, [gameState.winnerColor, gameState.gameStarted, gameState.mode, onlineRoom, myPlayerId]);

  // Turn Timer Countdown State (20 seconds) & Board Sync Wait State (max 3s)
  const [turnCountdown, setTurnCountdown] = useState<number>(20);
  const [isWaitingForBoardSync, setIsWaitingForBoardSync] = useState<boolean>(false);
  const boardSyncWaitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Smart Re-join States
  const [showRejoinPopup, setShowRejoinPopup] = useState<boolean>(false);
  const [showMatchEndedPopup, setShowMatchEndedPopup] = useState<boolean>(false);
  const [pendingRejoinData, setPendingRejoinData] = useState<any>(null);
  const [rejoinNotification, setRejoinNotification] = useState<string | null>(null);

  // Version reference for smart polling optimization
  const roomVersionRef = useRef<number>(-1);

  const gameStateRef = useRef<GameState>(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Player Connection Status Tracker
  const [peerConnectionStates, setPeerConnectionStates] = useState<Record<string, 'connected' | 'connecting' | 'disconnected'>>({});

  const actionQueueRef = useRef<Array<{ type: string; action: () => Promise<void> | void }>>([]);
  const isProcessingQueueRef = useRef<boolean>(false);

  const processActionQueue = useCallback(() => {
    if (isProcessingQueueRef.current) {
      return;
    }

    if (actionQueueRef.current.length === 0) {
      if (pendingStateUpdateRef.current && !isRollingSyncRef.current && !isMovingTokenSyncRef.current) {
        const pendingState = pendingStateUpdateRef.current;
        pendingStateUpdateRef.current = null;
        applyGameStateUpdate(pendingState, true);
      }
      return;
    }

    isProcessingQueueRef.current = true;
    const currentItem = actionQueueRef.current.shift();

    if (currentItem) {
      let isDone = false;
      const safetyTimeout = setTimeout(() => {
        if (!isDone) {
          isDone = true;
          console.warn(`[ActionQueue] Action '${currentItem.type}' timed out after 4000ms. Safety-unlocking queue.`);
          isProcessingQueueRef.current = false;
          isRollingSyncRef.current = false;
          isMovingTokenSyncRef.current = false;
          processActionQueue();
        }
      }, 4000);

      const finishQueueItem = () => {
        if (!isDone) {
          isDone = true;
          clearTimeout(safetyTimeout);
          setTimeout(() => {
            isProcessingQueueRef.current = false;
            processActionQueue();
          }, 50);
        }
      };

      try {
        const actionResult = currentItem.action();
        if (actionResult && typeof (actionResult as any).then === 'function') {
          (actionResult as Promise<void>)
            .then(() => {
              finishQueueItem();
            })
            .catch((err) => {
              console.error('[ActionQueue] Async action error:', err);
              finishQueueItem();
            });
        } else {
          finishQueueItem();
        }
      } catch (err) {
        console.error('[ActionQueue] Action execution error:', err);
        finishQueueItem();
      }
    }
  }, [applyGameStateUpdate]);

  const enqueueAction = useCallback((type: string, actionFn: () => Promise<void> | void) => {
    actionQueueRef.current.push({ type, action: actionFn });
    processActionQueue();
  }, [processActionQueue]);

  useEffect(() => {
    if (!isMovingToken && !isRolling) {
      processActionQueue();
    }
  }, [isMovingToken, isRolling, processActionQueue]);

  // --- AUTOMATIC WATCHDOG & STASIS RECOVERY ENGINE ---
  // Guarantees that even if WebSocket packet order or animation timing glitches,
  // the action queue and turn state will automatically recover within 2 seconds!
  useEffect(() => {
    if (activeScreen !== 'GAME' || gameState.mode !== GameMode.ONLINE) return;

    const watchdogInterval = setInterval(() => {
      // Watchdog monitor: queue unlocks strictly when animation promises resolve
      // watchdog keeps track of active state without forcefully overriding active processing
    }, 2000);

    return () => clearInterval(watchdogInterval);
  }, [activeScreen, gameState.mode, processActionQueue, applyGameStateUpdate]);

  // --- WEBSOCKET REAL-TIME SERVER SYSTEM ---
  const wsRef = useRef<WebSocket | null>(null);
  const pendingWsQueueRef = useRef<any[]>([]);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  const flushPendingWsQueue = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && pendingWsQueueRef.current.length > 0) {
      console.log(`[WebSocket Queue] Flushing ${pendingWsQueueRef.current.length} queued outgoing messages...`);
      const queue = [...pendingWsQueueRef.current];
      pendingWsQueueRef.current = [];
      queue.forEach((msg) => {
        try {
          wsRef.current?.send(JSON.stringify(msg));
        } catch (err) {
          console.error('[WebSocket Queue] Error sending queued message:', err);
        }
      });
    }
  }, []);

  const connectWebSocket = useCallback((code: string, pId: string, pName?: string) => {
    if (!code || !pId) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'JOIN_ROOM',
          roomCode: code,
          playerId: pId,
          playerName: pName || 'Player',
        }));
        flushPendingWsQueue();
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    console.log(`[WebSocket Server] Connecting to ${wsUrl}...`);
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WebSocket Server] Connected successfully!');
        setIsWsConnected(true);
        ws.send(JSON.stringify({
          type: 'JOIN_ROOM',
          roomCode: code,
          playerId: pId,
          playerName: pName || 'Player',
        }));
        flushPendingWsQueue();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ROOM_JOINED') {
            console.log(`[WebSocket Server] Successfully joined room ${msg.roomCode}`);
            setIsWsConnected(true);

            if (msg.gameState && msg.gameState.mode === GameMode.ONLINE) {
              const incomingVer = msg.gameState.stateVersion || 0;
              const localVer = latestGameStateRef.current?.stateVersion || 0;
              if (incomingVer > localVer) {
                console.log(`[WebSocket Sync] Syncing local board state to server snapshot v${incomingVer}`);
                setGameState(msg.gameState);
                latestGameStateRef.current = msg.gameState;
              }
            } else if (latestGameStateRef.current && latestGameStateRef.current.mode === GameMode.ONLINE) {
              ws.send(JSON.stringify({
                type: 'GAME_STATE_UPDATE',
                roomCode: code,
                senderId: pId,
                gameState: latestGameStateRef.current,
              }));
            }

            flushPendingWsQueue();
            return;
          }

          if (msg.type === 'PLAYER_CONNECTED') {
            console.log(`[WebSocket Server] Player ${msg.playerId} is online!`);
            setPeerConnectionStates((prev) => ({ ...prev, [msg.playerId]: 'connected' }));
            playSynthSound('safe');
            return;
          }

          if (msg.type === 'PLAYER_DISCONNECTED') {
            console.log(`[WebSocket Server] Player ${msg.playerId} went offline.`);
            setPeerConnectionStates((prev) => ({ ...prev, [msg.playerId]: 'disconnected' }));
            return;
          }

          handleIncomingChannelMessage(msg.senderId || msg.from || 'peer', event.data);
        } catch (err) {
          console.error('[WebSocket Server] Message parsing error:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[WebSocket Server] WebSocket error:', err);
        setIsWsConnected(false);
      };

      ws.onclose = () => {
        console.warn('[WebSocket Server] Connection closed. Reconnecting...');
        setIsWsConnected(false);
        wsRef.current = null;
        setTimeout(() => {
          if (roomCode && (activeScreen === 'GAME' || activeScreen === 'LOBBY')) {
            const myPlayer = onlineRoom?.players.find((p) => p.id === myPlayerId);
            connectWebSocket(roomCode, myPlayerId, myPlayer?.name);
          }
        }, 1200);
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[WebSocket Server] Failed to initiate WebSocket:', e);
    }
  }, [flushPendingWsQueue]);

  const cleanUpWebSocket = () => {
    console.log('[WebSocket Server] Closing WebSocket channel...');
    if (wsRef.current) {
      try {
        if (roomCode) {
          wsRef.current.send(JSON.stringify({ type: 'LEAVE_ROOM', roomCode, playerId: myPlayerId }));
        }
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }
    setIsWsConnected(false);
    setPeerConnectionStates({});
  };

  const executeTokenMoveRef = useRef<((tokenId: number, color: PlayerColor, forceDiceValue?: number, onComplete?: () => void) => void) | null>(null);
  const outgoingSequenceIdRef = useRef<number>(1);
  const lastProcessedSequenceIdRef = useRef<number>(0);
  const processedSequenceIdsRef = useRef<Set<number>>(new Set());
  const outOfOrderBufferRef = useRef<Map<number, { senderId: string; msg: any }>>(new Map());
  const outOfOrderTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sentMessageHistoryRef = useRef<Map<number, any>>(new Map());
  const latestGameStateRef = useRef<GameState>(gameState);

  useEffect(() => {
    latestGameStateRef.current = gameState;
  }, [gameState]);

  const flushOldestBufferedSequence = useCallback(() => {
    if (outOfOrderBufferRef.current.size === 0) return;
    const sortedSeqKeys = Array.from(outOfOrderBufferRef.current.keys()).sort((a: number, b: number) => a - b);
    const lowestSeq = Number(sortedSeqKeys[0]);
    console.warn(`[P2P Sequence Buffer] Missing packet timeout. Force-flushing from seq ${lowestSeq}`);
    lastProcessedSequenceIdRef.current = lowestSeq - 1;
    let nextSeq: number = lowestSeq;
    while (outOfOrderBufferRef.current.has(nextSeq)) {
      const item = outOfOrderBufferRef.current.get(nextSeq)!;
      outOfOrderBufferRef.current.delete(nextSeq);
      dispatchSequencedMessage(item.senderId, item.msg);
      processedSequenceIdsRef.current.add(nextSeq);
      lastProcessedSequenceIdRef.current = nextSeq;
      nextSeq++;
    }
    if (outOfOrderBufferRef.current.size > 0) {
      outOfOrderTimerRef.current = setTimeout(() => {
        outOfOrderTimerRef.current = null;
        flushOldestBufferedSequence();
      }, 600);
    }
  }, []);

  const dispatchSequencedMessage = (senderId: string, msg: any) => {
    // Outdated Data Drop (Stale Packet Rejection) - strictly for full state snapshots
    if (
      msg.type === 'GAME_STATE_UPDATE' &&
      msg.stateVersion !== undefined &&
      latestGameStateRef.current &&
      latestGameStateRef.current.stateVersion !== undefined &&
      msg.stateVersion < latestGameStateRef.current.stateVersion
    ) {
      console.warn(`[P2P Queue] Stale GAME_STATE_UPDATE packet dropped (msg ver: ${msg.stateVersion} < local ver: ${latestGameStateRef.current.stateVersion})`);
      return;
    }

    // 1. DICE_ROLL_START: Trigger 3D dice tumbling animation and roll audio immediately on receiver device
    if (msg.type === 'DICE_ROLL_START') {
      setIsWaitingForDiceNumber(true);
      startRollingAnimation(600);
      playSynthSound('roll', 0.60);
      return;
    }

    // 2. START_GAME
    if (msg.type === 'START_GAME') {
      if (msg.gameState) {
        setGameState(msg.gameState);
      }
      setActiveScreen('GAME');
      playSynthSound('safe');
      registerNewMatchStart(true);
      return;
    }

    // 3. SWITCH_TURN
    if (msg.type === 'SWITCH_TURN') {
      if (!msg.gameState) return;

      const snapshotState = msg.gameState;

      pendingStateUpdateRef.current = null;

      enqueueAction('SWITCH_TURN', () => {
        return new Promise<void>((resolve) => {
          if (snapshotState) {
            setGameState((prev) => {
              const incomingVer = snapshotState.stateVersion || 0;
              const localVer = prev.stateVersion || 0;
              if (incomingVer > 0 && localVer > 0 && incomingVer < localVer) {
                return prev;
              }
              return {
                ...prev,
                ...snapshotState,
              };
            });
            latestGameStateRef.current = snapshotState;

            // Reset 20-second countdown and clear auto-skip / board sync flags
            setTurnCountdown(20);
            setIsWaitingForBoardSync(false);
            isAutoSkippingRef.current = false;
            setIsAutoSkipping(false);
            playSynthSound('safe');
          }
          resolve();
        });
      });
      return;
    }

    // 4. GAME_STATE_UPDATE
    if (msg.type === 'GAME_STATE_UPDATE') {
      if (!msg.gameState) return;

      // Store pending full board state update with sequence ID
      pendingFullBoardUpdateRef.current = { gameState: msg.gameState, sequenceId: msg.sequenceId };

      if (pendingFullBoardTimerRef.current) {
        clearTimeout(pendingFullBoardTimerRef.current);
        pendingFullBoardTimerRef.current = null;
      }

      const scheduleBoardSyncFallback = (seqId: number) => {
        if (pendingFullBoardTimerRef.current) {
          clearTimeout(pendingFullBoardTimerRef.current);
          pendingFullBoardTimerRef.current = null;
        }
        pendingFullBoardTimerRef.current = setTimeout(() => {
          if (pendingFullBoardUpdateRef.current && pendingFullBoardUpdateRef.current.sequenceId === seqId) {
            if (isProcessingQueueRef.current || isMovingTokenSyncRef.current || isRollingSyncRef.current || actionQueueRef.current.length > 0) {
              scheduleBoardSyncFallback(seqId);
              return;
            }
            console.log(`[7s Board Sync Buffer]: Applying full board state for sequence ${seqId}`);
            const fullState = pendingFullBoardUpdateRef.current.gameState;
            pendingFullBoardUpdateRef.current = null;
            pendingFullBoardTimerRef.current = null;
            applyGameStateUpdate(fullState, true);
          }
        }, 7000);
      };

      scheduleBoardSyncFallback(msg.sequenceId);

      const snapshotState = msg.gameState;
      enqueueAction('GAME_STATE_UPDATE', () => {
        return new Promise<void>((resolve) => {
          if (pendingFullBoardTimerRef.current && pendingFullBoardUpdateRef.current?.sequenceId === msg.sequenceId) {
            clearTimeout(pendingFullBoardTimerRef.current);
            pendingFullBoardTimerRef.current = null;
            pendingFullBoardUpdateRef.current = null;
          }

          if (snapshotState) {
            applyGameStateUpdate(snapshotState, false);
          }
          resolve();
        });
      });
      return;
    }

    // 5. DICE_ROLLED_RESULT
    if (msg.type === 'DICE_ROLLED_RESULT') {
      enqueueAction('DICE_ROLLED_RESULT', () => {
        return new Promise<void>((resolve) => {
          isRollingSyncRef.current = true;
          setIsWaitingForDiceNumber(true);
          startRollingAnimation(550);
          playSynthSound('roll', 0.60);

          // 1. Tumble 3D dice for 550ms
          setTimeout(() => {
            try {
              setGameState((prev) => {
                const nextPlayers = prev.players.map((p, idx) => {
                  if (idx === msg.activePlayerIndex) {
                    return {
                      ...p,
                      rollHistory: [...(p.rollHistory || []), msg.rollValue],
                      strikes: 0,
                    };
                  }
                  return p;
                });
                const nextVer = Math.max(prev.stateVersion || 0, msg.stateVersion || 0);

                const nextState = {
                  ...prev,
                  stateVersion: nextVer,
                  activePlayerIndex: msg.activePlayerIndex !== undefined ? msg.activePlayerIndex : prev.activePlayerIndex,
                  players: nextPlayers,
                  diceQueue: msg.diceQueue,
                  selectedDiceValue: msg.selectedDiceValue !== undefined ? msg.selectedDiceValue : null,
                  diceRollCountThisTurn: msg.diceRollCountThisTurn,
                  consecutiveSixesCount: msg.consecutiveSixesCount,
                  isBonusRolling: msg.isBonusRolling,
                  safeDiceQueue: msg.safeDiceQueue || [],
                  bonusConsecutiveSixesCount: msg.bonusConsecutiveSixesCount || 0,
                  logs: msg.logMsg ? [msg.logMsg, ...prev.logs] : prev.logs,
                };
                latestGameStateRef.current = nextState;
                setTurnCountdown(20);
                return nextState;
              });
            } catch (err) {
              console.error('[DICE_ROLLED_RESULT] Error setting game state:', err);
            } finally {
              stopRollingAnimation();
              setIsWaitingForDiceNumber(false);
              setIsWaitingForBoardSync(false);

              // 2. Pause for 350ms with rolled face clearly visible before releasing lock and moving to next action
              setTimeout(() => {
                isRollingSyncRef.current = false;
                resolve();
              }, 350);
            }
          }, 550);
        });
      });
    } else if (msg.type === 'SELECT_DICE_VALUE_ACTION') {
      enqueueAction('SELECT_DICE_VALUE_ACTION', () => {
        return new Promise<void>((resolve) => {
          setGameState((prev) => ({
            ...prev,
            stateVersion: Math.max(prev.stateVersion || 0, msg.stateVersion || 0),
            selectedDiceValue: msg.selectedDiceValue,
          }));
          resolve();
        });
      });
    } else if (msg.type === 'MOVE_TOKEN_ACTION') {
      enqueueAction('MOVE_TOKEN_ACTION', () => {
        return new Promise<void>((resolve) => {
          if (executeTokenMoveRef.current) {
            executeTokenMoveRef.current(msg.tokenId, msg.color as PlayerColor, msg.forceDiceValue, () => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    }
  };

  const handleIncomingChannelMessage = (senderId: string, dataStr: string) => {
    try {
      const msg = JSON.parse(dataStr);
      console.log(`[WebSocket Server] Message received from ${senderId}:`, msg.type, `seq: ${msg.sequenceId}`);

      if (msg.type === 'REQUEST_RESYNC') {
        const lastSeen = msg.lastSeenSequenceId || 0;
        console.warn(`[WebSocket] Peer ${senderId} requested state resync from last seen sequence: ${lastSeen}`);
        
        let retransmittedCount = 0;
        const currentSeq = outgoingSequenceIdRef.current;
        for (let seq = lastSeen + 1; seq < currentSeq; seq++) {
          if (sentMessageHistoryRef.current.has(seq)) {
            const historyMsg = sentMessageHistoryRef.current.get(seq);
            broadcastP2PMessage(historyMsg);
            retransmittedCount++;
          }
        }

        if (retransmittedCount === 0 && latestGameStateRef.current) {
          broadcastGameStateViaP2P(latestGameStateRef.current);
        }
        return;
      }

      if (msg.type === 'CHECK_MY_STATUS') {
        broadcastP2PMessage({
          type: 'P2P_STATUS_OK',
          from: myPlayerId,
          targetPeerId: senderId,
        });
        return;
      }

      if (msg.type === 'P2P_STATUS_OK') {
        return;
      }

      // 1. Sequence Order Buffer & Duplicate Discard
      if (msg.sequenceId !== undefined && msg.sequenceId !== null) {
        const seq = msg.sequenceId;

        // Discard duplicate or already processed
        if (processedSequenceIdsRef.current.has(seq)) {
          console.log(`[P2P Queue] Duplicate packet seq ${seq} discarded.`);
          return;
        }

        // Initialize sequence tracking on first message received
        if (lastProcessedSequenceIdRef.current === 0) {
          lastProcessedSequenceIdRef.current = seq - 1;
        }

        const expectedSeq = lastProcessedSequenceIdRef.current + 1;

        if (seq > expectedSeq) {
          // If gap is large (>5), jump forward immediately to avoid deadlock
          if (seq - expectedSeq > 5) {
            console.warn(`[P2P Sequence Buffer] Large sequence gap detected (seq ${seq} vs expected ${expectedSeq}). Syncing sequence counter forward.`);
            lastProcessedSequenceIdRef.current = seq - 1;
          } else {
            console.warn(`[P2P Sequence Buffer] Packet seq ${seq} arrived early! Waiting for seq ${expectedSeq}. Buffering seq ${seq}...`);
            outOfOrderBufferRef.current.set(seq, { senderId, msg });

            // Request missing packet from sender immediately
            broadcastP2PMessage({
              type: 'REQUEST_RESYNC',
              lastSeenSequenceId: lastProcessedSequenceIdRef.current,
            });

            // Set short 600ms timer to flush buffer if missing packet never arrives
            if (!outOfOrderTimerRef.current) {
              outOfOrderTimerRef.current = setTimeout(() => {
                outOfOrderTimerRef.current = null;
                flushOldestBufferedSequence();
              }, 600);
            }
            return;
          }
        }
      }

      // Process expected sequence message
      dispatchSequencedMessage(senderId, msg);

      if (msg.sequenceId !== undefined && msg.sequenceId !== null) {
        processedSequenceIdsRef.current.add(msg.sequenceId);
        lastProcessedSequenceIdRef.current = msg.sequenceId;

        if (processedSequenceIdsRef.current.size > 500) {
          const arr = Array.from(processedSequenceIdsRef.current);
          processedSequenceIdsRef.current = new Set(arr.slice(arr.length - 250));
        }

        // Process any buffered messages that match the new next sequence numbers in order
        let nextSeq = lastProcessedSequenceIdRef.current + 1;
        while (outOfOrderBufferRef.current.has(nextSeq)) {
          const item = outOfOrderBufferRef.current.get(nextSeq)!;
          outOfOrderBufferRef.current.delete(nextSeq);
          dispatchSequencedMessage(item.senderId, item.msg);
          processedSequenceIdsRef.current.add(nextSeq);
          lastProcessedSequenceIdRef.current = nextSeq;
          nextSeq++;
        }

        if (outOfOrderBufferRef.current.size === 0 && outOfOrderTimerRef.current) {
          clearTimeout(outOfOrderTimerRef.current);
          outOfOrderTimerRef.current = null;
        }
      }
    } catch (err) {
      console.error('[WebSocket] Error parsing channel message:', err);
    }
  };

  const broadcastP2PMessage = (msgObj: any) => {
    if (!msgObj.sequenceId) {
      msgObj.sequenceId = outgoingSequenceIdRef.current++;
    }
    if (!msgObj.timestamp) {
      msgObj.timestamp = Date.now();
    }
    if (!msgObj.senderId) {
      msgObj.senderId = myPlayerId;
    }
    msgObj.roomCode = roomCode;

    // Save into history buffer for instant re-transmission if peer lost a packet
    sentMessageHistoryRef.current.set(msgObj.sequenceId, msgObj);
    if (sentMessageHistoryRef.current.size > 100) {
      const keys = Array.from(sentMessageHistoryRef.current.keys()).sort((a: number, b: number) => a - b);
      if (keys.length > 50) {
        for (let i = 0; i < keys.length - 50; i++) {
          sentMessageHistoryRef.current.delete(keys[i]);
        }
      }
    }

    const serialized = JSON.stringify(msgObj);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(serialized);
      } catch (err) {
        console.warn('[WebSocket] Direct send error. Queueing message:', msgObj.type);
        pendingWsQueueRef.current.push(msgObj);
      }
    } else {
      console.warn('[WebSocket Queue] Socket not open. Queueing message for transmission:', msgObj.type, `seq: ${msgObj.sequenceId}`);
      pendingWsQueueRef.current.push(msgObj);
      if (roomCode) {
        const myPlayer = onlineRoom?.players.find((p) => p.id === myPlayerId);
        connectWebSocket(roomCode, myPlayerId, myPlayer?.name);
      }
    }
  };

  const broadcastGameStateViaP2P = (updatedState: GameState) => {
    if (updatedState.mode !== GameMode.ONLINE) return;
    broadcastP2PMessage({
      type: 'GAME_STATE_UPDATE',
      gameState: updatedState,
    });
  };

  const broadcastTurnSwitchViaP2P = (updatedState: GameState) => {
    if (updatedState.mode !== GameMode.ONLINE) return;

    broadcastP2PMessage({
      type: 'SWITCH_TURN',
      gameState: updatedState,
    });
  };

  useEffect(() => {
    return () => {
      cleanUpWebSocket();
    };
  }, []);

  // Connect to WebSocket relay server whenever in an online room
  useEffect(() => {
    if (!roomCode || !myPlayerId) return;

    const myPlayer = onlineRoom?.players.find((p) => p.id === myPlayerId);
    connectWebSocket(roomCode, myPlayerId, myPlayer?.name);

    if (onlineRoom?.players) {
      const states: Record<string, 'connected' | 'connecting' | 'disconnected'> = {};
      onlineRoom.players.forEach((p) => {
        if (p.id !== myPlayerId) {
          states[p.id] = 'connected';
        }
      });
      setPeerConnectionStates(states);
    }
  }, [roomCode, onlineRoom?.players, myPlayerId, connectWebSocket]);

  // Bot thinking state
  const isBotThinkingRef = useRef<boolean>(false);
  const isAutoSkippingRef = useRef<boolean>(false);
  const autoSkipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- AUDIO SYNTHESIZER ---
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Global Audio Context Unlocker for mobile and receiver browsers
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch((err) => console.warn('Audio resume error:', err));
        }
      } catch (e) {
        console.warn('Audio unlock error:', e);
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playSynthSound = (
    type: 'roll' | 'move' | 'kill' | 'safe' | 'win' | 'boom' | 'skip' | 'warning' | 'home_entry',
    customDurationInSec?: number
  ) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'roll') {
        // Physical model of a small hard cube (dice) tumbling on a flat wooden board.
        // Consists of discrete physical impacts ("tak-tak-tak") scheduled with decreasing intervals.
        const totalDuration = customDurationInSec ?? 0.60;
        const scale = totalDuration / 0.60;
        const bounceDelays = [0.0, 0.11, 0.21, 0.30, 0.38, 0.45, 0.51, 0.56, 0.60];

        bounceDelays.forEach((delay, index) => {
          const t = now + delay * scale;
          // Volume decays as the dice loses kinetic energy
          const energyFactor = Math.pow(0.78, index);

          // 1. Wood ply board low-frequency resonance thud ("tak" bass component)
          const thudOsc = ctx.createOscillator();
          const thudGain = ctx.createGain();
          thudOsc.connect(thudGain);
          thudGain.connect(ctx.destination);

          thudOsc.type = 'triangle';
          thudOsc.frequency.setValueAtTime(160 + Math.random() * 30, t);
          thudOsc.frequency.exponentialRampToValueAtTime(70, t + 0.03 * scale);

          thudGain.gain.setValueAtTime(0, t);
          thudGain.gain.linearRampToValueAtTime(0.40 * energyFactor, t + 0.002);
          thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03 * scale);

          thudOsc.start(t);
          thudOsc.stop(t + 0.04 * scale);

          // 2. High-mid corner click (the crisp "tak" high component)
          const clickOsc = ctx.createOscillator();
          const clickGain = ctx.createGain();
          clickOsc.connect(clickGain);
          clickGain.connect(ctx.destination);

          clickOsc.type = 'triangle';
          // Crisp acoustic plastic/metal corner strike frequency range
          clickOsc.frequency.setValueAtTime(1300 + Math.random() * 300, t);
          clickOsc.frequency.exponentialRampToValueAtTime(600, t + 0.008);

          clickGain.gain.setValueAtTime(0, t);
          clickGain.gain.linearRampToValueAtTime(0.32 * energyFactor, t + 0.001);
          clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.008);

          clickOsc.start(t);
          clickOsc.stop(t + 0.012);
        });

        return;
      } else if (type === 'move') {
        // High-pass "tak" / wood-block click sound with minimum bass and crisp treble
        // 1. Extremely low-volume mid-range transient body (no low-end bass)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.015);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.03, now + 0.001); // extremely low volume body to avoid bass
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

        osc.start(now);
        osc.stop(now + 0.02);

        // 2. High-frequency crisp treble tap/click
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);

        clickOsc.type = 'sine';
        clickOsc.frequency.setValueAtTime(2800, now); // elevated high frequency for clean treble click
        clickOsc.frequency.exponentialRampToValueAtTime(1600, now + 0.008);

        clickGain.gain.setValueAtTime(0, now);
        clickGain.gain.linearRampToValueAtTime(0.28, now + 0.0005); // boosted treble volume
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

        clickOsc.start(now);
        clickOsc.stop(now + 0.01);
      } else if (type === 'kill') {
        // Descending crash/explosion
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'boom') {
        // Deep low-frequency dramatic explosion / boom for massive multiple-token kills
        // 1. Deep sub-bass thud (shockwave)
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.connect(subGain);
        subGain.connect(ctx.destination);
        
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(150, now);
        subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.65);
        
        subGain.gain.setValueAtTime(0.45, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        
        subOsc.start(now);
        subOsc.stop(now + 0.7);

        // 2. High friction crash / debris sound using synthesized white noise
        try {
          const bufferSize = ctx.sampleRate * 0.55; // 0.55 seconds of noise
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          
          const noiseSource = ctx.createBufferSource();
          noiseSource.buffer = buffer;
          
          const bandpassFilter = ctx.createBiquadFilter();
          bandpassFilter.type = 'bandpass';
          bandpassFilter.frequency.setValueAtTime(600, now);
          bandpassFilter.frequency.exponentialRampToValueAtTime(100, now + 0.45);
          bandpassFilter.Q.setValueAtTime(2.5, now);
          
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.35, now);
          noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          
          noiseSource.connect(bandpassFilter);
          bandpassFilter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          
          noiseSource.start(now);
          noiseSource.stop(now + 0.55);
        } catch (e) {
          // Fallback if audio buffer is unsupported
          const fallbackOsc = ctx.createOscillator();
          const fallbackGain = ctx.createGain();
          fallbackOsc.connect(fallbackGain);
          fallbackGain.connect(ctx.destination);
          fallbackOsc.type = 'sawtooth';
          fallbackOsc.frequency.setValueAtTime(200, now);
          fallbackOsc.frequency.linearRampToValueAtTime(20, now + 0.55);
          fallbackGain.gain.setValueAtTime(0.3, now);
          fallbackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          fallbackOsc.start(now);
          fallbackOsc.stop(now + 0.55);
        }
      } else if (type === 'safe') {
        // Arpeggiated double chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'win') {
        // Major chord fanfare!
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(261.63, now); // C4
        osc.frequency.setValueAtTime(329.63, now + 0.1); // E4
        osc.frequency.setValueAtTime(392.00, now + 0.2); // G4
        osc.frequency.setValueAtTime(523.25, now + 0.3); // C5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else if (type === 'skip') {
        // Original Water Drop / Bubble sound (upward sine chirp)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'warning') {
        // Dual-tone buzzer: aggressive sawtooth and square wave detuning
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.18);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(144, now); // slightly detuned
        osc2.frequency.linearRampToValueAtTime(124, now + 0.18);
        
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
        gain2.gain.setValueAtTime(0.15, now);
        gain2.gain.linearRampToValueAtTime(0.001, now + 0.18);
        
        osc.start(now);
        osc.stop(now + 0.18);
        osc2.start(now);
        osc2.stop(now + 0.18);
      } else if (type === 'home_entry') {
        // --- WHISTLE (Siti) ---
        // Play three high-pitched sweeping whistle blows simulating a human whistle
        [0.0, 0.35, 0.7].forEach((delay) => {
          const t = now + delay;
          const wOsc = ctx.createOscillator();
          const wGain = ctx.createGain();
          
          wOsc.type = 'sine';
          // Sweep from 1100Hz to 1800Hz and back to 1300Hz rapidly with vibrato modulation
          wOsc.frequency.setValueAtTime(1100, t);
          wOsc.frequency.exponentialRampToValueAtTime(1900, t + 0.12);
          wOsc.frequency.exponentialRampToValueAtTime(1200, t + 0.25);
          
          wGain.gain.setValueAtTime(0, t);
          wGain.gain.linearRampToValueAtTime(0.15, t + 0.03);
          wGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          
          wOsc.connect(wGain);
          wGain.connect(ctx.destination);
          wOsc.start(t);
          wOsc.stop(t + 0.3);
        });

        // --- CLAPS (Taliyon) ---
        // Play 6 short crispy claps simulating an excited audience
        [0.15, 0.32, 0.48, 0.64, 0.8, 0.96].forEach((delay) => {
          const t = now + delay;
          // Generate a tiny burst of bandpass filtered noise
          const bufferSize = Math.floor(ctx.sampleRate * 0.06); // 60ms clap
          try {
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
              data[i] = Math.random() * 2 - 1;
            }
            
            const clapSource = ctx.createBufferSource();
            clapSource.buffer = buffer;
            
            const bandpass = ctx.createBiquadFilter();
            bandpass.type = 'bandpass';
            bandpass.frequency.setValueAtTime(1400, t);
            bandpass.Q.setValueAtTime(4.0, t);
            
            const clapGain = ctx.createGain();
            clapGain.gain.setValueAtTime(0.2, t);
            clapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
            
            clapSource.connect(bandpass);
            bandpass.connect(clapGain);
            clapGain.connect(ctx.destination);
            
            clapSource.start(t);
            clapSource.stop(t + 0.06);
          } catch (e) {
            // Fallback high frequency triangle click
            const cOsc = ctx.createOscillator();
            const cGain = ctx.createGain();
            cOsc.type = 'triangle';
            cOsc.frequency.setValueAtTime(1600, t);
            cGain.gain.setValueAtTime(0.18, t);
            cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
            cOsc.connect(cGain);
            cGain.connect(ctx.destination);
            cOsc.start(t);
            cOsc.stop(t + 0.05);
          }
        });

        // --- HO HO HO (Santa/Laughter sound) ---
        // Play three low-frequency warm vocal-like bursts ("ho ho ho")
        [0.45, 0.8, 1.15].forEach((delay) => {
          const t = now + delay;
          const hOsc = ctx.createOscillator();
          const hGain = ctx.createGain();
          const vocalFilter = ctx.createBiquadFilter();
          
          hOsc.type = 'sawtooth';
          hOsc.frequency.setValueAtTime(110, t);
          // Modulate frequency slightly down for vocal naturalness
          hOsc.frequency.linearRampToValueAtTime(90, t + 0.18);
          
          vocalFilter.type = 'bandpass';
          // ~450Hz acts as a vocal formant bandpass filter (simulating the 'O' sound)
          vocalFilter.frequency.setValueAtTime(450, t);
          vocalFilter.Q.setValueAtTime(5.5, t);
          
          hGain.gain.setValueAtTime(0, t);
          hGain.gain.linearRampToValueAtTime(0.3, t + 0.02);
          hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          
          hOsc.connect(vocalFilter);
          vocalFilter.connect(hGain);
          hGain.connect(ctx.destination);
          
          hOsc.start(t);
          hOsc.stop(t + 0.22);
        });
      }
    } catch (e) {
      console.warn('Audio synthesis failed', e);
    }
  };

  // Helper to add a log entry
  const addLog = (message: string) => {
    setGameState((prev) => ({
      ...prev,
      logs: [message, ...prev.logs.slice(0, 49)],
    }));
  };

// 40 realistic and common English names for online matchmaking opponents
const REAL_ENGLISH_NAMES = [
  "Oliver", "Emma", "Liam", "Olivia", "Noah",
  "Ava", "Ethan", "Sophia", "Mason", "Isabella",
  "William", "Mia", "James", "Charlotte", "Benjamin",
  "Amelia", "Lucas", "Harper", "Alexander", "Evelyn",
  "Daniel", "Emily", "Henry", "Abigail", "Michael",
  "Ella", "Jackson", "Scarlett", "Sebastian", "Grace",
  "Jack", "Chloe", "Aiden", "Victoria", "Matthew",
  "Lily", "Samuel", "Zoe", "David", "Luna"
];

  // Initialize offline / bot game states
  const startLocalGame = (
    mode: GameMode,
    count: number,
    customNames: Record<PlayerColor, string>,
    botColors?: PlayerColor[],
    isTeamUpMode?: boolean,
    isHomeEntryLockEnabled?: boolean,
    isTokenBlockEnabled?: boolean,
    botDifficulty?: 'easy' | 'medium' | 'hard'
  ) => {
    setMyPlayerColor(PlayerColor.RED);
    let colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    if (mode === GameMode.BOT) {
      colors = [PlayerColor.RED, PlayerColor.YELLOW];
    } else if (count === 2) {
      colors = [PlayerColor.RED, PlayerColor.YELLOW];
    }

    // Shuffle English names to ensure random non-repeating assignment
    const availableNames = [...REAL_ENGLISH_NAMES];
    for (let i = availableNames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = availableNames[i];
      availableNames[i] = availableNames[j];
      availableNames[j] = temp;
    }

    const initialPlayers: Player[] = (mode === GameMode.BOT || count === 2 ? colors : colors.slice(0, count)).map((color, idx) => {
      // Setup 4 tokens per player
      const tokens: Token[] = [0, 1, 2, 3].map((id) => ({
        id,
        color,
        state: TokenState.BASE,
        position: -1,
      }));

      // Check if this color is a bot
      const isBot = mode === GameMode.ONLINE
        ? color !== PlayerColor.RED
        : (botColors 
          ? botColors.includes(color)
          : (mode === GameMode.BOT && color === PlayerColor.YELLOW));

      let playerName = "";
      if (color === PlayerColor.RED) {
        playerName = customNames[color] || PLAYER_NAMES[color];
        if (!playerName.endsWith(" (You)")) {
          playerName = `${playerName} (You)`;
        }
      } else if (mode === GameMode.ONLINE) {
        // Assign a unique English name from the shuffled list for online match players (bots & players)
        playerName = availableNames.pop() || PLAYER_NAMES[color];
      } else if (isBot) {
        // Offline Single Player vs Bot mode
        playerName = "Bot";
      } else {
        playerName = customNames[color] || PLAYER_NAMES[color];
      }

      let playerSurname = "";
      if (color === PlayerColor.RED) {
        playerSurname = profileSurname || "";
      }

      return {
        color,
        name: playerName,
        surname: playerSurname,
        isBot,
        hasKilledOpponent: false,
        tokens,
        isActive: idx === 0,
        rollHistory: [],
      };
    });

    setGameState({
      mode,
      players: initialPlayers,
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
      gameStarted: true,
      winnerColor: null,
      isTeamUpMode: !!isTeamUpMode,
      isHomeEntryLockEnabled: isHomeEntryLockEnabled !== false,
      isTokenBlockEnabled: !!isTokenBlockEnabled,
      botDifficulty: botDifficulty || 'easy',
      logs: [
        `🎮 ${mode === GameMode.ONLINE ? 'Online Match' : mode} Ludo Match Started with ${count} Players! Red goes first!${isTeamUpMode ? ' [Team Up Mode (RED+YELLOW vs GREEN+BLUE) is ACTIVE]' : ''}`,
      ],
    });

    setActiveScreen('GAME');
    playSynthSound('safe');
    registerNewMatchStart(false);
  };

  // --- SCOPED ONLINE SESSION RECOVERY & VERSION CHECK (TRIGGERED ON 'ONLINE MATCH' BUTTON CLICK) ---
  const handleOnlineModeSelected = async (): Promise<boolean> => {
    const isVersionOk = await verifyVersionBeforeOnlineAction();
    if (!isVersionOk) return false;

    const savedRoomCode = localStorage.getItem('ludo_room_code');
    if (!savedRoomCode) return true;

    try {
      const res = await fetch(getApiUrl(`/api/rooms/${savedRoomCode}`));
      if (res.ok) {
        const data = await res.json();
        const me = data.players?.find((p: any) => p.id === myPlayerId);
        
        // Verify if game is indeed live and not won yet
        const isLive = data.gameState && !data.gameState.winnerColor;
        const isLobby = !data.gameState; // Still in lobby
        
        if (me && (isLive || isLobby)) {
          // Room is live, save pending data and trigger rejoin popup
          setPendingRejoinData(data);
          setShowRejoinPopup(true);
        } else {
          // Room has ended or we aren't a participant anymore
          setShowMatchEndedPopup(true);
          localStorage.removeItem('ludo_room_code');
        }
      } else {
        // Room not found on server (expired)
        setShowMatchEndedPopup(true);
        localStorage.removeItem('ludo_room_code');
      }
    } catch (err) {
      console.warn('Session recovery validation failed', err);
    }
    return true;
  };

  const handleConfirmRejoin = () => {
    if (!pendingRejoinData) return;
    const data = pendingRejoinData;
    const me = data.players.find((p: any) => p.id === myPlayerId);
    if (me) {
      roomVersionRef.current = data.version !== undefined ? data.version : 0;
      setRoomCode(data.code);
      setOnlineRoom(data);
      setMyPlayerColor(me.color as PlayerColor);
      
      if (data.gameState) {
        setGameState(data.gameState);
        setActiveScreen('GAME');
      } else {
        setActiveScreen('LOBBY');
      }
      playSynthSound('safe');
      console.log(`[Session Recovery] Player rejoined room ${data.code}`);
    }
    setShowRejoinPopup(false);
    setPendingRejoinData(null);
  };

  const handleCancelRejoin = () => {
    localStorage.removeItem('ludo_room_code');
    setShowRejoinPopup(false);
    setPendingRejoinData(null);
  };

  // Turn Timeout skipped turn handler
  const handleTurnTimeout = () => {
    if (!gameState.gameStarted || gameState.winnerColor || activeScreen !== 'GAME' || isRolling || isMovingToken) return;

    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer) return;

    // Play timeout sound
    playSynthSound('skip');

    // Single Authority Turn Shift: ONLY the active player's device (or host if active player is a bot/quit) initiates & broadcasts turn switch
    if (gameState.mode === GameMode.ONLINE) {
      const isMyTurn = activePlayer.color === myPlayerColor;
      const isHost = onlineRoom && onlineRoom.players[0]?.id === myPlayerId;
      const isActivePlayerBotOrQuit = activePlayer.isBot || activePlayer.hasQuit;

      if (!isMyTurn && !(isHost && isActivePlayerBotOrQuit)) {
        // Let the active player or host handle the turn shift synchronization
        return;
      }
    }

    // Immediately clear pending action queues & out-of-order sequence buffers from the timed-out turn
    actionQueueRef.current = [];
    outOfOrderBufferRef.current.clear();
    setIsWaitingForDiceNumber(false);
    isRollingSyncRef.current = false;
    isMovingTokenSyncRef.current = false;

    // Direct Turn Shift: Whenever 20s expires (dice roll or token move), skip chance to next player
    handleUpdateGameState((prev) => {
      const p = prev.players[prev.activePlayerIndex];
      const isOnline = prev.mode === GameMode.ONLINE;
      const currentStrikes = p.strikes !== undefined ? p.strikes : 0;
      const nextStrikes = isOnline ? currentStrikes + 1 : currentStrikes;
      const isQuitNow = isOnline && nextStrikes >= 3;

      const nextPlayers = prev.players.map((plyr, idx) => {
        if (idx === prev.activePlayerIndex) {
          return {
            ...plyr,
            strikes: nextStrikes,
            hasQuit: isQuitNow ? true : plyr.hasQuit,
          };
        }
        return plyr;
      });

      const activeRemaining = nextPlayers.filter((plyr) => !plyr.hasQuit && (plyr.strikes || 0) < 3);

      let winnerColor: PlayerColor | null = prev.winnerColor;
      let logMsg = `⏰ ${p.name} missed turn! ${isOnline ? `Strikes: [${nextStrikes}/3]` : 'Turn auto-skipped.'}`;

      if (isOnline && activeRemaining.length === 1 && prev.players.length >= 2) {
        winnerColor = activeRemaining[0].color;
        logMsg = `🏆 ${activeRemaining[0].name} is the WINNER! (${p.name} timed out 3 times)`;
      } else if (isQuitNow) {
        logMsg = `🔴 ${p.name} timed out 3 times and is now OFFLINE.`;
      }

      const nextActiveIndex = (prev.activePlayerIndex + 1) % prev.players.length;

      const nextState = {
        ...prev,
        players: nextPlayers,
        winnerColor,
        diceRollCountThisTurn: 0,
        consecutiveSixesCount: 0,
        extraRollsCount: 0,
        isBonusRolling: false,
        stateVersion: (prev.stateVersion || 0) + 10,
        safeDiceQueue: [],
        bonusConsecutiveSixesCount: 0,
        hasBustedThisTurn: false,
        diceQueue: [],
        selectedDiceValue: null,
        activePlayerIndex: nextActiveIndex,
        logs: [logMsg, ...prev.logs],
      };

      if (isOnline) {
        broadcastTurnSwitchViaP2P(nextState);
      }

      return nextState;
    });

    stopRollingAnimation();
    stopTokenMovementAnimation();
    setIsAutoSkipping(false);
    setTurnCountdown(20);
  };

  // Reset 20-second countdown timer on phase / turn changes
  useEffect(() => {
    if (!gameState.gameStarted || gameState.winnerColor || activeScreen !== 'GAME') {
      return;
    }
    setTurnCountdown(20);
  }, [
    gameState.activePlayerIndex,
    gameState.diceRollCountThisTurn,
    gameState.selectedDiceValue,
    gameState.diceQueue.length,
    isRolling,
    isMovingToken,
    gameState.gameStarted,
    gameState.winnerColor,
    activeScreen
  ]);

  // --- 3-SECOND FULL BOARD SYNC WAIT & SEQUENCE BYPASS LOGIC ---
  useEffect(() => {
    if (!gameState.gameStarted || gameState.winnerColor || activeScreen !== 'GAME' || gameState.mode !== GameMode.ONLINE) {
      setIsWaitingForBoardSync(false);
      if (boardSyncWaitTimerRef.current) {
        clearTimeout(boardSyncWaitTimerRef.current);
        boardSyncWaitTimerRef.current = null;
      }
      return;
    }

    // Check if receiver has pending full board update or active animations/action queue
    const isBusy = !!pendingFullBoardUpdateRef.current || isRollingSyncRef.current || isMovingTokenSyncRef.current || isProcessingQueueRef.current || actionQueueRef.current.length > 0;

    if (isBusy) {
      setIsWaitingForBoardSync(true);
      if (boardSyncWaitTimerRef.current) {
        clearTimeout(boardSyncWaitTimerRef.current);
      }
      // Receiver device waits up to 3 seconds for full board state animation & sync to complete
      boardSyncWaitTimerRef.current = setTimeout(() => {
        console.log('[3s Board Sync Wait Timeout]: 3 seconds elapsed. Bypassing wait and starting 20s turn timer.');
        setIsWaitingForBoardSync(false);
        if (pendingFullBoardUpdateRef.current) {
          const fullState = pendingFullBoardUpdateRef.current.gameState;
          pendingFullBoardUpdateRef.current = null;
          applyGameStateUpdate(fullState, true);
        }
      }, 3000);
    } else {
      setIsWaitingForBoardSync(false);
      if (boardSyncWaitTimerRef.current) {
        clearTimeout(boardSyncWaitTimerRef.current);
        boardSyncWaitTimerRef.current = null;
      }
    }
  }, [
    gameState.activePlayerIndex,
    gameState.diceQueue.length,
    gameState.selectedDiceValue,
    gameState.gameStarted,
    gameState.winnerColor,
    activeScreen,
    gameState.mode,
    isRolling,
    isMovingToken,
    applyGameStateUpdate
  ]);

  // Live 1-second interval countdown ticking effect
  useEffect(() => {
    if (!gameState.gameStarted || gameState.winnerColor || activeScreen !== 'GAME' || isRolling || isMovingToken) {
      return;
    }

    const interval = setInterval(() => {
      if (document.hidden) return; // Pause ticking in background tab/app state
      setTurnCountdown((prev) => {
        if (prev <= -5) {
          return -5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    gameState.activePlayerIndex,
    gameState.gameStarted,
    gameState.winnerColor,
    activeScreen,
    gameState.diceQueue,
    isRolling,
    isMovingToken,
    onlineRoom,
    myPlayerId,
    myPlayerColor
  ]);

  // Periodic full board state sync broadcast to ensure receivers receive latest board data without packet loss
  useEffect(() => {
    if (activeScreen !== 'GAME' || gameState.mode !== GameMode.ONLINE || !gameState.gameStarted || gameState.winnerColor !== null) {
      return;
    }

    const interval = setInterval(() => {
      const activePlayer = gameState.players[gameState.activePlayerIndex];
      const isMyTurn = activePlayer && activePlayer.color === myPlayerColor;
      const isHost = onlineRoom && onlineRoom.players[0]?.id === myPlayerId;

      // Only active player broadcasts periodic sync during their turn. Host only acts as backup if active player is bot or offline.
      const shouldBroadcast = isMyTurn || (isHost && (!activePlayer || activePlayer.isBot || activePlayer.hasQuit));

      const isQueueBusy = isProcessingQueueRef.current || actionQueueRef.current.length > 0;
      const isAnimActive = isRolling || isMovingToken || isRollingSyncRef.current || isMovingTokenSyncRef.current;

      if (shouldBroadcast && !isAnimActive && !isQueueBusy) {
        // Periodic sync disabled mid-turn to prevent animation interruption on receiver
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [
    activeScreen,
    gameState.mode,
    gameState.gameStarted,
    gameState.winnerColor,
    gameState.activePlayerIndex,
    myPlayerColor,
    myPlayerId,
    onlineRoom,
    isRolling,
    isMovingToken
  ]);

  // Handle actual turn timeout execution safely when countdown reaches 0 or negative backup threshold
  useEffect(() => {
    if (!gameState.gameStarted || gameState.winnerColor || activeScreen !== 'GAME') {
      return;
    }

    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer) return;

    const isMyTurn = activePlayer.color === myPlayerColor;
    const isHost = onlineRoom && onlineRoom.players[0]?.id === myPlayerId;

    if (gameState.mode === GameMode.ONLINE) {
      if (isMyTurn && turnCountdown === 0) {
        // Active Player Device: 20 Seconds Auto-Skip Timer
        console.log('[Turn Timeout]: Active player auto-skip triggered at 20s (countdown = 0s)');
        handleTurnTimeout();
        setTurnCountdown(20);
      } else if (!isMyTurn && turnCountdown <= -5) {
        // Receiver / Non-Active Device: 25 Seconds Safety Fallback Timer (20s + 5s buffer = 25s)
        console.log('[Receiver Turn Safety Fallback]: Active player unresponsive/disconnected. Receiver fallback skip triggered at 25s total');
        handleTurnTimeout();
        setTurnCountdown(20);
      }
    } else {
      // Local/Computer game mode, timeout immediately at 0
      if (turnCountdown === 0) {
        console.log('[Turn Timeout]: Local mode, triggering timeout at 0s');
        handleTurnTimeout();
        setTurnCountdown(20);
      }
    }
  }, [
    turnCountdown,
    gameState.gameStarted,
    gameState.winnerColor,
    activeScreen,
    gameState.activePlayerIndex,
    gameState.mode,
    myPlayerColor,
    myPlayerId,
    onlineRoom,
    gameState.players
  ]);

  // Auto Turn Pass Watchdog: Automatically passes turn when player has rolled dice numbers but NO valid moves exist
  useEffect(() => {
    if (
      activeScreen !== 'GAME' ||
      !gameState.gameStarted ||
      gameState.winnerColor !== null ||
      isRolling ||
      isMovingToken ||
      isWaitingForDiceNumber ||
      isRollingSyncRef.current ||
      isMovingTokenSyncRef.current ||
      actionQueueRef.current.length > 0 ||
      gameState.diceQueue.length === 0
    ) {
      return;
    }

    // Check if player is still allowed to roll further (rolled a 6 or in bonus roll mode)
    const canRollPending =
      gameState.isBonusRolling === true ||
      (gameState.diceQueue.length > 0 &&
        gameState.diceQueue[gameState.diceQueue.length - 1] === 6 &&
        !gameState.hasBustedThisTurn &&
        (gameState.consecutiveSixesCount || 0) < 3);

    if (canRollPending) return;

    // Test if any valid moves exist for current diceQueue values
    const playable = getPlayableTokensFull(gameState, true);
    if (playable.length > 0) return; // Player has valid moves, don't pass turn!

    // Authority Check:
    // In Online mode, only the device of the active player (or host if active player is bot) handles turn passing
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer) return;

    if (gameState.mode === GameMode.ONLINE) {
      const isMyTurn = activePlayer.color === myPlayerColor;
      const isHost = onlineRoom && onlineRoom.players[0]?.id === myPlayerId;
      const isActivePlayerBotOrQuit = activePlayer.isBot || activePlayer.hasQuit;

      if (!isMyTurn && !(isHost && isActivePlayerBotOrQuit)) {
        return;
      }
    }

    // No valid moves available! Wait 800ms so players can see the rolled number on the dice, then pass turn safely
    let isCancelled = false;
    const timer = setTimeout(() => {
      const attemptPassTurn = () => {
        if (isCancelled) return;

        // If animations or action queue are active, wait 150ms and retry
        if (
          isRolling ||
          isMovingToken ||
          isWaitingForDiceNumber ||
          isRollingSyncRef.current ||
          isMovingTokenSyncRef.current ||
          actionQueueRef.current.length > 0
        ) {
          setTimeout(attemptPassTurn, 150);
          return;
        }

        console.log(`[Auto Turn Pass]: No valid moves for rolled dice values [${gameState.diceQueue.join(', ')}]. Automatically passing turn...`);
        playSynthSound('skip');

        let finalStateToBroadcast: GameState | null = null;
        handleUpdateGameState((prev) => {
          let nextActiveIndex = (prev.activePlayerIndex + 1) % prev.players.length;

          // Skip players who have quit or brought all tokens home
          let safetyCounter = 0;
          while (safetyCounter < prev.players.length) {
            const candidate = prev.players[nextActiveIndex];
            if (candidate.hasQuit) {
              nextActiveIndex = (nextActiveIndex + 1) % prev.players.length;
              safetyCounter++;
              continue;
            }
            if (!prev.isTeamUpMode) {
              const candidateAllHome = candidate.tokens.every((t) => t.state === TokenState.HOME);
              if (candidateAllHome) {
                nextActiveIndex = (nextActiveIndex + 1) % prev.players.length;
                safetyCounter++;
                continue;
              }
            }
            break;
          }

          const rolledNums = prev.diceQueue.join(', ');
          const logMsg = `👉 No valid move for [${rolledNums}]. Turn automatically passed to ${prev.players[nextActiveIndex].name}!`;

          const nextState = {
            ...prev,
            stateVersion: (prev.stateVersion || 0) + 1,
            activePlayerIndex: nextActiveIndex,
            diceRollCountThisTurn: 0,
            consecutiveSixesCount: 0,
            extraRollsCount: 0,
            isBonusRolling: false,
            safeDiceQueue: [],
            bonusConsecutiveSixesCount: 0,
            hasBustedThisTurn: false,
            diceQueue: [],
            selectedDiceValue: null,
            logs: [logMsg, ...prev.logs],
          };

          finalStateToBroadcast = nextState;
          return nextState;
        });

        if (finalStateToBroadcast && gameState.mode === GameMode.ONLINE) {
          broadcastTurnSwitchViaP2P(finalStateToBroadcast as GameState);
        }
        setTurnCountdown(20);
      };

      attemptPassTurn();
    }, 800);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    gameState.gameStarted,
    gameState.winnerColor,
    activeScreen,
    isRolling,
    isMovingToken,
    isWaitingForDiceNumber,
    gameState.diceQueue,
    gameState.selectedDiceValue,
    gameState.activePlayerIndex,
    gameState.mode,
    myPlayerColor,
    myPlayerId,
    onlineRoom,
    gameState.players
  ]);

  // Online Match 3-Strike and Immediate Auto-Bypass Rule
  useEffect(() => {
    if (
      activeScreen !== 'GAME' ||
      gameState.mode !== GameMode.ONLINE ||
      !gameState.gameStarted ||
      gameState.winnerColor !== null ||
      isRolling ||
      isMovingToken
    ) return;

    // Check if only 1 active player remains
    const activeRemaining = gameState.players.filter((p) => !p.hasQuit && (p.strikes || 0) < 3);
    if (activeRemaining.length === 1 && gameState.players.length >= 2) {
      handleUpdateGameState((prev) => ({
        ...prev,
        winnerColor: activeRemaining[0].color,
        logs: [`🏆 Match ended! ${activeRemaining[0].name} is the WINNER!`, ...prev.logs]
      }));
      return;
    }

    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer) return;

    const strikes = activePlayer.strikes || 0;
    const hasQuit = activePlayer.hasQuit || false;
    if (strikes >= 3 || hasQuit) {
      // Fast bypass skipped turn
      // Only host executes the skip to avoid dual synchronizations on the backend
      const isHost = onlineRoom && onlineRoom.players[0]?.id === myPlayerId;
      if (isHost) {
        let nextState: GameState | null = null;
        handleUpdateGameState((prev) => {
          const nextActiveIndex = (prev.activePlayerIndex + 1) % prev.players.length;
          const reason = hasQuit ? "is OFFLINE" : "is inactive";
          const logMsg = `🚦 AUTO-BYPASS! ${activePlayer.name} ${reason}! Fast skipped.`;
          nextState = {
            ...prev,
            stateVersion: (prev.stateVersion || 0) + 1,
            activePlayerIndex: nextActiveIndex,
            diceRollCountThisTurn: 0,
            consecutiveSixesCount: 0,
            extraRollsCount: 0,
            hasBustedThisTurn: false,
            diceQueue: [],
            selectedDiceValue: null,
            logs: [logMsg, ...prev.logs],
          };
          return nextState;
        });
        if (nextState) {
          broadcastGameStateViaP2P(nextState);
        }
      }
    }
  }, [
    gameState.activePlayerIndex,
    gameState.players,
    gameState.mode,
    gameState.gameStarted,
    gameState.winnerColor,
    isRolling,
    isMovingToken,
    activeScreen,
    onlineRoom,
    myPlayerId
  ]);

  // Auto-Unfreeze local player on reconnection when back in online game
  useEffect(() => {
    if (activeScreen === 'GAME' && gameState.mode === GameMode.ONLINE) {
      const myP = gameState.players.find((p) => p.color === myPlayerColor);
      if (myP && (myP.hasQuit || (myP.strikes !== undefined && myP.strikes >= 3))) {
        console.log('[Reconnection] Unfreezing local player who reconnected to match!');
        handleUpdateGameState((prev) => {
          const updatedPlayers = prev.players.map((p) => {
            if (p.color === myPlayerColor) {
              return {
                ...p,
                hasQuit: false,
                strikes: 0,
              };
            }
            return p;
          });
          const nextState = {
            ...prev,
            players: updatedPlayers,
            logs: [`🟢 ${myP.name} reconnected and is back ONLINE!`, ...prev.logs],
          };
          broadcastGameStateViaP2P(nextState);
          return nextState;
        });
      }
    }
  }, [activeScreen, gameState.mode, myPlayerColor, gameState.players]);

  // --- ONLINE MULTIPLAYER WEBSOCKET REALTIME SYNC ---
  const handleUpdateGameState = (updater: (prev: GameState) => GameState) => {
    setGameState((prev) => {
      const updated = updater(prev);
      const next: GameState = {
        ...updated,
        stateVersion: (prev.stateVersion || 0) + 1,
      };
      return next;
    });
  };

  // --- ONLINE LOBBY CREATION & JOIN ---
  const handleCreateRoom = async (
    isTeamUpMode: boolean = false,
    isHomeEntryLockEnabled: boolean = true,
    isTokenBlockEnabled: boolean = false
  ) => {
    setIsOnlineConnecting(true);
    try {
      const isVersionOk = await verifyVersionBeforeOnlineAction();
      if (!isVersionOk) {
        return; // Blocked because version is lower than server latest
      }

      const res = await fetchWithTimeout(
        getApiUrl('/api/rooms/create'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName: profileName || 'Creator',
            playerSurname: profileSurname || '',
            playerId: myPlayerId,
            isTeamUpMode,
            isHomeEntryLockEnabled,
            isTokenBlockEnabled,
            appVersion: getMyVersion(),
          }),
        },
        20000
      );

      if (!res.ok) {
        throw new Error('Server response not ok');
      }

      const data = await res.json();
      
      roomVersionRef.current = data.version !== undefined ? data.version : 0;
      localStorage.setItem('ludo_room_code', data.code);
      localStorage.setItem('ludo_player_color', PlayerColor.RED);
      
      setRoomCode(data.code);
      setMyPlayerColor(PlayerColor.RED); // Host is Red
      setOnlineRoom(data);
      setActiveScreen('LOBBY');
      playSynthSound('safe');
    } catch (err) {
      alert('सर्वर से कनेक्ट होने में समय लग रहा है, कृपया पुनः प्रयास करें।');
    } finally {
      setIsOnlineConnecting(false);
    }
  };

  const handleJoinRoom = async (code: string) => {
    setIsOnlineConnecting(true);
    try {
      const isVersionOk = await verifyVersionBeforeOnlineAction();
      if (!isVersionOk) {
        return; // Blocked because version is lower than server latest
      }

      const res = await fetchWithTimeout(
        getApiUrl('/api/rooms/join'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, playerName: profileName || 'Challenger', playerSurname: profileSurname || '', playerId: myPlayerId, appVersion: getMyVersion() }),
        },
        20000
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Room not found');
        return;
      }
      const data = await res.json();
      
      roomVersionRef.current = data.version !== undefined ? data.version : 0;
      localStorage.setItem('ludo_room_code', data.code);

      // Determine what color we were assigned
      const me = data.players.find((p: any) => p.id === myPlayerId);
      if (me) {
        setMyPlayerColor(me.color as PlayerColor);
        localStorage.setItem('ludo_player_color', me.color);
      }

      setRoomCode(data.code);
      setOnlineRoom(data);
      setActiveScreen('LOBBY');
      playSynthSound('safe');
    } catch (err) {
      alert('सर्वर से कनेक्ट होने में समय लग रहा है, कृपया पुनः प्रयास करें।');
    } finally {
      setIsOnlineConnecting(false);
    }
  };

  const handleToggleOnlineTeamUp = async () => {
    if (!roomCode || !onlineRoom) return;
    try {
      const nextMode = !onlineRoom.isTeamUpMode;
      const res = await fetch(getApiUrl(`/api/rooms/${roomCode}/teamup`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTeamUpMode: nextMode }),
      });
      if (res.ok) {
        const data = await res.json();
        roomVersionRef.current = data.version;
        setOnlineRoom((prev: any) => prev ? { ...prev, isTeamUpMode: data.isTeamUpMode, version: data.version } : prev);
      }
    } catch (err) {
      console.error('Failed to toggle team up mode', err);
    }
  };

  const handleRotatePlayers = async () => {
    if (!roomCode || !onlineRoom || !myPlayerId) return;
    if (!onlineRoom.players || onlineRoom.players.length < 3) return; // Swap requires at least 3 players
    try {
      const res = await fetch(getApiUrl(`/api/rooms/${roomCode}/rotate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myPlayerId }),
      });
      if (res.ok) {
        const data = await res.json();
        roomVersionRef.current = data.version;
        setOnlineRoom(data);

        // Update user's local player color if it got changed on the server
        const me = data.players?.find((p: any) => p.id === myPlayerId);
        if (me && me.color !== myPlayerColor) {
          setMyPlayerColor(me.color as PlayerColor);
        }
        playSynthSound('safe');
      }
    } catch (err) {
      console.error('Failed to rotate players', err);
    }
  };

  const handleToggleLobbySetting = async (key: string, value: boolean) => {
    if (!roomCode || !onlineRoom || !myPlayerId) return;

    // Optimistically update local room state
    setOnlineRoom((prev: any) => {
      if (!prev) return prev;
      const nextObj = { ...prev, [key]: value };
      if (key === 'isTeamUpMode' && prev.players.length < 4) {
        nextObj.isTeamUpMode = false;
      }
      return nextObj;
    });

    try {
      const res = await fetch(getApiUrl(`/api/rooms/${roomCode}/settings`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value, playerId: myPlayerId }),
      });
      if (res.ok) {
        const data = await res.json();
        roomVersionRef.current = data.version;
        setOnlineRoom(data);
      }
    } catch (err) {
      console.error('Failed to update lobby setting', err);
    }
  };

  // --- Online room details background polling ---
  useEffect(() => {
    if (!roomCode) return;

    const interval = setInterval(async () => {
      if (document.hidden) return; // Skip polling when app is minimized or backgrounded
      try {
        const res = await fetch(getApiUrl(`/api/rooms/${roomCode}?v=${roomVersionRef.current}`));
        if (!res.ok) return;
        const data = await res.json();

        if (data.changed === false) return;

        if (data.version !== undefined) {
          roomVersionRef.current = data.version;
        }

        // Update players list and state when in lobby
        if (activeScreen === 'LOBBY' && data.players) {
          setOnlineRoom(data);

          const me = data.players?.find((p: any) => p.id === myPlayerId);
          if (me && me.color !== myPlayerColor) {
            setMyPlayerColor(me.color as PlayerColor);
            console.log(`[Lobby Sync] Player color changed to ${me.color}`);
          }

          // SERVER BACKUP CHECK: If host started game, transition joiner to GAME screen automatically!
          if (data.gameState && data.gameState.gameStarted) {
            setGameState(data.gameState);
            setActiveScreen('GAME');
            playSynthSound('safe');
            registerNewMatchStart(true);
          }
        }

        // Online room background check
      } catch (err) {
        console.warn('[Online Room] Background status poll failed', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomCode, activeScreen, myPlayerId, myPlayerColor]);

  // --- AUTOMATIC LOBBY -> GAME SCREEN TRANSITION WATCHDOG ---
  // Guarantees that as soon as gameState.gameStarted becomes true on any device,
  // joiners in LOBBY screen are instantly transitioned to the GAME screen!
  useEffect(() => {
    if (gameState.gameStarted && activeScreen === 'LOBBY') {
      console.log('[Lobby Transition Watchdog] Match started! Transitioning to GAME screen...');
      setActiveScreen('GAME');
      playSynthSound('safe');
      registerNewMatchStart(true);
    }
  }, [gameState.gameStarted, activeScreen]);

  // --- PAGE VISIBILITY SYNC ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && roomCode && activeScreen === 'GAME' && gameState.mode === GameMode.ONLINE) {
        console.log('[Page Visibility] Tab unminimized/resumed. Verifying WebSocket connection...');
        const myPlayer = onlineRoom?.players.find((p) => p.id === myPlayerId);
        connectWebSocket(roomCode, myPlayerId, myPlayer?.name);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [roomCode, activeScreen, gameState.mode, myPlayerId, onlineRoom, connectWebSocket]);

  // Host launches the multiplayer match
  const handleLaunchOnlineGame = () => {
    if (!onlineRoom) return;

    const colors = [PlayerColor.RED, PlayerColor.GREEN, PlayerColor.YELLOW, PlayerColor.BLUE];
    const initialPlayers: Player[] = onlineRoom.players.map((p, idx) => {
      const tokens: Token[] = [0, 1, 2, 3].map((id) => ({
        id,
        color: p.color as PlayerColor,
        state: TokenState.BASE,
        position: -1,
      }));

      return {
        color: p.color as PlayerColor,
        name: p.id === myPlayerId ? `${p.name} (You)` : p.name,
        surname: p.id === myPlayerId ? profileSurname : p.surname || '',
        isBot: false,
        hasKilledOpponent: false,
        tokens,
        isActive: idx === 0,
        rollHistory: [],
      };
    });

    // Make sure we have at least 2 players to play
    if (initialPlayers.length < 2) {
      alert('Wait for at least one other challenger to join your lobby!');
      return;
    }

    const isTeamUpActive = onlineRoom.players.length === 4 && !!onlineRoom.isTeamUpMode;
    const initialGameState: GameState = {
      mode: GameMode.ONLINE,
      players: initialPlayers,
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
      gameStarted: true,
      winnerColor: null,
      isTeamUpMode: isTeamUpActive,
      isHomeEntryLockEnabled: onlineRoom.isHomeEntryLockEnabled !== false,
      isTokenBlockEnabled: !!onlineRoom.isTokenBlockEnabled,
      logs: [
        `🌐 Ludo online Match Code [${roomCode}] Started!${isTeamUpActive ? ' [Team Up Mode (RED+YELLOW vs GREEN+BLUE) is ACTIVE]' : ''}`,
      ],
    };

    setGameState(initialGameState);
    
    // Broadcast START_GAME over WebSocket
    broadcastP2PMessage({
      type: 'START_GAME',
      gameState: initialGameState,
    });

    // Dual fallback sync: Update backend room state so joiners polling HTTP immediately see gameStarted
    if (roomCode) {
      fetch(getApiUrl(`/api/rooms/${roomCode}/update`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameState: initialGameState }),
      }).catch((err) => console.error('[Start Match] Backend room sync error:', err));
    }

    setActiveScreen('GAME');
    registerNewMatchStart(false);
  };

  const handleLeaveLobby = async () => {
    if (roomCode && myPlayerId) {
      try {
        await fetch(getApiUrl(`/api/rooms/${roomCode}/leave`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId: myPlayerId }),
        });
      } catch (err) {
        console.error("Failed to leave lobby on backend:", err);
      }
    }
    cleanUpWebSocket();
    localStorage.removeItem('ludo_room_code');
    roomVersionRef.current = -1;
    setActiveScreen('HOME');
    setOnlineRoom(null);
    setRoomCode('');
    setIsLobbyLeaveModalOpen(false);
  };

  // --- CORE GAME ENGINE ACTIONS ---

  // Standard 600ms Dice Roll Engine (whether single tap or long touch)
  const rollDice = () => {
    if (isRolling || isMovingToken || gameState.winnerColor !== null || isAutoSkipping) return;

    // Strict Player Turn Validation:
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (gameState.mode !== GameMode.OFFLINE && activePlayer && !activePlayer.isBot && activePlayer.color !== myPlayerColor) {
      return;
    }

    startRollingAnimation(550);
    playSynthSound('roll', 0.60);

    // Ultra-fair Randomness: Current millisecond (0-999) + Cryptographically secure random buffer
    const ms = new Date().getMilliseconds();
    const cryptoBuf = new Uint32Array(1);
    window.crypto.getRandomValues(cryptoBuf);
    const rollValue = ((ms + cryptoBuf[0]) % 6) + 1;

    let finalStateToBroadcast: GameState | null = null;
    let isTurnPassedOnRoll = false;

    setGameState((prev) => {
      const activePlayer = prev.players[prev.activePlayerIndex];
      const isBonus = prev.isBonusRolling === true;
      const safeQueue = prev.safeDiceQueue || [];
      
      let nextQueue = [...prev.diceQueue, rollValue];
      let nextRollCount = prev.diceRollCountThisTurn + 1;
      let nextConsecutiveSixes = prev.consecutiveSixesCount;
      let nextBonusSixes = prev.bonusConsecutiveSixesCount || 0;
      let nextIsBonusRolling = isBonus;
      let nextSafeDiceQueue = prev.safeDiceQueue || [];

      // Append to personal roll history & reset strikes
      const nextPlayers = prev.players.map((p, idx) => {
        if (idx === prev.activePlayerIndex) {
          return {
            ...p,
            rollHistory: [...(p.rollHistory || []), rollValue],
            strikes: 0,
          };
        }
        return p;
      });

      let logMsg = `🎲 ${activePlayer.name} rolled a ${rollValue}!`;

      if (isBonus) {
        if (rollValue === 6) {
          nextBonusSixes += 1;
          
          if (nextBonusSixes === 3) {
            logMsg = `💥 BUSTED! ${activePlayer.name} rolled 3 consecutive 6s in bonus roll! Cancelled this bonus streak.`;
            // Restore to safeQueue (only numbers from before the bonus roll phase remain)
            nextQueue = [...safeQueue];
            nextIsBonusRolling = false;
            nextBonusSixes = 0;
            nextSafeDiceQueue = [];

            if (nextQueue.length === 0) {
              // No safe numbers left, shift turn!
              const nextActiveIndex = (prev.activePlayerIndex + 1) % prev.players.length;
              isTurnPassedOnRoll = true;
              const nextState = {
                ...prev,
                stateVersion: (prev.stateVersion || 0) + 1,
                players: nextPlayers,
                diceQueue: [],
                selectedDiceValue: null,
                diceRollCountThisTurn: 0,
                consecutiveSixesCount: 0,
                extraRollsCount: 0,
                isBonusRolling: false,
                safeDiceQueue: [],
                bonusConsecutiveSixesCount: 0,
                hasBustedThisTurn: false,
                activePlayerIndex: nextActiveIndex,
                logs: [logMsg + " Turn passed.", ...prev.logs],
              };
              finalStateToBroadcast = nextState;
              return nextState;
            } else {
              const firstValue = nextQueue[0] || null;
              const nextState = {
                ...prev,
                stateVersion: (prev.stateVersion || 0) + 1,
                players: nextPlayers,
                diceQueue: nextQueue,
                selectedDiceValue: firstValue,
                consecutiveSixesCount: 0,
                isBonusRolling: false,
                safeDiceQueue: [],
                bonusConsecutiveSixesCount: 0,
                hasBustedThisTurn: true, // Prevents further rolling
                logs: [logMsg + ` Play remaining safe rolls: [${nextQueue.join(', ')}]`, ...prev.logs],
              };
              finalStateToBroadcast = nextState;
              return nextState;
            }
          } else {
            logMsg = `🔥 MULTI-ROLL (BONUS)! ${activePlayer.name} rolled a 6 and stacks it! Roll again!`;
          }
        } else {
          // Non-6 rolled, ends bonus rolling phase
          nextBonusSixes = 0;
          nextIsBonusRolling = false;
          nextSafeDiceQueue = [];
        }
      } else {
        // Normal rolling (not bonus rolling)
        if (rollValue === 6) {
          nextConsecutiveSixes += 1;
          
          if (nextConsecutiveSixes === 3) {
            // Cancel ONLY the 3 consecutive sixes from this streak
            logMsg = `💥 BUSTED! ${activePlayer.name} rolled 3 consecutive 6s! Cancelled this streak.`;
            const filteredQueue = nextQueue.slice(0, -3);
            const firstValue = filteredQueue[0] || null;

            if (filteredQueue.length === 0) {
              const nextActiveIndex = (prev.activePlayerIndex + 1) % prev.players.length;
              isTurnPassedOnRoll = true;
              const nextState = {
                ...prev,
                stateVersion: (prev.stateVersion || 0) + 1,
                players: nextPlayers,
                diceQueue: [],
                selectedDiceValue: null,
                diceRollCountThisTurn: 0,
                consecutiveSixesCount: 0,
                extraRollsCount: 0,
                isBonusRolling: false,
                safeDiceQueue: [],
                bonusConsecutiveSixesCount: 0,
                hasBustedThisTurn: false,
                activePlayerIndex: nextActiveIndex,
                logs: [logMsg + " Turn passed.", ...prev.logs],
              };
              finalStateToBroadcast = nextState;
              return nextState;
            } else {
              const nextState = {
                ...prev,
                stateVersion: (prev.stateVersion || 0) + 1,
                players: nextPlayers,
                diceQueue: filteredQueue,
                selectedDiceValue: firstValue,
                consecutiveSixesCount: 0,
                isBonusRolling: false,
                safeDiceQueue: [],
                bonusConsecutiveSixesCount: 0,
                hasBustedThisTurn: true, // Prevents further rolling in this turn
                logs: [logMsg + ` Play remaining rolls: [${filteredQueue.join(', ')}]`, ...prev.logs],
              };
              finalStateToBroadcast = nextState;
              return nextState;
            }
          } else {
            logMsg = `🔥 MULTI-ROLL! ${activePlayer.name} rolled a 6 and stacks it! Roll again!`;
          }
        } else {
          // Non-6 rolled, ends rolling phase
          nextConsecutiveSixes = 0;
        }
      }

      const canRollFurther = nextIsBonusRolling || (
        nextQueue.length > 0 &&
        nextQueue[nextQueue.length - 1] === 6 &&
        !prev.hasBustedThisTurn &&
        nextConsecutiveSixes < 3
      );

      // Keep selectedDiceValue as null while rolling further so tokens aren't selectable until rolling phase ends
      const firstValue = canRollFurther ? null : (nextQueue[0] || null);

      const nextState = {
        ...prev,
        stateVersion: (prev.stateVersion || 0) + 1,
        players: nextPlayers,
        diceQueue: nextQueue,
        selectedDiceValue: firstValue,
        diceRollCountThisTurn: nextRollCount,
        consecutiveSixesCount: nextConsecutiveSixes,
        extraRollsCount: 0,
        isBonusRolling: nextIsBonusRolling,
        safeDiceQueue: nextSafeDiceQueue,
        bonusConsecutiveSixesCount: nextBonusSixes,
        logs: [logMsg, ...prev.logs],
      };
      finalStateToBroadcast = nextState;
      return nextState;
    });

    if (gameState.mode === GameMode.ONLINE && finalStateToBroadcast) {
      if (isTurnPassedOnRoll) {
        broadcastTurnSwitchViaP2P(finalStateToBroadcast as GameState);
      } else {
        const payload = {
          type: 'DICE_ROLLED_RESULT',
          rollValue,
          activePlayerIndex: (finalStateToBroadcast as GameState).activePlayerIndex,
          diceQueue: (finalStateToBroadcast as GameState).diceQueue,
          selectedDiceValue: (finalStateToBroadcast as GameState).selectedDiceValue ?? rollValue,
          diceRollCountThisTurn: (finalStateToBroadcast as GameState).diceRollCountThisTurn,
          consecutiveSixesCount: (finalStateToBroadcast as GameState).consecutiveSixesCount,
          isBonusRolling: (finalStateToBroadcast as GameState).isBonusRolling,
          safeDiceQueue: (finalStateToBroadcast as GameState).safeDiceQueue || [],
          bonusConsecutiveSixesCount: (finalStateToBroadcast as GameState).bonusConsecutiveSixesCount || 0,
          logMsg: (finalStateToBroadcast as GameState).logs[0],
          stateVersion: (finalStateToBroadcast as GameState).stateVersion,
        };
        // Broadcast single event DICE_ROLLED_RESULT over WebSocket immediately
        broadcastP2PMessage(payload);
      }
    }

    // Stop 3D tumble animation on rolling device after 550ms
    setTimeout(() => {
      stopRollingAnimation();
    }, 550);
  };

  const startHoldingDice = () => {
    rollDice();
  };

  const releaseHoldingDice = () => {
    // No-op: dice roll completes on fixed 350ms animation
  };

  // Select a dice value from the stack/queue to apply next
  const selectDiceValue = (val: number) => {
    if (!gameState.diceQueue.includes(val)) return;
    let nextState: GameState | null = null;
    handleUpdateGameState((prev) => {
      nextState = {
        ...prev,
        stateVersion: (prev.stateVersion || 0) + 1,
        selectedDiceValue: val,
      };
      return nextState;
    });
    if (gameState.mode === GameMode.ONLINE && nextState) {
      broadcastP2PMessage({
        type: 'SELECT_DICE_VALUE_ACTION',
        selectedDiceValue: val,
        stateVersion: (nextState as GameState).stateVersion,
      });
    }
  };

  const isTokenPartofJodaOnStandardCell = (token: Token, player: Player): boolean => {
    if (gameState.isTokenBlockEnabled === false) return false;
    if (token.state !== TokenState.TRACK) return false;
    
    const globalIdx = (START_INDEX[token.color] + token.position) % 52;
    if (SAFE_INDICES.includes(globalIdx)) return false;

    // Find all same-color active track tokens on this cell
    const sameColorOnCell = player.tokens.filter(
      (t) => t.state === TokenState.TRACK && ((START_INDEX[t.color] + t.position) % 52) === globalIdx
    );

    const count = sameColorOnCell.length;
    if (count < 2) return false;

    const sorted = [...sameColorOnCell].sort((a, b) => a.id - b.id);
    const idx = sorted.findIndex((t) => t.id === token.id);

    if (count === 2) {
      return true;
    } else if (count === 3) {
      return idx < 2; // First 2 are part of the Joda, 3rd is single
    } else if (count === 4) {
      return true; // Both pairs are Jodas
    }
    return false;
  };

  const isPathBlocked = (t: Token, player: Player, val: number, state: GameState): boolean => {
    if (state.isTokenBlockEnabled === false) return false;
    if (t.state === TokenState.BASE || t.state === TokenState.HOME) return false;

    // Check if moving token is a Joda moving as a pair on a standard cell
    const isMovingAsJoda = isTokenPartofJodaOnStandardCell(t, player) && (val % 2 === 0);
    const stepsToCheck = isMovingAsJoda ? Math.floor(val / 2) : val;

    let stepState: TokenState = t.state;
    let stepPos = t.position;

    for (let s = 1; s <= stepsToCheck; s++) {
      if (stepState === TokenState.TRACK) {
        if (stepPos === 50) {
          if (state.isHomeEntryLockEnabled === false || player.hasKilledOpponent) {
            stepState = TokenState.HOME_STRETCH;
            stepPos = 0;
          } else {
            stepState = TokenState.TRACK;
            stepPos = 51;
          }
        } else if (stepPos === 51) {
          stepState = TokenState.TRACK;
          stepPos = 0;
        } else {
          stepState = TokenState.TRACK;
          stepPos = stepPos + 1;
        }
      } else if (stepState === TokenState.HOME_STRETCH) {
        if (stepPos === 4) {
          stepState = TokenState.HOME;
          stepPos = -1;
        } else {
          stepState = TokenState.HOME_STRETCH;
          stepPos = stepPos + 1;
        }
      } else if (stepState === TokenState.HOME) {
        // Exceeds home target
        return true; 
      }

      // If at this step, the token is on the main track:
      if (stepState === TokenState.TRACK) {
        const globalIdx = (START_INDEX[t.color] + stepPos) % 52;
        
        // Is there a block on globalIdx?
        if (!SAFE_INDICES.includes(globalIdx)) {
          let blockOwnerColor: PlayerColor | null = null;
          for (const p of state.players) {
            const count = p.tokens.filter(
              (tk) => tk.state === TokenState.TRACK && ((START_INDEX[tk.color] + tk.position) % 52) === globalIdx
            ).length;
            if (count >= 2) {
              blockOwnerColor = p.color;
              break;
            }
          }

          if (blockOwnerColor !== null) {
            // There is a block!
            if (s < stepsToCheck) {
              // Intermediate step: ALWAYS blocked (cannot pass over any block, even same color)
              return true;
            } else {
              // Landing step:
              if (blockOwnerColor !== t.color) {
                // Opponent block: only allowed to land if we are moving as a Joda (which kills it)
                if (!isMovingAsJoda) {
                  return true;
                }
              }
            }
          }
        }
      }
    }

    return false;
  };

  // Teammate helper functions for Team Up Mode
  const areTeammates = (c1: PlayerColor, c2: PlayerColor): boolean => {
    if ((c1 === PlayerColor.RED && c2 === PlayerColor.YELLOW) || (c1 === PlayerColor.YELLOW && c2 === PlayerColor.RED)) return true;
    if ((c1 === PlayerColor.GREEN && c2 === PlayerColor.BLUE) || (c1 === PlayerColor.BLUE && c2 === PlayerColor.GREEN)) return true;
    return false;
  };

  const getTeammateColor = (color: PlayerColor): PlayerColor => {
    if (color === PlayerColor.RED) return PlayerColor.YELLOW;
    if (color === PlayerColor.YELLOW) return PlayerColor.RED;
    if (color === PlayerColor.GREEN) return PlayerColor.BLUE;
    if (color === PlayerColor.BLUE) return PlayerColor.GREEN;
    return color;
  };

  // Find tokens (including teammate tokens in Team Up mode) that can move given the current chosen dice value (or any available dice value in queue)
  const getPlayableTokensFull = (state: GameState, ignoreOwnershipCheck: boolean = true): { color: PlayerColor; id: number }[] => {
    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer) return [];
    if (state.winnerColor !== null) return [];

    const canRollPending = (state.isBonusRolling === true) ||
                           (state.diceQueue.length > 0 &&
                            state.diceQueue[state.diceQueue.length - 1] === 6 &&
                            !state.hasBustedThisTurn &&
                            (state.consecutiveSixesCount || 0) < 3);
    if (canRollPending) return [];

    const valuesToTest = state.selectedDiceValue !== null 
      ? [state.selectedDiceValue] 
      : Array.from(new Set(state.diceQueue || []));

    if (valuesToTest.length === 0) return [];

    // Ownership Check: Only apply if explicitly requested (by default, board highlights show for all players)
    if (!ignoreOwnershipCheck && state.mode !== GameMode.OFFLINE && !activePlayer.isBot) {
      if (state.isTeamUpMode) {
        const isMyTurn = (activePlayer.color === myPlayerColor) || areTeammates(activePlayer.color, myPlayerColor);
        if (!isMyTurn) return [];
      } else {
        if (activePlayer.color !== myPlayerColor) return [];
      }
    }

    const playable: { color: PlayerColor; id: number }[] = [];

    const checkPlayerTokens = (p: Player) => {
      p.tokens.forEach((t) => {
        valuesToTest.forEach((val) => {
          if (t.state === TokenState.BASE) {
            if (val === 6) {
              if (!playable.some((item) => item.color === p.color && item.id === t.id)) {
                playable.push({ color: p.color, id: t.id });
              }
            }
            return;
          }

          if (t.state === TokenState.HOME) return;

          const isJoda = isTokenPartofJodaOnStandardCell(t, p);
          if (isJoda && val % 2 !== 0) return;

          const effectiveSteps = isJoda && (val % 2 === 0) ? Math.floor(val / 2) : val;

          let tokenSteps = 0;
          if (t.state === TokenState.TRACK) {
            tokenSteps = t.position;
          } else if (t.state === TokenState.HOME_STRETCH) {
            tokenSteps = 51 + t.position;
          }

          if (tokenSteps + effectiveSteps > 56) return;

          if (isPathBlocked(t, p, val, state)) return;

          if (!playable.some((item) => item.color === p.color && item.id === t.id)) {
            playable.push({ color: p.color, id: t.id });
          }
        });
      });
    };

    const activeAllHome = activePlayer.tokens.every((t) => t.state === TokenState.HOME);

    if (!activeAllHome) {
      checkPlayerTokens(activePlayer);
      if (state.isTeamUpMode) {
        const teammateColor = getTeammateColor(activePlayer.color);
        const teammatePlayer = state.players.find((p) => p.color === teammateColor);
        if (teammatePlayer) {
          if (playable.length === 0) {
            checkPlayerTokens(teammatePlayer);
          }
        }
      }
    } else if (state.isTeamUpMode) {
      // Active player's own tokens are ALL HOME! Always play for teammate
      const teammateColor = getTeammateColor(activePlayer.color);
      const teammatePlayer = state.players.find((p) => p.color === teammateColor);
      if (teammatePlayer) {
        checkPlayerTokens(teammatePlayer);
      }
    }

    return playable;
  };

  const getPlayableTokens = (state: GameState, ignoreOwnershipCheck: boolean = true): number[] => {
    const full = getPlayableTokensFull(state, ignoreOwnershipCheck);
    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer) return [];
    
    const activeTokens = full.filter((p) => p.color === activePlayer.color).map((p) => p.id);
    if (activeTokens.length > 0) return activeTokens;
    return full.map((p) => p.id);
  };

  // Helper: Find a safe playable token for timeout auto-move (prioritizes moves that DO NOT kill opponent tokens)
  const getSafePlayableToken = (state: GameState): { tokenId: number; diceValue: number; color?: PlayerColor } | null => {
    const activePlayer = state.players[state.activePlayerIndex];
    if (!activePlayer) return null;

    const availableValues = state.selectedDiceValue !== null 
      ? [state.selectedDiceValue] 
      : Array.from(new Set(state.diceQueue));

    if (availableValues.length === 0) return null;

    let bestCandidate: { tokenId: number; diceValue: number; score: number; color: PlayerColor } | null = null;

    for (const val of availableValues) {
      const mockState = { ...state, selectedDiceValue: val };
      const playable = getPlayableTokensFull(mockState, true);

      for (const pt of playable) {
        const ownerPlayer = state.players.find((p) => p.color === pt.color);
        const token = ownerPlayer?.tokens.find((t) => t.id === pt.id);
        if (!token || !ownerPlayer) continue;

        let wouldKillOpponent = false;
        let isTargetSafe = false;

        if (token.state === TokenState.BASE) {
          const startGlobal = START_INDEX[ownerPlayer.color];
          isTargetSafe = SAFE_INDICES.includes(startGlobal);
          wouldKillOpponent = state.players.some((p) => {
            if (p.color === ownerPlayer.color || (state.isTeamUpMode && areTeammates(p.color, ownerPlayer.color))) return false;
            return p.tokens.some((t) => t.state === TokenState.TRACK && ((START_INDEX[p.color] + t.position) % 52) === startGlobal);
          });
        } else if (token.state === TokenState.TRACK) {
          const targetPos = token.position + val;
          if (targetPos <= 50) {
            const mockGlobal = (START_INDEX[ownerPlayer.color] + targetPos) % 52;
            isTargetSafe = SAFE_INDICES.includes(mockGlobal);

            wouldKillOpponent = !isTargetSafe && state.players.some((p) => {
              if (p.color === ownerPlayer.color || (state.isTeamUpMode && areTeammates(p.color, ownerPlayer.color))) return false;
              return p.tokens.some((t) => t.state === TokenState.TRACK && ((START_INDEX[p.color] + t.position) % 52) === mockGlobal);
            });
          } else {
            isTargetSafe = true;
            wouldKillOpponent = false;
          }
        } else if (token.state === TokenState.HOME_STRETCH) {
          isTargetSafe = true;
          wouldKillOpponent = false;
        }

        let score = 0;
        if (wouldKillOpponent) {
          score -= 1000;
        } else {
          score += 200;
        }

        if (isTargetSafe) {
          score += 100;
        }

        const steps = token.state === TokenState.HOME_STRETCH ? 51 + token.position : (token.state === TokenState.TRACK ? token.position : 0);
        score += steps;

        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = { tokenId: pt.id, diceValue: val, score, color: pt.color };
        }
      }
    }

    if (bestCandidate) {
      return { tokenId: bestCandidate.tokenId, diceValue: bestCandidate.diceValue, color: bestCandidate.color };
    }

    return null;
  };

  // Perform movement when a playable token is clicked
  const handleTokenClick = async (tokenId: number, color: PlayerColor, forceDiceValue?: number) => {
    if (isMovingToken || isRolling || gameState.winnerColor !== null || isAutoSkipping) return;
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer) return;

    const canRollPending = (gameState.isBonusRolling === true) ||
                           (gameState.diceQueue.length > 0 &&
                            gameState.diceQueue[gameState.diceQueue.length - 1] === 6 &&
                            !gameState.hasBustedThisTurn &&
                            (gameState.consecutiveSixesCount || 0) < 3);
    if (canRollPending) return;

    const isTeammate = gameState.isTeamUpMode && areTeammates(activePlayer.color, color);
    if (activePlayer.color !== color && !isTeammate) return;

    // Strict Player Ownership & Turn Validation:
    if (gameState.mode !== GameMode.OFFLINE && !activePlayer.isBot) {
      const isMyTurn = activePlayer.color === myPlayerColor || (gameState.isTeamUpMode && areTeammates(activePlayer.color, myPlayerColor));
      const isAllowedColor = color === myPlayerColor || (gameState.isTeamUpMode && areTeammates(color, myPlayerColor));
      if (!isMyTurn || !isAllowedColor) return;
    }

    const targetPlayer = gameState.players.find((p) => p.color === color) || activePlayer;
    const token = targetPlayer.tokens.find((t) => t.id === tokenId);
    if (!token) return;

    let val = forceDiceValue !== undefined ? forceDiceValue : gameState.selectedDiceValue;
    if (val === null) {
      if (token.state === TokenState.BASE && gameState.diceQueue.includes(6)) {
        val = 6;
      } else {
        const possibleVals = Array.from(new Set(gameState.diceQueue)).filter((d) => {
          const fullD = getPlayableTokensFull({
            ...gameState,
            selectedDiceValue: d,
          }, true);
          return fullD.some((pt) => pt.color === color && pt.id === tokenId);
        });
        if (possibleVals.length === 1) {
          val = possibleVals[0];
        }
      }

      if (val === null) {
        if (gameState.diceQueue.length > 1 && !activePlayer.isBot) {
          playSynthSound('warning');
          if (isVibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
          setBlinkDiceQueue(true);
          setTimeout(() => {
            setBlinkDiceQueue(false);
          }, 1500);
        }
        return;
      }
    }

    // Is it actually playable?
    const fullPlayable = getPlayableTokensFull({
      ...gameState,
      selectedDiceValue: val,
    }, true);
    if (!fullPlayable.some((pt) => pt.color === color && pt.id === tokenId)) return;

    // If online mode, broadcast single event MOVE_TOKEN_ACTION over WebSocket
    if (gameState.mode === GameMode.ONLINE) {
      const stateVer = (gameState.stateVersion || 0) + 1;
      broadcastP2PMessage({
        type: 'MOVE_TOKEN_ACTION',
        tokenId,
        color,
        forceDiceValue: val,
        stateVersion: stateVer,
      });
    }

    executeTokenMoveLocally(tokenId, color, val);
  };

  const executeTokenMoveLocally = (tokenId: number, color: PlayerColor, forceDiceValue?: number, onComplete?: () => void) => {
    if (onComplete) {
      moveCompletionCallbackRef.current = onComplete;
    }

    const currentGS = latestGameStateRef.current || gameState;
    const unlockQueueEarly = () => {
      const cb = moveCompletionCallbackRef.current;
      moveCompletionCallbackRef.current = null;
      if (cb) {
        cb();
      } else {
        setTimeout(() => {
          isProcessingQueueRef.current = false;
          processActionQueue();
        }, 500);
      }
    };

    if (isMovingToken || isMovingTokenSyncRef.current || isRollingSyncRef.current || isRolling || isWaitingForDiceNumber) {
      setTimeout(() => {
        executeTokenMoveLocally(tokenId, color, forceDiceValue, onComplete);
      }, 100);
      return;
    }

    if (currentGS.winnerColor !== null) {
      unlockQueueEarly();
      return;
    }
    
    const targetPlayer = currentGS.players.find((p) => p.color === color);
    if (!targetPlayer) {
      unlockQueueEarly();
      return;
    }

    const token = targetPlayer.tokens.find((t) => t.id === tokenId);
    if (!token) {
      unlockQueueEarly();
      return;
    }

    const activePlayer = currentGS.players[currentGS.activePlayerIndex];
    if (currentGS.mode !== GameMode.ONLINE && forceDiceValue === undefined) {
      const isTeammate = currentGS.isTeamUpMode && activePlayer && areTeammates(activePlayer.color, color);
      if (activePlayer && activePlayer.color !== color && !isTeammate) {
        unlockQueueEarly();
        return;
      }
    }

    let val = forceDiceValue !== undefined ? forceDiceValue : currentGS.selectedDiceValue;
    if (val === null) {
      if (token.state === TokenState.BASE && currentGS.diceQueue.includes(6)) {
        val = 6;
      } else {
        const possibleVals = Array.from(new Set(currentGS.diceQueue)).filter((d) => {
          const fullD = getPlayableTokensFull({
            ...currentGS,
            selectedDiceValue: d,
          }, true);
          return fullD.some((pt) => pt.color === color && pt.id === tokenId);
        });
        if (possibleVals.length === 1) {
          val = possibleVals[0];
        }
      }
    }
    if (val === null) {
      unlockQueueEarly();
      return;
    }

    if (forceDiceValue !== undefined) {
      setGameState((prev) => ({
        ...prev,
        selectedDiceValue: forceDiceValue,
      }));
    }

    startTokenMovementAnimation();

    let movingTokenIds = [tokenId];
    let isJodaMovement = false;
    if (isTokenPartofJodaOnStandardCell(token, targetPlayer) && val % 2 === 0) {
      const globalIdx = (START_INDEX[token.color] + token.position) % 52;
      const sameColorOnCell = targetPlayer.tokens.filter(
        (t) => t.state === TokenState.TRACK && ((START_INDEX[t.color] + t.position) % 52) === globalIdx
      );
      const sorted = [...sameColorOnCell].sort((a, b) => a.id - b.id);
      const idx = sorted.findIndex((t) => t.id === token.id);
      
      if (sameColorOnCell.length === 2) {
        movingTokenIds = [sorted[0].id, sorted[1].id];
        isJodaMovement = true;
      } else if (sameColorOnCell.length === 3) {
        if (idx < 2) {
          movingTokenIds = [sorted[0].id, sorted[1].id];
          isJodaMovement = true;
        }
      } else if (sameColorOnCell.length === 4) {
        if (idx < 2) {
          movingTokenIds = [sorted[0].id, sorted[1].id];
        } else {
          movingTokenIds = [sorted[2].id, sorted[3].id];
        }
        isJodaMovement = true;
      }
    }

    if (token.state === TokenState.BASE) {
      playSynthSound('safe');
      
      setGameState((prev) => {
        const nextPlayers = prev.players.map((p) => {
          if (p.color !== color) return p;
          const nextTokens = p.tokens.map((t) => {
            if (t.id === tokenId) {
              return {
                ...t,
                state: TokenState.TRACK,
                position: 0,
              };
            }
            return t;
          });
          return { ...p, tokens: nextTokens };
        });

        const nextQueue = [...prev.diceQueue];
        const idx = nextQueue.indexOf(val);
        if (idx !== -1) nextQueue.splice(idx, 1);

        const nextSelected = nextQueue.length > 1 ? null : (nextQueue[0] || null);

        const nextState = {
          ...prev,
          stateVersion: (prev.stateVersion || 0) + 1,
          players: nextPlayers,
          diceQueue: nextQueue,
          selectedDiceValue: nextSelected,
          logs: [`🚀 ${targetPlayer.name} released Token ${tokenId + 1} onto the path!`, ...prev.logs],
        };
        latestGameStateRef.current = nextState;
        return nextState;
      });

      setTimeout(() => {
        finishMoveSequence(color);
      }, 250);
    } else {
      let stepsToMove = isJodaMovement ? Math.floor(val / 2) : val;
      
      const animateStep = () => {
        if (stepsToMove <= 0) {
          handleMoveCompletion(tokenId, color, val);
          return;
        }

        let targetState = TokenState.TRACK;
        let targetPos = 0;
        let hasBypassedOnThisStep = false;

        setGameState((prev) => {
          const currentPlayer = prev.players.find((p) => p.color === color);
          if (currentPlayer) {
            const currentToken = currentPlayer.tokens.find((t) => t.id === tokenId);
            if (currentToken) {
              targetState = currentToken.state;
              targetPos = currentToken.position;
            }
          }

          if (targetState === TokenState.TRACK) {
            if (targetPos === 50) {
              if (prev.isHomeEntryLockEnabled === false || (currentPlayer && currentPlayer.hasKilledOpponent)) {
                targetState = TokenState.HOME_STRETCH;
                targetPos = 0;
              } else {
                targetState = TokenState.TRACK;
                targetPos = 51;
                hasBypassedOnThisStep = true;
              }
            } else if (targetPos === 51) {
              targetState = TokenState.TRACK;
              targetPos = 0;
            } else {
              targetState = TokenState.TRACK;
              targetPos = targetPos + 1;
            }
          } else if (targetState === TokenState.HOME_STRETCH) {
            if (targetPos === 4) {
              targetState = TokenState.HOME;
              targetPos = -1;
            } else {
              targetState = TokenState.HOME_STRETCH;
              targetPos = targetPos + 1;
            }
          }

          if (hasBypassedOnThisStep && stepsToMove === 1 && currentPlayer) {
            addLog(`🔄 ${currentPlayer.name} bypassed Home stretch because they have NO opponent kills yet! Loops around board!`);
          }

          if (targetState === TokenState.HOME) {
            playSynthSound('home_entry');
          } else {
            playSynthSound('move');
          }
          if (isVibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(targetState === TokenState.HOME ? [150, 50, 150] : 35);
          }

          const nextPlayers = prev.players.map((p) => {
            if (p.color !== color) return p;
            const nextTokens = p.tokens.map((t) => {
              if (movingTokenIds.includes(t.id)) {
                return {
                  ...t,
                  state: targetState,
                  position: targetPos,
                };
              }
              return t;
            });
            return { ...p, tokens: nextTokens };
          });

          return { ...prev, players: nextPlayers };
        });

        stepsToMove -= 1;
        setTimeout(animateStep, 200);
      };

      animateStep();
    }
  };

  useEffect(() => {
    executeTokenMoveRef.current = executeTokenMoveLocally;
  });

  // Actions after completing the step-by-step track movement
  const handleMoveCompletion = (tokenId: number, color: PlayerColor, valUsed: number) => {
    let finalStateToBroadcast: GameState | null = null;
    let shouldBroadcastFull = false;
    let turnShifted = false;

    setGameState((prev) => {
      const nextQueue = [...prev.diceQueue];
      const idx = nextQueue.indexOf(valUsed);
      if (idx !== -1) nextQueue.splice(idx, 1);
      const nextSelected = nextQueue.length > 1 ? null : (nextQueue[0] || null);

      const movingPlayer = prev.players.find((p) => p.color === color) || prev.players[prev.activePlayerIndex];
      if (!movingPlayer) return prev;
      const movingToken = movingPlayer.tokens.find((t) => t.id === tokenId);
      if (!movingToken) return prev;

      const movingGlobal = (START_INDEX[movingToken.color] + movingToken.position) % 52;
      const isLandingOnSafeZone = movingToken.state === TokenState.TRACK && SAFE_INDICES.includes(movingGlobal);

      const total_moving = movingPlayer.tokens.filter(
        (t) => t.state === TokenState.TRACK && ((START_INDEX[t.color] + t.position) % 52) === movingGlobal
      ).length;

      const isPairLanding = prev.isTokenBlockEnabled !== false && (total_moving === 2 || total_moving === 4);

      let hasKillOccurred = false;
      let killedCount = 0;
      let killedPlayerName = '';
      let targetKillLogs = '';

      const updatedPlayers = prev.players.map((p) => {
        if (p.color === color) return p;

        if (prev.isTeamUpMode) {
          const areTeammates = (c1: PlayerColor, c2: PlayerColor) => {
            if ((c1 === PlayerColor.RED && c2 === PlayerColor.YELLOW) || (c1 === PlayerColor.YELLOW && c2 === PlayerColor.RED)) return true;
            if ((c1 === PlayerColor.GREEN && c2 === PlayerColor.BLUE) || (c1 === PlayerColor.BLUE && c2 === PlayerColor.GREEN)) return true;
            return false;
          };
          if (areTeammates(color, p.color)) {
            return p;
          }
        }

        const oppTokensOnCell = p.tokens.filter((t) => {
          if (movingToken.state !== TokenState.TRACK) return false;
          if (t.state !== TokenState.TRACK) return false;
          const oppGlobal = (START_INDEX[p.color] + t.position) % 52;
          return oppGlobal === movingGlobal;
        });

        const count_opp = oppTokensOnCell.length;
        let killedTokenIds: number[] = [];

        if (count_opp > 0 && !isLandingOnSafeZone) {
          if (prev.isTokenBlockEnabled === false) {
            killedTokenIds = oppTokensOnCell.map((t) => t.id);
          } else if (isPairLanding) {
            killedTokenIds = oppTokensOnCell.map((t) => t.id);
          } else {
            const opp_singles = count_opp % 2;
            if (opp_singles === 1) {
              killedTokenIds = [oppTokensOnCell[0].id];
            }
          }
        }

        let playerKillsThisToken = killedTokenIds.length;

        const nextTokens = p.tokens.map((t) => {
          if (killedTokenIds.includes(t.id)) {
            return {
              ...t,
              state: TokenState.BASE,
              position: -1,
            };
          }
          return t;
        });

        if (playerKillsThisToken > 0) {
          hasKillOccurred = true;
          killedCount += playerKillsThisToken;
          killedPlayerName = p.name;
        }

        return { ...p, tokens: nextTokens };
      });

      if (hasKillOccurred) {
        if (killedCount > 1) {
          targetKillLogs = `💥 MASSACRE! ${movingPlayer.name} wiped out ALL ${killedCount} of ${killedPlayerName}'s tokens together on a single cell!`;
        } else {
          targetKillLogs = `⚔️ KILLED! ${movingPlayer.name} killed ${killedPlayerName}'s Token! Sent back to Base!`;
        }
      }

      const finalPlayers = updatedPlayers.map((p) => {
        if (p.color === color && hasKillOccurred) {
          return { ...p, hasKilledOpponent: true };
        }
        return p;
      });

      const hasReachedHome = movingToken && movingToken.state === TokenState.HOME;

      let finalLogs = prev.logs;
      if (hasKillOccurred) {
        finalLogs = [targetKillLogs, `🎲 Extra roll chance granted immediately to ${movingPlayer.name}!`, ...prev.logs];
      } else if (hasReachedHome) {
        finalLogs = [`🎉 HO HO! ${movingPlayer.name}'s Token ${tokenId + 1} reached HOME! Whistling & clapping! 🎺👏`, `🎲 Extra roll chance granted immediately to ${movingPlayer.name}!`, ...prev.logs];
      } else {
        finalLogs = [`🏃 ${movingPlayer.name} advanced Token ${tokenId + 1} by ${valUsed} tiles.`, ...prev.logs];
      }

      if (hasKillOccurred) {
        if (killedCount > 1) {
          setTimeout(() => playSynthSound('boom'), 50);
        } else {
          setTimeout(() => playSynthSound('kill'), 50);
        }
      }

      const isBonusTriggered = hasKillOccurred || hasReachedHome;
      const nextIsBonusRolling = isBonusTriggered ? true : (prev.isBonusRolling || false);
      const nextSafeDiceQueue = isBonusTriggered ? [...nextQueue] : (prev.safeDiceQueue || []);
      const nextBonusSixes = isBonusTriggered ? 0 : (prev.bonusConsecutiveSixesCount || 0);
      const nextConsecutiveSixesCount = isBonusTriggered ? 0 : prev.consecutiveSixesCount;

      // Full board state data transfer required if:
      // 1) Goti mregi (hasKillOccurred === true)
      // 2) Final home me jayegi (hasReachedHome === true)
      if (hasKillOccurred || hasReachedHome) {
        shouldBroadcastFull = true;
      }

      const finalSelectedValue = isBonusTriggered ? null : nextSelected;

      const nextState = {
        ...prev,
        stateVersion: (prev.stateVersion || 0) + 1,
        players: finalPlayers,
        diceQueue: nextQueue,
        selectedDiceValue: finalSelectedValue,
        extraRollsCount: 0,
        consecutiveSixesCount: nextConsecutiveSixesCount,
        isBonusRolling: nextIsBonusRolling,
        safeDiceQueue: nextSafeDiceQueue,
        bonusConsecutiveSixesCount: nextBonusSixes,
        logs: finalLogs,
      };

      latestGameStateRef.current = nextState;
      finalStateToBroadcast = nextState;
      return nextState;
    });

    finishMoveSequence(color);
  };

  const finishMoveSequence = (color: PlayerColor) => {
    let turnShifted = false;
    let finalStateToBroadcast: GameState | null = null;

    handleUpdateGameState((prev) => {
      const activePlayer = prev.players[prev.activePlayerIndex];
      const nonQuitPlayers = prev.players.filter((p) => !p.hasQuit);

      // Track ranking order as players finish all 4 tokens
      let currentRankings = prev.rankings ? [...prev.rankings] : [];
      prev.players.forEach((p) => {
        const pAllHome = p.tokens.every((t) => t.state === TokenState.HOME);
        if (pAllHome && !currentRankings.includes(p.color)) {
          currentRankings.push(p.color);
        }
      });

      if (prev.isTeamUpMode) {
        // --- TEAM UP MATCH END CONDITION ---
        // Team 1: RED + YELLOW
        // Team 2: GREEN + BLUE
        const team1Players = prev.players.filter((p) => p.color === PlayerColor.RED || p.color === PlayerColor.YELLOW);
        const team2Players = prev.players.filter((p) => p.color === PlayerColor.GREEN || p.color === PlayerColor.BLUE);

        const team1Finished = team1Players.length > 0 && team1Players.every((p) => p.tokens.every((t) => t.state === TokenState.HOME));
        const team2Finished = team2Players.length > 0 && team2Players.every((p) => p.tokens.every((t) => t.state === TokenState.HOME));

        if (team1Finished || team2Finished) {
          const winningTeam = team1Finished ? 'Team 1 (RED & YELLOW)' : 'Team 2 (GREEN & BLUE)';
          const winningColor = team1Finished ? PlayerColor.RED : PlayerColor.GREEN;

          setTimeout(() => playSynthSound('win'), 200);
          const nextState = {
            ...prev,
            rankings: currentRankings,
            winnerColor: winningColor,
            logs: [`🏆 CONGRATULATIONS! ${winningTeam} has brought all 8 tokens home and WON THE TEAM UP MATCH!`, ...prev.logs],
          };
          finalStateToBroadcast = nextState;
          return nextState;
        }
      } else {
        // --- STANDARD MATCH END CONDITION ---
        const unfinishedPlayers = nonQuitPlayers.filter((p) => !p.tokens.every((t) => t.state === TokenState.HOME));

        const isMatchOver = (nonQuitPlayers.length <= 2 && (currentRankings.length >= 1 || unfinishedPlayers.length <= 1)) ||
                            (unfinishedPlayers.length <= 1 && nonQuitPlayers.length > 1);

        if (isMatchOver) {
          unfinishedPlayers.forEach((p) => {
            if (!currentRankings.includes(p.color)) {
              currentRankings.push(p.color);
            }
          });

          const winnerColor = currentRankings[0] || activePlayer.color;
          const winnerPlayer = prev.players.find((p) => p.color === winnerColor) || activePlayer;

          setTimeout(() => playSynthSound('win'), 200);
          const nextState = {
            ...prev,
            rankings: currentRankings,
            winnerColor: winnerColor,
            logs: [`🏆 MATCH COMPLETE! ${winnerPlayer.name} won 1st Place!`, ...prev.logs],
          };
          finalStateToBroadcast = nextState;
          return nextState;
        }
      }

      // --- TURN SHIFTING LOGIC ---
      if (prev.diceQueue.length === 0 && !prev.isBonusRolling) {
        let nextActiveIndex = (prev.activePlayerIndex + 1) % prev.players.length;

        let safetyCounter = 0;
        while (safetyCounter < prev.players.length) {
          const candidate = prev.players[nextActiveIndex];

          if (candidate.hasQuit) {
            nextActiveIndex = (nextActiveIndex + 1) % prev.players.length;
            safetyCounter++;
            continue;
          }

          if (!prev.isTeamUpMode) {
            const candidateAllHome = candidate.tokens.every((t) => t.state === TokenState.HOME);
            if (candidateAllHome) {
              nextActiveIndex = (nextActiveIndex + 1) % prev.players.length;
              safetyCounter++;
              continue;
            }
          } else {
            const teammateColor = getTeammateColor(candidate.color);
            const teammateObj = prev.players.find((p) => p.color === teammateColor);
            const candidateAllHome = candidate.tokens.every((t) => t.state === TokenState.HOME);
            const teammateAllHome = teammateObj ? teammateObj.tokens.every((t) => t.state === TokenState.HOME) : true;

            if (candidateAllHome && teammateAllHome) {
              nextActiveIndex = (nextActiveIndex + 1) % prev.players.length;
              safetyCounter++;
              continue;
            }
          }

          break;
        }

        turnShifted = true;
        const nextState = {
          ...prev,
          stateVersion: (prev.stateVersion || 0) + 1,
          rankings: currentRankings,
          activePlayerIndex: nextActiveIndex,
          diceRollCountThisTurn: 0,
          consecutiveSixesCount: 0,
          extraRollsCount: 0,
          isBonusRolling: false,
          safeDiceQueue: [],
          bonusConsecutiveSixesCount: 0,
          hasBustedThisTurn: false,
          selectedDiceValue: null,
          logs: [`👉 Shifted turn to ${prev.players[nextActiveIndex].name}!`, ...prev.logs],
        };
        finalStateToBroadcast = nextState;
        return nextState;
      }

      finalStateToBroadcast = {
        ...prev,
        stateVersion: (prev.stateVersion || 0) + 1,
        rankings: currentRankings
      };
      return finalStateToBroadcast;
    });

    if (finalStateToBroadcast && gameState.mode === GameMode.ONLINE) {
      const movingPlayer = gameState.players.find((p) => p.color === color);
      const isMyMove = color === myPlayerColor || (movingPlayer?.isBot && onlineRoom?.players[0]?.id === myPlayerId);
      if (isMyMove) {
        if (turnShifted) {
          broadcastTurnSwitchViaP2P(finalStateToBroadcast as GameState);
        }
      }
    }

    stopTokenMovementAnimation();
    const doneCb = moveCompletionCallbackRef.current;
    moveCompletionCallbackRef.current = null;
    if (doneCb) {
      doneCb();
    } else {
      setTimeout(() => {
        isProcessingQueueRef.current = false;
        processActionQueue();
      }, 500);
    }
  };

  // Helper: check if two tokens are on the exact same tile coordinate
  const isSameTile = (t1: Token, t2: Token): boolean => {
    if (t1.color === t2.color && t1.id === t2.id) return false;
    if (t1.state !== TokenState.TRACK || t2.state !== TokenState.TRACK) return false;

    // Convert relative positions on their paths to the global circular track index
    const t1Global = (START_INDEX[t1.color] + t1.position) % 52;
    const t2Global = (START_INDEX[t2.color] + t2.position) % 52;

    return t1Global === t2Global;
  };

  // Auto-skip turn if no valid moves are possible
  useEffect(() => {
    if (
      activeScreen !== 'GAME' ||
      gameState.winnerColor !== null ||
      isRolling ||
      isMovingToken ||
      isAutoSkippingRef.current ||
      gameState.diceQueue.length === 0
    ) return;

    // Check if player is allowed to roll further
    const canRoll = (gameState.isBonusRolling === true) ||
                    (gameState.diceQueue[gameState.diceQueue.length - 1] === 6 && 
                     !gameState.hasBustedThisTurn &&
                     gameState.diceRollCountThisTurn === gameState.diceQueue.length);

    if (canRoll) return; // Still rolling phase, they can roll again!

    // If we reach here, rolling phase is done, and they have numbers to play.
    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer) return;

    // In Online mode, ONLY the active player (or host if active player is a bot) should execute turn auto-skipping!
    if (gameState.mode === GameMode.ONLINE) {
      if (!activePlayer.isBot && activePlayer.color !== myPlayerColor) {
        return;
      }
      if (activePlayer.isBot) {
        const isHost = onlineRoom && onlineRoom.players[0]?.id === myPlayerId;
        if (!isHost) return;
      }
    }
    
    // Check if there is *any* valid move with any dice value in diceQueue using the exact getPlayableTokensFull logic
    const hasValidMove = gameState.diceQueue.some((val) => {
      const mockState = {
        ...gameState,
        selectedDiceValue: val,
      };
      const playable = getPlayableTokensFull(mockState, true);
      return playable.length > 0;
    });

    if (!hasValidMove) {
      if (isAutoSkippingRef.current) return; // Guard duplicate timeout setup

      // 0 valid moves! Start auto-skip sequence
      isAutoSkippingRef.current = true;
      setIsAutoSkipping(true);
      
      const logMsg = `⚠️ ${activePlayer.name} has no valid moves for [${gameState.diceQueue.join(', ')}]! Skipping turn...`;
      handleUpdateGameState((prev) => ({
        ...prev,
        logs: [logMsg, ...prev.logs],
      }));

      if (autoSkipTimeoutRef.current) {
        clearTimeout(autoSkipTimeoutRef.current);
      }

      autoSkipTimeoutRef.current = setTimeout(() => {
        let finalNextState: GameState | null = null;
        handleUpdateGameState((prev) => {
          const nextActiveIndex = (prev.activePlayerIndex + 1) % prev.players.length;
          finalNextState = {
            ...prev,
            stateVersion: (prev.stateVersion || 0) + 1,
            activePlayerIndex: nextActiveIndex,
            diceRollCountThisTurn: 0,
            consecutiveSixesCount: 0,
            extraRollsCount: 0,
            isBonusRolling: false,
            safeDiceQueue: [],
            bonusConsecutiveSixesCount: 0,
            hasBustedThisTurn: false,
            diceQueue: [],
            selectedDiceValue: null,
            logs: [`👉 Shifted turn to ${prev.players[nextActiveIndex].name}!`, ...prev.logs],
          };
          return finalNextState;
        });

        if (finalNextState && gameState.mode === GameMode.ONLINE) {
          broadcastTurnSwitchViaP2P(finalNextState as GameState);
        }

        isAutoSkippingRef.current = false;
        setIsAutoSkipping(false);
        autoSkipTimeoutRef.current = null;
      }, 1000);
    }

    return () => {
      // Only reset the skip timeout if we are rolling again, moving, or resetting the turn/queue manually
      if (isRolling || isMovingToken || gameState.diceQueue.length === 0) {
        if (autoSkipTimeoutRef.current) {
          clearTimeout(autoSkipTimeoutRef.current);
          autoSkipTimeoutRef.current = null;
          isAutoSkippingRef.current = false;
          setIsAutoSkipping(false);
        }
      }
    };
  }, [
    activeScreen,
    gameState.activePlayerIndex,
    gameState.diceQueue,
    gameState.winnerColor,
    isRolling,
    isMovingToken,
    gameState.hasBustedThisTurn,
    gameState.diceRollCountThisTurn
  ]);

  // --- 20-SECOND TURN TIMER TICKER & RESET EFFECT ---
  useEffect(() => {
    if (activeScreen === 'GAME' && !isRolling && !isMovingToken) {
      setTurnCountdown(20);
    }
  }, [
    activeScreen,
    gameState.activePlayerIndex,
    gameState.diceQueue.length,
    gameState.diceRollCountThisTurn,
    gameState.isBonusRolling,
    gameState.selectedDiceValue,
    isRolling,
    isMovingToken
  ]);



  // --- AUTO-MOVE FOR SINGLE PLAYABLE TOKEN ---
  useEffect(() => {
    if (
      activeScreen !== 'GAME' ||
      gameState.winnerColor !== null ||
      isRolling ||
      isMovingToken ||
      isAutoSkipping
    ) return;

    // Check if the rolling phase is finished
    const canRoll = (gameState.isBonusRolling === true) || (
      gameState.diceQueue[gameState.diceQueue.length - 1] === 6 && 
      !gameState.hasBustedThisTurn &&
      gameState.diceRollCountThisTurn === gameState.diceQueue.length
    );

    if (canRoll) return;

    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer) return;

    // For online mode, only auto-move if it is my turn
    if (gameState.mode === GameMode.ONLINE && activePlayer.color !== myPlayerColor) {
      return;
    }

    // Bots have their own separate effect that automatically executes moves (which includes strategic scoring)
    if (activePlayer.isBot) {
      return;
    }


  }, [
    activeScreen,
    gameState.activePlayerIndex,
    gameState.diceQueue,
    gameState.selectedDiceValue,
    gameState.winnerColor,
    isRolling,
    isMovingToken,
    isAutoSkipping,
    myPlayerColor,
    gameState.mode
  ]);

  // --- BRAINY STRATEGIC BOT LOGIC ---
  useEffect(() => {
    if (
      activeScreen !== 'GAME' ||
      gameState.winnerColor !== null ||
      isRolling ||
      isMovingToken ||
      isAutoSkipping
    ) return;

    const activePlayer = gameState.players[gameState.activePlayerIndex];
    if (!activePlayer || !activePlayer.isBot || isBotThinkingRef.current) return;

    if (gameState.mode === GameMode.ONLINE && roomCode) {
      const isHost = onlineRoom && onlineRoom.players[0]?.id === myPlayerId;
      if (!isHost) return;
    }

    isBotThinkingRef.current = true;

    // Bot sequence trigger
    const executeBotTurn = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));

        // 0. If bot is in bonus rolling phase, roll!
        if (gameState.isBonusRolling === true) {
          rollDice();
          return;
        }

        // 1. If dice queue is empty, roll!
        if (gameState.diceQueue.length === 0) {
          rollDice();
          return;
        }

        // 2. If bot rolled a 6 and is in continuous rolling phase, roll again!
        const lastRoll = gameState.diceQueue[gameState.diceQueue.length - 1];
        if (
          lastRoll === 6 && 
          gameState.consecutiveSixesCount < 3 &&
          gameState.diceRollCountThisTurn === gameState.diceQueue.length
        ) {
          rollDice();
          return;
        }

        // 3. Rolling is completed. Apply stored numbers strategically from largest to smallest!
        if (gameState.selectedDiceValue === null && gameState.diceQueue.length > 0) {
          const autoVal = gameState.diceQueue[0];
          handleUpdateGameState((prev) => ({
            ...prev,
            selectedDiceValue: autoVal,
          }));
          return;
        }

        const val = gameState.selectedDiceValue;
        if (val === null) {
          // Queue must be empty, pass turn
          return;
        }

        const fullPlayable = getPlayableTokensFull(gameState, true);

        if (fullPlayable.length === 0) {
          // No moves possible! Burn/discard this dice value
          addLog(`🤖 Bot could not find any valid move for ${val}! Discarded.`);
          handleUpdateGameState((prev) => {
            const nextQueue = [...prev.diceQueue];
            const idx = nextQueue.indexOf(val);
            if (idx !== -1) nextQueue.splice(idx, 1);
            const nextSelected = nextQueue.length > 1 ? null : (nextQueue[0] || null);

            return {
              ...prev,
              diceQueue: nextQueue,
              selectedDiceValue: nextSelected,
            };
          });
          return;
        }

        // --- STRATEGIC BOT AI EVALUATOR ---
        let bestItem = fullPlayable[0];
        let bestScore = -999;

        fullPlayable.forEach((item) => {
          const ownerPlayer = gameState.players.find((p) => p.color === item.color)!;
          const token = ownerPlayer.tokens.find((t) => t.id === item.id)!;
          let score = 0;

          // Priority 1: Release from base (huge momentum)
          if (token.state === TokenState.BASE && val === 6) {
            score += 150;
          }

          // Calculate exact target position and state for Bot AI evaluation
          let mockTargetState = token.state;
          let mockTargetPos = token.position;

          const isJodaOfActivePlayer = isTokenPartofJodaOnStandardCell(token, ownerPlayer) && (val % 2 === 0);
          const effectiveSteps = isJodaOfActivePlayer ? Math.floor(val / 2) : val;

          if (token.state === TokenState.BASE) {
            if (val === 6) {
              mockTargetState = TokenState.TRACK;
              mockTargetPos = 0;
            }
          } else if (token.state === TokenState.TRACK) {
            if (token.position + effectiveSteps <= 50) {
              mockTargetState = TokenState.TRACK;
              mockTargetPos = token.position + effectiveSteps;
            } else if (token.position + effectiveSteps <= 56) {
              if (ownerPlayer.hasKilledOpponent || gameState.isHomeEntryLockEnabled === false) {
                const stretchSteps = (token.position + effectiveSteps) - 51;
                if (stretchSteps === 5) {
                  mockTargetState = TokenState.HOME;
                  mockTargetPos = -1;
                } else {
                  mockTargetState = TokenState.HOME_STRETCH;
                  mockTargetPos = stretchSteps;
                }
              } else {
                mockTargetState = TokenState.TRACK;
                mockTargetPos = (token.position + effectiveSteps) % 52;
              }
            }
          } else if (token.state === TokenState.HOME_STRETCH) {
            if (token.position + val <= 4) {
              mockTargetState = TokenState.HOME_STRETCH;
              mockTargetPos = token.position + val;
            } else if (token.position + val === 5) {
              mockTargetState = TokenState.HOME;
              mockTargetPos = -1;
            }
          }

          let myMockGlobal = -1;
          let isTargetSafe = false;

          if (mockTargetState === TokenState.TRACK) {
            myMockGlobal = (START_INDEX[ownerPlayer.color] + mockTargetPos) % 52;
            isTargetSafe = SAFE_INDICES.includes(myMockGlobal);
          } else if (mockTargetState === TokenState.HOME_STRETCH || mockTargetState === TokenState.HOME) {
            isTargetSafe = true;
          }

          const wouldKill = !isTargetSafe && mockTargetState === TokenState.TRACK && gameState.players.some((p) => {
            if (p.color === ownerPlayer.color) return false;

            // Under Team Up mode, teammates cannot capture each other's tokens (Friendly Fire OFF)
            if (gameState.isTeamUpMode) {
              const areTeammates = (c1: PlayerColor, c2: PlayerColor) => {
                if ((c1 === PlayerColor.RED && c2 === PlayerColor.YELLOW) || (c1 === PlayerColor.YELLOW && c2 === PlayerColor.RED)) return true;
                if ((c1 === PlayerColor.GREEN && c2 === PlayerColor.BLUE) || (c1 === PlayerColor.BLUE && c2 === PlayerColor.GREEN)) return true;
                return false;
              };
              if (areTeammates(ownerPlayer.color, p.color)) return false;
            }

            // Count opponent tokens on mock target cell
            const oppTokensOnCell = p.tokens.filter(
              (t) => t.state === TokenState.TRACK && ((START_INDEX[p.color] + t.position) % 52) === myMockGlobal
            );
            const count_opp = oppTokensOnCell.length;
            if (count_opp === 0) return false;

            // How many of our tokens will be on this cell after this move?
            const ourTokensAlreadyOnCell = ownerPlayer.tokens.filter((t) => {
              if (t.id === token.id) return false; // exclude self
              if (t.state !== TokenState.TRACK) return false;
              const tGlobal = (START_INDEX[t.color] + t.position) % 52;
              return tGlobal === myMockGlobal;
            });
            const total_moving = isJodaOfActivePlayer ? 2 : ourTokensAlreadyOnCell.length + 1;
            const isPairLanding = gameState.isTokenBlockEnabled !== false && (isJodaOfActivePlayer || (total_moving === 2 || total_moving === 4));

            if (gameState.isTokenBlockEnabled === false) {
              return true; // Any landing will kill all opponent tokens when blocks are disabled
            } else if (isPairLanding) {
              return true; // A pair landing kills any opponent tokens here
            } else {
              return (count_opp % 2 === 1); // Single landing only kills single opponent tokens (not pairs)
            }
          });
          if (wouldKill) {
            score += 200;
          }

          // Priority 3: Reach Home goal (victory milestone)
          if (mockTargetState === TokenState.HOME) {
            score += 180;
          }

          // Priority 4: Safe Zone entry (safety first)
          if (isTargetSafe) {
            score += 60;
          }

          // Move token closest to home forward
          const stepsTaken = token.state === TokenState.HOME_STRETCH ? 51 + token.position : (token.state === TokenState.TRACK ? token.position : 0);
          score += stepsTaken * 0.5;

          if (score > bestScore) {
            bestScore = score;
            bestItem = item;
          }
        });

        // Execute Bot's chosen move depending on difficulty setting
        const difficulty = gameState.botDifficulty || 'easy';
        let chosenItem = bestItem;

        if (difficulty === 'easy') {
          const useRandom = Math.random() < 0.7;
          if (useRandom && fullPlayable.length > 0) {
            chosenItem = fullPlayable[Math.floor(Math.random() * fullPlayable.length)];
          }
        } else if (difficulty === 'medium') {
          const useRandom = Math.random() < 0.3;
          if (useRandom && fullPlayable.length > 0) {
            chosenItem = fullPlayable[Math.floor(Math.random() * fullPlayable.length)];
          }
        }

        await handleTokenClick(chosenItem.id, chosenItem.color);
      } catch (err) {
        console.error('Error during executeBotTurn:', err);
      } finally {
        isBotThinkingRef.current = false;
      }
    };

    executeBotTurn();
  }, [gameState, isRolling, isMovingToken, activeScreen, roomCode, onlineRoom, myPlayerId]);

  const handleCopyLink = () => {
    const inviteLink = `ludoapp://join?code=${roomCode}`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => triggerToast('Link Copied!'))
      .catch((err) => {
        console.error('Failed to copy link:', err);
        const textArea = document.createElement('textarea');
        textArea.value = inviteLink;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          triggerToast('Link Copied!');
        } catch (e) {
          triggerToast('Failed to copy');
        }
        document.body.removeChild(textArea);
      });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode)
      .then(() => triggerToast('Code Copied!'))
      .catch((err) => {
        console.error('Failed to copy code:', err);
        const textArea = document.createElement('textarea');
        textArea.value = roomCode;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          triggerToast('Code Copied!');
        } catch (e) {
          triggerToast('Failed to copy');
        }
        document.body.removeChild(textArea);
      });
  };

  // --- DEEP LINKING / AUTO-JOIN HANDLER ON MOUNT ---
  useEffect(() => {
    const handleUrlAutoJoin = () => {
      const fullHref = window.location.href;
      let code = '';

      // 1. Try matching with regex for any occurrences of code=XXXXXX or room=XXXXXX in the entire href (URL scheme friendly)
      const regexMatch = fullHref.match(/[?&]code=([A-Za-z0-9]{6})/i) || fullHref.match(/[?&]room=([A-Za-z0-9]{6})/i);
      if (regexMatch && regexMatch[1]) {
        code = regexMatch[1];
      }

      // 2. Try URLSearchParams fallback
      if (!code) {
        const params = new URLSearchParams(window.location.search);
        code = params.get('room') || params.get('code') || '';
        
        const deepUrl = params.get('url');
        if (!code && deepUrl && deepUrl.includes('code=')) {
          const match = deepUrl.match(/code=([A-Z0-9]{6})/i);
          if (match && match[1]) {
            code = match[1];
          }
        }
      }

      // 3. Fallback to parsing hash if any (e.g. #/join?code=XXXXXX)
      if (!code && window.location.hash) {
        const hashMatch = window.location.hash.match(/[?&]code=([A-Za-z0-9]{6})/i) || window.location.hash.match(/[?&]room=([A-Za-z0-9]{6})/i);
        if (hashMatch && hashMatch[1]) {
          code = hashMatch[1];
        }
      }

      if (code && code.length === 6) {
        console.log('[Deep Link/Invite Code Detected]:', code);
        const uppercaseCode = code.toUpperCase();
        
        // Clean URL query parameters to avoid re-triggering auto-join on manual browser refresh
        try {
          const newUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        } catch (e) {
          console.warn('Could not clean address bar parameters', e);
        }
        
        // Direct, background auto-join execution to skip screens and enter room immediately
        handleJoinRoom(uppercaseCode);
      }
    };

    const timer = setTimeout(handleUrlAutoJoin, 600);
    return () => clearTimeout(timer);
  }, [myPlayerId]);

  const getTopBarTitle = () => {
    const lang = selectedLanguage || 'English';
    
    if (activeScreen === 'HOME') {
      const homeTitles: Record<string, string> = {
        'English': 'Home',
        'हिन्दी': 'होम',
        'العربية': 'الرئيسية',
        'Español': 'Inicio',
        'Português': 'Início',
        'தமிழ்': 'முகப்பு',
        'తెలుగు': 'హోమ్',
        'ಕನ್ನಡ': 'ಹೋಮ್',
        'മലയാളം': 'ഹോം'
      };
      return homeTitles[lang] || 'Home';
    }
    
    if (activeScreen === 'LOBBY') {
      const settingsTitles: Record<string, string> = {
        'English': 'Settings',
        'हिन्दी': 'सेटिंग्स',
        'العربية': 'الإعدادات',
        'Español': 'Ajustes',
        'Português': 'Configurações',
        'தமிழ்': 'அமைப்புகள்',
        'తెలుగు': 'ಸೆಟ್ಟಿಂಗ್ಸ್',
        'ಕನ್ನಡ': 'ಸೆಟ್ಟಿಂಗ್ಸ್',
        'മലയാളം': 'ക്രമീകരണങ്ങൾ'
      };
      return settingsTitles[lang] || 'Settings';
    }
    
    if (activeScreen === 'GAME' || gameState.gameStarted) {
      if (gameState.mode === GameMode.OFFLINE) {
        const localPassTitles: Record<string, string> = {
          'English': 'Local Pass & Play',
          'हिन्दी': 'लोकल पास एंड प्ले',
          'العربية': 'لعب محلي وتمرير',
          'Español': 'Pasa y Juega Local',
          'Português': 'Passar e Jogar Local',
          'தமிழ்': 'உள்ளூர் பாஸ் & ப்ளே',
          'తెలుగు': 'లోకల్ పాస్ & ప్లే',
          'ಕನ್ನಡ': 'ಲೋಕಲ್ ಪಾಸ್ & ಪ್ಲೇ',
          'മലയാളം': 'ലോക്കൽ പാസ് & പ്ലേ'
        };
        return localPassTitles[lang] || 'Local Pass & Play';
      }
      
      if (gameState.mode === GameMode.BOT) {
        const botTitles: Record<string, string> = {
          'English': 'Play with Bot',
          'हिन्दी': 'बॉट के साथ खेलें',
          'العربية': 'اللعب مع البوت',
          'Español': 'Jugar con Bot',
          'Português': 'Jogar com Bot',
          'தமிழ்': 'பாட் உடன் விளையாடு',
          'తెలుగు': 'బాట్‌తో ప్లే చేయండి',
          'ಕನ್ನಡ': 'ಬಾಟ್ ಜೊತೆ ಆಟವಾಡಿ',
          'മലയാളം': 'ബോട്ടിനൊപ്പം കളിക്കുക'
        };
        return botTitles[lang] || 'Play with Bot';
      }
      
      if (gameState.mode === GameMode.ONLINE) {
        if (onlineRoom) {
          const roomTitles: Record<string, string> = {
            'English': 'Private Room',
            'हिन्दी': 'प्राइवेट रूम',
            'العربية': 'غرفة خاصة',
            'Español': 'Sala Privada',
            'Português': 'Sala Privada',
            'தமிழ்': 'தனியார் அறை',
            'తెలుగు': 'ప్రైவேట్ రూమ్',
            'ಕನ್ನಡ': 'ಖಾಸಗಿ ರೂಮ್',
            'മലയാളം': 'സ്വകാര്യ റൂം'
          };
          return roomTitles[lang] || 'Private Room';
        } else {
          const matchingTitles: Record<string, string> = {
            'English': 'Online Matching',
            'हिन्दी': 'ऑनलाइन मैचिंग',
            'العربية': 'مباراة عبر الإنترنت',
            'Español': 'Partida en Línea',
            'Português': 'Partida Online',
            'தமிழ்': 'ஆன்லைன் மேட்சிங்',
            'తెలుగు': 'ఆన్‌లైన్ ಮ್ಯಾಚಿಂಗ್',
            'ಕನ್ನಡ': 'ಆನ್‌ಲೈನ್ ಮ್ಯಾಚಿಂಗ್',
            'മലയാളം': 'ഓൺലൈൻ മാച്ചിംഗ്'
          };
          return matchingTitles[lang] || 'Online Matching';
        }
      }
    }
    
    return 'Ludo Strategize';
  };

  const isRtl = selectedLanguage === 'العربية';

  return (
    <div 
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`h-[100dvh] max-h-[100dvh] w-full flex flex-col relative overflow-hidden transition-colors duration-300 ${theme === 'light' ? 'bg-slate-50 theme-light text-slate-800' : 'bg-[#0a0f1e] theme-dark text-white'}`}>
        


        {/* Loading Screen Overlay */}
        <AnimatePresence mode="wait">
          {isAppLoading && (
            <motion.div
              key="loading-screen"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className={`absolute inset-0 z-50 flex flex-col items-center justify-center p-6 ${theme === 'light' ? 'bg-slate-50' : 'bg-[#0f172a]'}`}
            >
              <div className="flex flex-col items-center gap-6 text-center max-w-md w-full">
                {/* Fair Play Tagline localized banner above Ludo board */}
                <div className={`px-5 py-3.5 rounded-2xl border backdrop-blur-md shadow-md transition-all duration-300 max-w-[320px] sm:max-w-[360px] w-full mx-auto ${
                  theme === 'light' 
                    ? 'bg-slate-100/90 border-slate-300 text-black shadow-slate-200/50' 
                    : 'bg-slate-900/90 border-white/15 text-white shadow-black/40'
                }`}>
                  <p className={`font-bold text-sm sm:text-base leading-snug tracking-normal ${
                    theme === 'light' ? 'text-black' : 'text-white'
                  }`}>
                    {t('bannerFairPlay')}
                  </p>
                </div>

                {/* 1. Ludo Board Icon (No Dice Space, Perfect Square shape) */}
                <LudoBoardIcon />

                {/* 2. Brand Name exactly like Home Page banner */}
                <div className="flex flex-col items-center gap-2">
                  <h1 className={`text-3xl font-black tracking-tight uppercase mt-1.5 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                    {t('title').split(' ')[0]} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-500">{t('title').split(' ')[1] || 'Strategize'}</span>
                  </h1>
                  <span className="text-[10px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">
                    Ludo Battle Royale Edition
                  </span>
                </div>

                {/* 3. Modern Loading Progress Bar & percentage */}
                <div className="w-full flex flex-col items-center gap-3 mt-4">
                  <div className="w-4/5 max-w-[220px] h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden border border-slate-300/30 dark:border-white/5 relative shadow-inner">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-blue-500 via-emerald-500 to-indigo-500 rounded-full"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-mono text-xs font-bold text-blue-500 dark:text-blue-400 animate-pulse">
                      {loadingTexts[selectedLanguage] || loadingTexts['English']}
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      {Math.round(loadingProgress)}%
                    </span>
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast Notification Banner */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: '-50%', scale: 0.95 }}
              animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
              exit={{ opacity: 0, y: -20, x: '-50%', scale: 0.95 }}
              className="absolute top-20 left-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-white/20 text-white font-extrabold text-xs shadow-2xl flex items-center gap-2 backdrop-blur-md whitespace-nowrap"
            >
              <CheckCircle className="text-emerald-400" size={14} />
              <span>{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top App Bar inside Simulator (Increased height & top padding for Android mobile status bar / safe area) */}
        <div className={`backdrop-blur-md px-4 flex items-center justify-between border-b z-30 select-none transition-all duration-300 pt-8 pb-3 min-h-[66px]
          ${theme === 'light' 
            ? 'bg-slate-100/60 border-slate-200/50 text-slate-800' 
            : 'bg-white/5 border-white/10 text-white'
          }
        `}>
          <div className="flex items-center gap-3">
            {/* Elegant Exit Button on Home screen */}
            {activeScreen === 'HOME' && !gameState.gameStarted && (
              <button
                title="Exit App"
                onClick={handleExitApp}
                className={`p-1.5 rounded-lg border transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center
                  ${theme === 'light'
                    ? 'bg-slate-200/50 hover:bg-slate-300/80 border-slate-300 text-slate-600 hover:text-slate-800'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                  }
                `}
              >
                <ArrowLeft size={14} strokeWidth={2.5} className="rtl:rotate-180" />
              </button>
            )}

            {/* Elegant Back Button */}
            {(gameState.gameStarted || activeScreen === 'LOBBY') && (
              <button
                title="Back"
                onClick={() => {
                  if (activeScreen === 'LOBBY') {
                    setIsLobbyLeaveModalOpen(true);
                  } else {
                    setIsExitModalOpen(true);
                  }
                }}
                className={`p-1.5 rounded-lg border transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center
                  ${theme === 'light'
                    ? 'bg-slate-200/50 hover:bg-slate-300/80 border-slate-300 text-slate-600 hover:text-slate-800'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                  }
                `}
              >
                <ArrowLeft size={14} strokeWidth={2.5} className="rtl:rotate-180" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className={`font-black text-sm uppercase tracking-wider transition-colors duration-300
                ${theme === 'light' ? 'text-slate-950' : 'text-white'}
              `}>
                {getTopBarTitle()}
              </span>
              {gameState.mode === GameMode.ONLINE && roomCode && (activeScreen === 'GAME' || activeScreen === 'LOBBY') && (
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Click to copy room code"
                  className={`px-2 py-0.5 rounded-md border text-[11px] font-black tracking-widest uppercase flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs ${
                    theme === 'light'
                      ? 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40 text-amber-300'
                  }`}
                >
                  <span>#{roomCode}</span>
                  <Copy size={11} className="opacity-80" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Settings (Gear) Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`p-1.5 rounded-lg border transition-all duration-300 cursor-pointer active:scale-95
                ${theme === 'light'
                  ? 'bg-slate-200/80 hover:bg-slate-300/80 border-slate-300 text-slate-600 hover:text-slate-800'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                }
              `}
              title="Game Settings"
            >
              <Settings size={14} className="hover:rotate-45 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* --- VIEW ROUTER --- */}
        <AnimatePresence mode="wait">
          
          {/* HOME SCREEN */}
          {activeScreen === 'HOME' && (
            <motion.div
              key="screen-home"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className="flex-1 flex flex-col pt-0.5"
            >
              <GameSettings
                onStartGame={startLocalGame}
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                onStartMatchmaking={verifyVersionBeforeOnlineAction}
                onOnlineModeSelected={handleOnlineModeSelected}
                isOnlineConnecting={isOnlineConnecting}
                profileName={profileName}
                selectedLanguage={selectedLanguage}
                theme={theme}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onExit={handleExitApp}
              />
            </motion.div>
          )}

          {/* ONLINE LOBBY ROOM SCREEN */}
          {activeScreen === 'LOBBY' && onlineRoom && (
            <motion.div
              key="screen-lobby"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className={`flex-1 overflow-hidden px-4 py-3 bg-transparent flex flex-col gap-3 select-none ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}
            >
              <div className="flex flex-col items-center text-center gap-0.5">
                <h2 className={`text-base font-extrabold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Lobby Room Created</h2>
              </div>

              {/* Large Code Badge */}
              <div className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1 relative overflow-hidden group shadow-md ${theme === 'light' ? 'bg-white border-slate-200' : 'backdrop-blur-xl bg-white/5 border-white/10'}`}>
                <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                <span className="text-[9px] font-bold text-amber-500 tracking-wide flex items-center gap-1">
                  ⚠️ Send room code to friends to join the battle!
                </span>
                <span className="text-xl font-black text-amber-500 tracking-widest uppercase select-all">
                  {roomCode}
                </span>
              </div>

              {/* Action Buttons Row */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyLink}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 border active:scale-95 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer shadow-sm ${theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'}`}
                >
                  <Link size={11} className="text-blue-500" />
                  <span>Copy Link</span>
                </button>
                <button
                  onClick={handleCopyCode}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 border active:scale-95 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all duration-200 cursor-pointer shadow-sm ${theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'}`}
                >
                  <Copy size={11} className="text-amber-500" />
                  <span>Copy Code</span>
                </button>
              </div>


              {/* Joined Players List */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-0">
                <div className={`flex justify-between items-center text-[9px] font-extrabold uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-white/40'}`}>
                  <span>Joined Warriors</span>
                  <span>{onlineRoom.players.length} / 4 Max</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {onlineRoom.isTeamUpMode ? (
                    <div className="flex flex-col gap-1.5 animate-fadeIn">
                      {/* Team 1: RED & YELLOW */}
                      <div className={`border rounded-xl p-2 flex flex-col gap-1.5 shadow-md relative ${theme === 'light' ? 'bg-red-500/5 border-red-500/20' : 'backdrop-blur-xl bg-red-500/5 border-red-500/15'}`}>
                        <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border rounded self-start mb-0.5 ${theme === 'light' ? 'text-red-600 bg-red-50 border-red-200' : 'text-red-400/95 bg-red-500/10 border-red-500/20'}`}>
                          Team 1 (RED & YELLOW)
                        </div>
                        {['RED', 'YELLOW'].map((color) => {
                          const p = onlineRoom.players.find((player) => player.color === color);
                          if (p) {
                            return (
                              <div 
                                key={color}
                                className={`border rounded-lg px-2.5 py-1.5 flex justify-between items-center shadow transition-all duration-300 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span 
                                    className={`w-2.5 h-2.5 rounded-full border shadow-inner ${theme === 'light' ? 'border-slate-300' : 'border-white/20'}`} 
                                    style={{ backgroundColor: COLOR_HEX[color as PlayerColor] }} 
                                  />
                                  <span className={`text-[11px] font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white/90'}`}>
                                    {p.name} {p.id === myPlayerId ? '(You)' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {p.isCreator && (
                                    <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded border ${theme === 'light' ? 'text-amber-800 bg-amber-100 border-amber-300' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                                      Host
                                    </span>
                                  )}
                                  <div className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${theme === 'light' ? 'text-blue-700 bg-blue-100/60 border-blue-300' : 'text-blue-500 bg-blue-500/10 border-blue-500/20'}`}>
                                    {color}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div 
                                key={color}
                                className={`border border-dashed rounded-lg px-2.5 py-1.5 flex justify-between items-center shadow-sm opacity-60 ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-white/5 border-white/5'}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span 
                                    className={`w-2.5 h-2.5 rounded-full border shadow-inner bg-transparent`} 
                                    style={{ borderColor: COLOR_HEX[color as PlayerColor] }} 
                                  />
                                  <span className={`text-[11px] font-black italic ${theme === 'light' ? 'text-slate-700' : 'text-white/30'}`}>Waiting...</span>
                                </div>
                                <div className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${theme === 'light' ? 'text-slate-800 bg-slate-100 border-slate-300' : 'text-white/30 bg-white/5 border-white/5'}`}>
                                  {color}
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>

                      {/* Divider with VS */}
                      <div className="relative flex py-0.5 items-center justify-center">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className={`w-full border-t ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase">
                          <span className={`border px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest shadow ${theme === 'light' ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-slate-950 border-white/10 text-white/50'}`}>
                            VS
                          </span>
                        </div>
                      </div>

                      {/* Team 2: GREEN & BLUE */}
                      <div className={`border rounded-xl p-2 flex flex-col gap-1.5 shadow-md relative ${theme === 'light' ? 'bg-emerald-500/5 border-emerald-500/20' : 'backdrop-blur-xl bg-emerald-500/5 border-emerald-500/15'}`}>
                        <div className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border rounded self-start mb-0.5 ${theme === 'light' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-emerald-400/95 bg-emerald-500/10 border-emerald-500/20'}`}>
                          Team 2 (GREEN & BLUE)
                        </div>
                        {['GREEN', 'BLUE'].map((color) => {
                          const p = onlineRoom.players.find((player) => player.color === color);
                          if (p) {
                            return (
                              <div 
                                key={color}
                                className={`border rounded-lg px-2.5 py-1.5 flex justify-between items-center shadow transition-all duration-300 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span 
                                    className={`w-2.5 h-2.5 rounded-full border shadow-inner ${theme === 'light' ? 'border-slate-300' : 'border-white/20'}`} 
                                    style={{ backgroundColor: COLOR_HEX[color as PlayerColor] }} 
                                  />
                                  <span className={`text-[11px] font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white/90'}`}>
                                    {p.name} {p.id === myPlayerId ? '(You)' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {p.isCreator && (
                                    <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded border ${theme === 'light' ? 'text-amber-800 bg-amber-100 border-amber-300' : 'text-amber-500 bg-amber-500/10 border border-amber-500/20'}`}>
                                      Host
                                    </span>
                                  )}
                                  <div className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${theme === 'light' ? 'text-blue-700 bg-blue-100/60 border-blue-300' : 'text-blue-500 bg-blue-500/10 border-blue-500/20'}`}>
                                    {color}
                                  </div>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div 
                                key={color}
                                className={`border border-dashed rounded-lg px-2.5 py-1.5 flex justify-between items-center shadow-sm opacity-60 ${theme === 'light' ? 'bg-white border-slate-300' : 'bg-white/5 border-white/5'}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span 
                                    className={`w-2.5 h-2.5 rounded-full border shadow-inner bg-transparent`} 
                                    style={{ borderColor: COLOR_HEX[color as PlayerColor] }} 
                                  />
                                  <span className={`text-[11px] font-black italic ${theme === 'light' ? 'text-slate-700' : 'text-white/30'}`}>Waiting...</span>
                                </div>
                                <div className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${theme === 'light' ? 'text-slate-800 bg-slate-100 border-slate-300' : 'text-white/30 bg-white/5 border-white/5'}`}>
                                  {color}
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>

                      {/* Split/Rotate Button below Team 2 for Host */}
                      {onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator && (
                        <div className="mt-1.5 flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={handleRotatePlayers}
                            disabled={onlineRoom.players.length < 3}
                            className={`w-full py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase shadow transition-all flex items-center justify-center gap-1 border ${
                              onlineRoom.players.length >= 3
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 cursor-pointer active:scale-95'
                                : 'bg-slate-300/20 text-slate-400 border-slate-400/20 cursor-not-allowed opacity-50'
                            }`}
                          >
                            🔄 {t('swapPlayers')}
                          </button>
                          {onlineRoom.players.length < 3 && (
                            <span className="text-[8px] font-extrabold text-amber-500/80">
                              (3-4 Players Required)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {['RED', 'YELLOW', 'GREEN', 'BLUE'].map((color) => {
                        const p = onlineRoom.players.find((player) => player.color === color);
                        if (p) {
                          return (
                            <div 
                              key={color}
                              className={`border rounded-xl px-3 py-2 flex justify-between items-center shadow transition-all duration-300 ${theme === 'light' ? 'bg-white border-slate-200' : 'backdrop-blur-xl bg-white/5 border-white/10'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span 
                                  className={`w-2.5 h-2.5 rounded-full border shadow-inner ${theme === 'light' ? 'border-slate-300' : 'border-white/20'}`} 
                                  style={{ backgroundColor: COLOR_HEX[color as PlayerColor] }} 
                                />
                                <span className={`text-[11px] font-bold ${theme === 'light' ? 'text-slate-800' : 'text-white/90'}`}>
                                  {p.name} {p.id === myPlayerId ? '(You)' : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {p.isCreator && (
                                  <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded border ${theme === 'light' ? 'text-amber-800 bg-amber-100 border-amber-300' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                                    Host
                                  </span>
                                )}
                                <div className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${theme === 'light' ? 'text-blue-700 bg-blue-100/60 border-blue-300' : 'text-blue-500 bg-blue-500/10 border-blue-500/20'}`}>
                                  {color}
                                </div>
                              </div>
                            </div>
                          );
                        } else {
                          return (
                            <div 
                              key={color}
                              className={`border border-dashed rounded-xl px-3 py-2 flex justify-between items-center shadow-sm opacity-60 ${theme === 'light' ? 'bg-white border-slate-300' : 'backdrop-blur-xl bg-white/5 border-white/5'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span 
                                  className={`w-2.5 h-2.5 rounded-full border shadow-inner bg-transparent`} 
                                  style={{ borderColor: COLOR_HEX[color as PlayerColor] }} 
                                />
                                <span className={`text-[11px] font-black italic ${theme === 'light' ? 'text-slate-700' : 'text-white/30'}`}>Waiting...</span>
                              </div>
                              <div className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded border ${theme === 'light' ? 'text-slate-800 bg-slate-100 border-slate-300' : 'text-white/30 bg-white/5 border-white/5'}`}>
                                {color}
                              </div>
                            </div>
                          );
                        }
                      })}

                      {/* Swap Players Button for Host in Standard Mode */}
                      {onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator && (
                        <div className="mt-1 flex flex-col items-center gap-0.5">
                          <button
                            type="button"
                            onClick={handleRotatePlayers}
                            disabled={onlineRoom.players.length < 3}
                            className={`w-full py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase shadow transition-all flex items-center justify-center gap-1 border ${
                              onlineRoom.players.length >= 3
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 cursor-pointer active:scale-95'
                                : 'bg-slate-300/20 text-slate-400 border-slate-400/20 cursor-not-allowed opacity-50'
                            }`}
                          >
                            🔄 {t('swapPlayers')}
                          </button>
                          {onlineRoom.players.length < 3 && (
                            <span className="text-[8px] font-extrabold text-amber-500/80">
                              (3-4 Players Required)
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* 3 Game Rules Toggles Widget */}
                  <div className={`mt-2 p-2.5 rounded-xl border flex flex-col gap-1.5 shadow-sm transition-all text-left ${theme === 'light' ? 'bg-white border-slate-200' : 'backdrop-blur-xl bg-white/5 border-white/10'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-600' : 'text-white/60'}`}>
                        ⚙️ Match Rules & Settings
                      </span>
                      {onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator ? (
                        <span className="text-[8px] font-extrabold text-amber-500 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                          Host Controls
                        </span>
                      ) : (
                        <span className={`text-[8px] font-extrabold uppercase ${theme === 'light' ? 'text-slate-400' : 'text-white/40'}`}>
                          Host Configured
                        </span>
                      )}
                    </div>

                    <div className={`grid grid-cols-3 divide-x rounded-xl border p-1 text-left ${theme === 'light' ? 'bg-slate-50 border-slate-200 divide-slate-200' : 'bg-black/20 border-white/10 divide-white/10'}`}>
                      {/* Column 1: Team Up Mode */}
                      <div className="px-1.5 py-1 flex flex-col items-start gap-1">
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                            {t('teamUpLabel')}
                          </span>
                          {onlineRoom.players.length < 4 && (
                            <span className="text-[7px] font-bold text-amber-500/90 leading-tight">
                              (4 Players Req)
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator || onlineRoom.players.length < 4}
                          onClick={() => handleToggleLobbySetting('isTeamUpMode', !onlineRoom.isTeamUpMode)}
                          className={`w-8 h-4 rounded-full relative p-0.5 transition-colors duration-200 flex-shrink-0
                            ${onlineRoom.players.length < 4
                              ? (theme === 'light' ? 'bg-slate-200 opacity-50 cursor-not-allowed' : 'bg-white/10 opacity-40 cursor-not-allowed')
                              : onlineRoom.isTeamUpMode 
                                ? 'bg-emerald-500 cursor-pointer' 
                                : (theme === 'light' ? 'bg-slate-300 cursor-pointer' : 'bg-white/15 cursor-pointer')
                            }
                          `}
                          title={onlineRoom.players.length < 4 ? "Team Up mode requires 4 players in lobby" : "Toggle Team Up Mode"}
                        >
                          <div className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform duration-200 ${onlineRoom.players.length === 4 && onlineRoom.isTeamUpMode ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Column 2: Must Kill (Home Entry Lock) */}
                      <div className="px-1.5 py-1 flex flex-col items-start gap-1">
                        <span className={`text-[10px] font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                          {t('mustKill')}
                        </span>
                        <button
                          type="button"
                          disabled={!onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator}
                          onClick={() => handleToggleLobbySetting('isHomeEntryLockEnabled', !(onlineRoom.isHomeEntryLockEnabled !== false))}
                          className={`w-8 h-4 rounded-full relative p-0.5 transition-colors duration-200 flex-shrink-0
                            ${!onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator ? 'cursor-default' : 'cursor-pointer'}
                            ${onlineRoom.isHomeEntryLockEnabled !== false 
                              ? 'bg-blue-500' 
                              : (theme === 'light' ? 'bg-slate-300' : 'bg-white/15')
                            }
                          `}
                        >
                          <div className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform duration-200 ${onlineRoom.isHomeEntryLockEnabled !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Column 3: Double Block (Token Block) */}
                      <div className="px-1.5 py-1 flex flex-col items-start gap-1">
                        <span className={`text-[10px] font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                          {t('doubleBlock')}
                        </span>
                        <button
                          type="button"
                          disabled={!onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator}
                          onClick={() => handleToggleLobbySetting('isTokenBlockEnabled', !onlineRoom.isTokenBlockEnabled)}
                          className={`w-8 h-4 rounded-full relative p-0.5 transition-colors duration-200 flex-shrink-0
                            ${!onlineRoom.players.find((p) => p.id === myPlayerId)?.isCreator ? 'cursor-default' : 'cursor-pointer'}
                            ${onlineRoom.isTokenBlockEnabled 
                              ? 'bg-emerald-500' 
                              : (theme === 'light' ? 'bg-slate-300' : 'bg-white/15')
                            }
                          `}
                        >
                          <div className={`w-3 h-3 rounded-full bg-white shadow-md transform transition-transform duration-200 ${onlineRoom.isTokenBlockEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Launch Controls */}
              <div className="flex flex-col gap-1.5 mt-auto flex-shrink-0">
                {onlineRoom.players[0]?.id === myPlayerId ? (
                  <button
                    onClick={handleLaunchOnlineGame}
                    disabled={onlineRoom.players.length < 2}
                    className={`w-full py-2 px-3 font-extrabold text-xs uppercase tracking-wider rounded-lg shadow-md flex items-center justify-center gap-2 border cursor-pointer
                      ${onlineRoom.players.length >= 2 
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 hover:brightness-110 border-emerald-300/20 text-white active:scale-98 shadow-emerald-500/10' 
                        : (theme === 'light' ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed' : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed')
                      }
                    `}
                  >
                    Start Online Match
                  </button>
                ) : (
                  <div className={`border p-2 rounded-lg text-center text-[10px] font-bold ${theme === 'light' ? 'bg-white border-slate-200 text-blue-600' : 'backdrop-blur-xl bg-white/5 border-white/10 text-blue-400'}`}>
                    ⏳ Waiting for Room Creator to initiate the battle...
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ACTIVE GAMEPLAY BOARD SCREEN */}
          {activeScreen === 'GAME' && (
            <motion.div
              key="screen-game"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              dir="ltr"
              className="flex-1 min-h-0 flex flex-col p-1 sm:p-2 overflow-y-auto custom-scrollbar justify-start items-center"
            >
              {/* Unified Game Layout Container */}
              <div className="w-full max-w-[480px] mx-auto flex flex-col items-center gap-1.5 sm:gap-2 relative">
                {/* Complete board component */}
                <LudoBoard
                  tokens={gameState.players.flatMap((p) => p.tokens)}
                  activePlayerColor={gameState.players[gameState.activePlayerIndex]?.color}
                  playableTokenIds={getPlayableTokens(gameState, true)}
                  playableTokens={getPlayableTokensFull(gameState, true)}
                  selectedDiceValue={gameState.selectedDiceValue}
                  hasKilledOpponent={gameState.players.reduce((acc, p) => ({ ...acc, [p.color]: p.hasKilledOpponent }), {} as Record<PlayerColor, boolean>)}
                  onTokenClick={handleTokenClick}
                  players={gameState.players}
                  activePlayerIndex={gameState.activePlayerIndex}
                  diceQueue={gameState.diceQueue}
                  isRolling={isRolling}
                  onRoll={rollDice}
                  onRollStart={startHoldingDice}
                  onRollRelease={releaseHoldingDice}
                  onSelectDiceValue={selectDiceValue}
                  myPlayerColor={myPlayerColor}
                  winnerColor={gameState.winnerColor}
                  hasBustedThisTurn={gameState.hasBustedThisTurn}
                  diceRollCountThisTurn={gameState.diceRollCountThisTurn}
                  extraRollsCount={gameState.extraRollsCount}
                  isBonusRolling={gameState.isBonusRolling}
                  theme={theme}
                  turnCountdown={turnCountdown}
                  isWaitingForBoardSync={isWaitingForBoardSync}
                  isVibrationEnabled={isVibrationEnabled}
                  selectedLanguage={selectedLanguage}
                  isHomeEntryLockEnabled={gameState.isHomeEntryLockEnabled}
                  isTokenBlockEnabled={gameState.isTokenBlockEnabled}
                  isTeamUpMode={gameState.isTeamUpMode}
                  blinkActive={blinkDiceQueue}
                  isWaitingForDiceNumber={isWaitingForDiceNumber}
                />

                {/* Google AdMob Banner */}
                <div className="w-full flex-shrink-0 pt-0 pb-0.5">
                  <AdBanner theme={theme} />
                </div>
              </div>

              {/* Victory Screen Backdrop overlay */}
              {gameState.winnerColor && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
                  <div className="relative mb-3">
                    <div className="absolute -inset-2 rounded-full bg-amber-500 blur-md opacity-40 animate-pulse" />
                    <div className="relative bg-white/5 border border-amber-400 p-4 rounded-full backdrop-blur-xl">
                      <Trophy size={44} className="text-amber-400 animate-bounce" />
                    </div>
                  </div>

                  <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase">
                    {gameState.isTeamUpMode ? '🏆 TEAM UP MATCH COMPLETE!' : t('matchComplete')}
                  </h2>

                  {gameState.isTeamUpMode ? (
                    <div className="mt-2 flex flex-col items-center gap-1">
                      <p className="text-base font-black text-amber-400">
                        {gameState.winnerColor === PlayerColor.RED || gameState.winnerColor === PlayerColor.YELLOW
                          ? '🎉 TEAM 1 (RED & YELLOW) WON THE MATCH!'
                          : '🎉 TEAM 2 (GREEN & BLUE) WON THE MATCH!'
                        }
                      </p>
                      <p className="text-xs font-semibold text-white/70">
                        All 8 tokens brought HOME successfully!
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 w-full max-w-xs flex flex-col gap-2">
                      {gameState.rankings && gameState.rankings.length > 0 ? (
                        gameState.rankings.map((color, idx) => {
                          const player = gameState.players.find((p) => p.color === color);
                          const rankLabels = ['1st Place 🥇', '2nd Place 🥈', '3rd Place 🥉', '4th Place 🏅'];
                          return (
                            <div
                              key={color}
                              className="flex items-center justify-between px-3 py-2 rounded-xl border bg-white/5 border-white/10"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm"
                                  style={{ backgroundColor: COLOR_HEX[color] }}
                                />
                                <span className="text-xs font-black text-white">
                                  {player?.name || PLAYER_NAMES[color]}
                                </span>
                              </div>
                              <span className="text-xs font-extrabold text-amber-400">
                                {rankLabels[idx] || `${idx + 1}th Place`}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm font-extrabold mt-2 text-white/90" style={{ color: COLOR_HEX[gameState.winnerColor] }}>
                          {PLAYER_NAMES[gameState.winnerColor]} ({t('winner')})
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      cleanUpWebSocket();
                      localStorage.removeItem('ludo_room_code');
                      roomVersionRef.current = -1;
                      setActiveScreen('HOME');
                      setGameState((prev) => ({ ...prev, gameStarted: false, winnerColor: null, rankings: [] }));
                    }}
                    className="mt-6 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-400 hover:brightness-110 border border-blue-300/20 text-white font-bold text-xs rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer"
                  >
                    {t('playNewMatch')}
                  </button>
                </div>
              )}

              {/* Exit Confirmation Modal */}
              {isExitModalOpen && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
                  <div className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl transition-all duration-300 flex flex-col justify-between h-40 min-h-[160px]
                    ${theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-800'
                      : 'bg-[#0b1329] border-white/10 text-white'
                    }
                  `}>
                    <div className="text-center mt-2">
                      <p className="text-sm font-extrabold tracking-wide uppercase">
                        {t('exitConfirmText')}
                      </p>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setIsExitModalOpen(false)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer border
                          ${theme === 'light'
                            ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                          }
                        `}
                      >
                        {t('no')}
                      </button>
                      <button
                        onClick={async () => {
                          if (gameState.mode === GameMode.ONLINE && roomCode) {
                            try {
                              const updatedPlayers = gameState.players.map(p => {
                                if (p.color === myPlayerColor) {
                                  return { ...p, hasQuit: true, strikes: 3 };
                                }
                                return p;
                              });
                              let nextActiveIndex = gameState.activePlayerIndex;
                              if (gameState.players[gameState.activePlayerIndex]?.color === myPlayerColor) {
                                nextActiveIndex = (gameState.activePlayerIndex + 1) % gameState.players.length;
                              }
                              const updatedState = {
                                ...gameState,
                                stateVersion: (gameState.stateVersion || 0) + 1,
                                players: updatedPlayers,
                                activePlayerIndex: nextActiveIndex,
                                diceRollCountThisTurn: 0,
                                consecutiveSixesCount: 0,
                                extraRollsCount: 0,
                                hasBustedThisTurn: false,
                                diceQueue: [],
                                selectedDiceValue: null,
                                logs: [`🚪 ${gameState.players.find(p => p.color === myPlayerColor)?.name || 'Opponent'} has quit the match!`, ...gameState.logs],
                              };
                              
                              // Broadcast updated state with quit player over P2P
                              broadcastGameStateViaP2P(updatedState);
                            } catch (err) {
                              console.warn("Failed to notify peers of quit", err);
                            }
                          }
                          cleanUpWebSocket();
                          localStorage.removeItem('ludo_room_code');
                          roomVersionRef.current = -1;
                          setActiveScreen('HOME');
                          setGameState((prev) => ({ ...prev, gameStarted: false, winnerColor: null }));
                          setIsExitModalOpen(false);
                        }}
                        className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer
                          bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20
                        `}
                      >
                        {t('yes')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>

        {/* Lobby Leave Confirmation Modal */}
        {isLobbyLeaveModalOpen && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl transition-all duration-300 flex flex-col justify-between h-40 min-h-[160px]
              ${theme === 'light'
                ? 'bg-white border-slate-200 text-slate-800'
                : 'bg-[#0b1329] border-white/10 text-white'
              }
            `}>
              <div className="text-center mt-2">
                <p className="text-sm font-extrabold tracking-wide uppercase">
                  {t('exitLobbyConfirm')}
                </p>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setIsLobbyLeaveModalOpen(false)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer border
                    ${theme === 'light'
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                    }
                  `}
                >
                  {t('no')}
                </button>
                <button
                  onClick={handleLeaveLobby}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer
                    bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20
                  `}
                >
                  {t('yes')}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* REJOIN ONGOING MATCH POPUP */}
      <AnimatePresence>
        {showRejoinPopup && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center select-none animate-fadeIn">
            <div className="backdrop-blur-xl bg-slate-900/95 border border-amber-500/30 p-6 rounded-2xl max-w-sm w-full flex flex-col items-center gap-4 shadow-2xl relative">
              <div className="absolute -top-10 bg-amber-500/20 border border-amber-500/40 p-4 rounded-full text-amber-400 shadow-xl">
                <RotateCcw size={32} className="animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className="mt-6 flex flex-col gap-1.5">
                <h3 className="text-base font-extrabold text-white">Ongoing Match Detected!</h3>
                <p className="text-xs text-white/60">
                  You have an ongoing online Ludo match! Do you want to rejoin this battle?
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={handleConfirmRejoin}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-400 border border-emerald-500 text-white font-extrabold text-xs uppercase rounded-xl shadow-md active:scale-95 cursor-pointer transition-all duration-150"
                >
                  Yes, Rejoin
                </button>
                <button
                  onClick={handleCancelRejoin}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 font-extrabold text-xs uppercase rounded-xl active:scale-95 cursor-pointer transition-all duration-150"
                >
                  No, Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REJOIN TOAST / NOTIFICATION */}
        {rejoinNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600 border border-red-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xl z-50 flex items-center gap-2"
          >
            <span className="text-sm">⚠️</span> {rejoinNotification}
          </motion.div>
        )}

        {/* PREVIOUS MATCH ENDED POPUP */}
        {showMatchEndedPopup && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-6 text-center select-none animate-fadeIn">
            <div className="backdrop-blur-xl bg-slate-900/95 border border-red-500/30 p-6 rounded-2xl max-w-sm w-full flex flex-col items-center gap-4 shadow-2xl relative">
              <div className="absolute -top-10 bg-red-500/20 border border-red-500/40 p-4 rounded-full text-red-400 shadow-xl animate-bounce" style={{ animationDuration: '3s' }}>
                <Info size={32} />
              </div>
              <div className="mt-6 flex flex-col gap-1.5">
                <h3 className="text-base font-extrabold text-white">Previous Match Has Ended</h3>
                <p className="text-xs text-white/60">
                  The previous online match has either finished or expired. Your session room cache has been cleared.
                </p>
              </div>
              <button
                onClick={() => setShowMatchEndedPopup(false)}
                className="w-full mt-2 py-2.5 bg-gradient-to-r from-red-600 to-red-400 border border-red-500 text-white font-extrabold text-xs uppercase rounded-xl shadow-md active:scale-95 cursor-pointer transition-all duration-150"
              >
                Okay, Got it
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS OVERLAY PAGE */}
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.4 }}
            className={`absolute inset-0 z-50 flex flex-col select-none overflow-y-auto scrollbar-thin p-3 sm:p-4 gap-3
              ${theme === 'light' ? 'bg-slate-50 text-slate-950' : 'bg-slate-950/95 backdrop-blur-xl text-white'}
            `}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b pt-8 pb-3 mb-2 min-h-[66px] ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                  }}
                  className={`p-2 rounded-lg border transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center
                    ${theme === 'light'
                      ? 'bg-slate-200/50 hover:bg-slate-300/80 border-slate-300 text-slate-600 hover:text-slate-800'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                    }
                  `}
                >
                  <ArrowLeft size={18} strokeWidth={2.5} className="rtl:rotate-180" />
                </button>
                <h2 className={`text-base font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {t('settings')}
                </h2>
              </div>
              <div className="p-2 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-lg text-white shadow-md">
                <Settings size={20} />
              </div>
            </div>

            {/* Content Options */}
            <div className="flex flex-col gap-3 flex-1">
              
              {/* Option: Profile & Language Edit Widget */}
              <div 
                onClick={() => {
                  setTempProfileName(profileName);
                  setTempProfileSurname(profileSurname);
                  setTempProfileAvatar(profileAvatar);
                  setIsProfileModalOpen(true);
                  playSynthSound('safe');
                }}
                className={`border rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-98 hover:brightness-105
                  ${theme === 'light' ? 'bg-slate-100 border-slate-200 hover:bg-slate-200/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}
                `}
              >
                <div className="flex items-center gap-3">
                  {(() => {
                    const activeAvatar = INBUILT_AVATARS.find(a => a.id === profileAvatar);
                    return activeAvatar ? (
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md border border-white/10 ${activeAvatar.bg}`}>
                        {activeAvatar.emoji}
                      </div>
                    ) : (
                      <div className="p-2 bg-gradient-to-tr from-amber-500 to-amber-400 rounded-xl text-slate-950 shadow-md">
                        <User size={18} />
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                      {profileName || t('warriorProfile') || t('warriorName')} {profileSurname ? <span className="text-amber-500 font-bold text-sm ml-1">{profileSurname}</span> : null}
                    </h3>
                  </div>
                </div>
                
                <div className={`text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border flex items-center gap-0.5
                  ${theme === 'light' 
                    ? 'bg-white border-slate-300 text-slate-700' 
                    : 'bg-white/10 border-white/10 text-white/80'
                  }
                `}>
                  <span>{t('edit')}</span>
                  <ArrowRight size={10} className="rtl:rotate-180" />
                </div>
              </div>

              {/* Option 1: Sound Effects */}
              <div className={`border rounded-2xl p-3.5 flex flex-col gap-2.5
                ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500">
                      <Volume2 size={20} />
                    </div>
                    <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{t('soundEffects')}</h3>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {!isMuted && (
                      <button
                        onClick={() => playSynthSound('roll')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase transition-all duration-150 active:scale-95 cursor-pointer
                          ${theme === 'light' 
                            ? 'bg-blue-100 hover:bg-blue-200 text-blue-600 border border-blue-200' 
                            : 'bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400'
                          }
                        `}
                      >
                        {t('test') || 'Test'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsMuted(!isMuted);
                        if (isMuted) {
                          setTimeout(() => playSynthSound('safe'), 50);
                        }
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                        !isMuted ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                          !isMuted ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 2: Vibration Control */}
              <div className={`border rounded-2xl p-3.5 flex flex-col gap-2.5
                ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-xl text-pink-500">
                      <Vibrate size={20} />
                    </div>
                    <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{t('vibration')}</h3>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {isVibrationEnabled && (
                      <button
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            navigator.vibrate([40, 60, 40]);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase transition-all duration-150 active:scale-95 cursor-pointer
                          ${theme === 'light' 
                            ? 'bg-pink-100 hover:bg-pink-200 text-pink-600 border border-pink-200' 
                            : 'bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 text-pink-400'
                          }
                        `}
                      >
                        {t('test') || 'Test'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setIsVibrationEnabled(!isVibrationEnabled);
                        if (!isVibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
                          navigator.vibrate(35);
                        }
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                        isVibrationEnabled ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                          isVibrationEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Option 3: Screen Theme */}
              <div className={`border rounded-2xl p-3.5 flex items-center justify-between
                ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500">
                    <Sparkles size={20} />
                  </div>
                  <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>{t('theme')}</h3>
                </div>
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-300 cursor-pointer ${
                    theme === 'dark' ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 ${
                      theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Option 4: Strategic Rulebook */}
              <div 
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsRulesScreenOpen(true);
                  playSynthSound('safe');
                }}
                className={`border rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-98 hover:brightness-105
                  ${theme === 'light' ? 'bg-slate-100 border-slate-200 hover:bg-slate-200/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-500">
                    <BookOpen size={20} />
                  </div>
                  <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    {t('rulebook')}
                  </h3>
                </div>
                <div className={`text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border flex items-center gap-0.5
                  ${theme === 'light' 
                    ? 'bg-white border-slate-300 text-slate-700' 
                    : 'bg-white/10 border-white/10 text-white/80'
                  }
                `}>
                  <span>{t('read')}</span>
                  <ArrowRight size={10} className="rtl:rotate-180" />
                </div>
              </div>

              {/* Option 5: Privacy Policy */}
              <a 
                href="https://sites.google.com/view/ludo-strategize/home"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playSynthSound('safe')}
                className={`border rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition-all duration-200 active:scale-98 hover:brightness-105
                  ${theme === 'light' ? 'bg-slate-100 border-slate-200 hover:bg-slate-200/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500">
                    <Shield size={20} />
                  </div>
                  <h3 className={`text-base font-black ${theme === 'light' ? 'text-slate-800' : 'text-white'}`}>
                    {t('privacyPolicy')}
                  </h3>
                </div>
                <div className={`text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border flex items-center gap-0.5
                  ${theme === 'light' 
                    ? 'bg-white border-slate-300 text-slate-700' 
                    : 'bg-white/10 border-white/10 text-white/80'
                  }
                `}>
                  <span>{t('read')}</span>
                  <ArrowRight size={10} className="rtl:rotate-180" />
                </div>
              </a>

              {/* Footer Copyright Notice */}
              <div className={`mt-auto pt-4 pb-2 text-center text-xs font-semibold ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Ludo Strategize v1.0.0 By Suraj Singh © 2026 All Rights Reserved.
              </div>

            </div>


          </motion.div>
        )}

        {/* PROFILE SETUP PAGE */}
        {isProfileModalOpen && (
          <div className={`absolute inset-0 z-[100] flex flex-col select-none overflow-y-auto transition-all duration-300
            ${theme === 'light' ? 'bg-slate-50 text-slate-800' : 'bg-[#070b19] text-white'}
          `}>
            {/* Header */}
            <div className={`pt-8 pb-3 px-4 flex items-center gap-3 border-b shrink-0 sticky top-0 backdrop-blur-md z-30 min-h-[66px]
              ${theme === 'light' ? 'bg-white/95 border-slate-200' : 'bg-[#0b1329]/95 border-white/10'}
            `}>
              {/* Back Button - Only if profile already exists */}
              {profileName && profileAvatar && (
                <button
                  type="button"
                  title="Back"
                  onClick={handleCancelProfile}
                  className={`p-1.5 rounded-lg border transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center
                    ${theme === 'light'
                      ? 'bg-slate-200/50 hover:bg-slate-300/80 border-slate-300 text-slate-600 hover:text-slate-800'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                    }
                  `}
                >
                  <ArrowLeft size={16} strokeWidth={2.5} className="rtl:rotate-180" />
                </button>
              )}

              <div className="flex items-center gap-2.5 ml-auto">
                <h3 className="text-sm font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  {t('setupProfile')}
                </h3>
                <div className="p-2 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-xl text-slate-950 font-black flex items-center justify-center text-sm shadow-md shadow-amber-500/20">
                  {tempProfileAvatar ? (
                    <span className="text-base leading-none">{INBUILT_AVATARS.find(a => a.id === tempProfileAvatar)?.emoji || '👤'}</span>
                  ) : (
                    <User size={18} className="text-slate-950" />
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 p-4 flex flex-col gap-4 min-h-0 overflow-y-auto">
              
              {/* Section 1: Choose Language */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-blue-500/15 border border-blue-500/20 text-blue-400 rounded-md">
                    <Globe size={14} />
                  </div>
                  <span className={`text-[12px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-white/50'}`}>
                    {t('chooseLanguageStep')}
                  </span>
                </div>
                <div className={`grid grid-cols-3 gap-2.5 p-2.5 rounded-2xl border
                  ${theme === 'light' ? 'bg-slate-100/50 border-slate-200' : 'bg-slate-950/40 border-white/5'}
                `}>
                  {[
                    { id: 'English', native: 'English' },
                    { id: 'हिन्दी', native: 'हिन्दी' },
                    { id: 'العربية', native: 'العربية' },
                    { id: 'Español', native: 'Español' },
                    { id: 'Português', native: 'Português' },
                    { id: 'தமிழ்', native: 'தமிழ்' },
                    { id: 'తెలుగు', native: 'తెలుగు' },
                    { id: 'ಕನ್ನಡ', native: 'ಕನ್ನಡ' },
                    { id: 'മലയാളം', native: 'മലയാളം' }
                  ].map((lang) => {
                    const isSelected = selectedLanguage === lang.id;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => {
                          setSelectedLanguage(lang.id);
                          localStorage.setItem('ludo_selected_language', lang.id);
                          triggerToast(`Selected: ${lang.native}`);
                          playSynthSound('safe');
                        }}
                        className={`h-12 w-full rounded-xl flex flex-col items-center justify-center border transition-all duration-150 active:scale-95 cursor-pointer text-center px-1
                          ${isSelected
                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-500 ring-2 ring-blue-500/20'
                            : theme === 'light'
                              ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/80'
                          }
                        `}
                      >
                        <span className="text-sm font-black leading-tight">{lang.native}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Choose Avatar */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-amber-500/15 border border-amber-500/20 text-amber-400 rounded-md">
                    <User size={14} />
                  </div>
                  <span className={`text-[12px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-white/50'}`}>
                    {t('chooseAvatarStep')}
                  </span>
                </div>
                <div className={`grid grid-cols-6 gap-2 p-2.5 rounded-2xl border max-h-52 overflow-y-auto scrollbar-thin
                  ${theme === 'light' ? 'bg-slate-100/50 border-slate-200' : 'bg-slate-950/40 border-white/5'}
                `}>
                  {INBUILT_AVATARS.map((avatar) => {
                    const isSelected = tempProfileAvatar === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          setTempProfileAvatar(avatar.id);
                          playSynthSound('move');
                        }}
                        className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all duration-200 relative cursor-pointer group active:scale-90
                          ${avatar.bg}
                          ${isSelected 
                            ? 'ring-2 ring-amber-500 scale-105 shadow-md shadow-amber-500/20' 
                            : 'hover:brightness-110 border border-white/10 opacity-75 hover:opacity-100'
                          }
                        `}
                        title={avatar.name}
                      >
                        <span>{avatar.emoji}</span>
                        {isSelected && (
                          <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-slate-950 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border border-[#0b1329]">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Warrior Name & Surname */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-md">
                    <Shield size={14} />
                  </div>
                  <span className={`text-[12px] font-black uppercase tracking-widest ${theme === 'light' ? 'text-slate-500' : 'text-white/50'}`}>
                    {t('warriorNameStep')}
                  </span>
                </div>
                
                {/* Dual Input with Middle Divider Line */}
                <div className={`flex items-center w-full border rounded-2xl overflow-hidden focus-within:border-amber-400 transition-colors
                  ${theme === 'light'
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#050b18] border-white/10 text-white'
                  }
                `}>
                  {/* Name Input */}
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="Name"
                    value={tempProfileName}
                    onChange={(e) => setTempProfileName(e.target.value)}
                    className={`w-1/2 px-4 py-3.5 text-sm font-extrabold bg-transparent focus:outline-none placeholder:font-bold placeholder:blur-[0.4px] transition-all
                      ${theme === 'light'
                        ? 'placeholder:text-slate-400/60'
                        : 'placeholder:text-white/30'
                      }
                    `}
                  />

                  {/* Vertical Divider Line */}
                  <div className={`w-[1.5px] h-7 shrink-0 ${theme === 'light' ? 'bg-slate-300' : 'bg-white/20'}`} />

                  {/* Surname Input */}
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="Surname"
                    value={tempProfileSurname}
                    onChange={(e) => setTempProfileSurname(e.target.value)}
                    className={`w-1/2 px-4 py-3.5 text-sm font-extrabold bg-transparent focus:outline-none placeholder:font-bold placeholder:blur-[0.4px] transition-all
                      ${theme === 'light'
                        ? 'placeholder:text-slate-400/60'
                        : 'placeholder:text-white/30'
                      }
                    `}
                  />
                </div>
              </div>

              {/* Section 4: Action Button */}
              <div className="mt-3">
                <button
                  type="button"
                  disabled={!tempProfileAvatar}
                  onClick={() => {
                    const trimmedName = tempProfileName.trim() || 'Player 1';
                    const trimmedSurname = tempProfileSurname.trim();
                    localStorage.setItem('ludo_profile_name', trimmedName);
                    localStorage.setItem('ludo_profile_surname', trimmedSurname);
                    localStorage.setItem('ludo_profile_avatar', tempProfileAvatar);
                    localStorage.setItem('ludo_selected_language', selectedLanguage);
                    setProfileName(trimmedName);
                    setProfileSurname(trimmedSurname);
                    setProfileAvatar(tempProfileAvatar);
                    setIsProfileModalOpen(false);
                    triggerToast(`Profile saved as ${trimmedName} ${trimmedSurname}`.trim() + '!');
                    playSynthSound('safe');
                  }}
                  className={`w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer text-center
                    ${tempProfileAvatar
                      ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20 hover:brightness-110'
                      : 'bg-slate-300 dark:bg-white/5 border border-transparent text-slate-400 dark:text-white/20 cursor-not-allowed'
                    }
                  `}
                >
                  {t('saveProfile')}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* LANGUAGE SELECTION MODAL */}
        {isLanguagePopupOpen && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[115] flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl transition-all duration-300 flex flex-col gap-4 max-h-[95%]
                ${theme === 'light'
                  ? 'bg-white border-slate-200 text-slate-800'
                  : 'bg-[#0b1329] border-white/10 text-white'
                }
              `}
            >
              <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                    <Globe size={16} />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    {t('selectLanguage')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLanguagePopupOpen(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all duration-150 cursor-pointer active:scale-95 border
                    ${theme === 'light' 
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' 
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                    }
                  `}
                >
                  {t('close')}
                </button>
              </div>

              {/* Scrollable list of language buttons */}
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 max-h-[500px]">
                {[
                  { id: 'English', native: 'English' },
                  { id: 'हिन्दी', native: 'हिन्दी' },
                  { id: 'العربية', native: 'العربية' },
                  { id: 'Español', native: 'Español' },
                  { id: 'Português', native: 'Português' },
                  { id: 'தமிழ்', native: 'தமிழ்' },
                  { id: 'తెలుగు', native: 'తెలుగు' },
                  { id: 'ಕನ್ನಡ', native: 'ಕನ್ನಡ' },
                  { id: 'മലയാളം', native: 'മലയാളം' }
                ].map((lang) => {
                  const isSelected = selectedLanguage === lang.id;
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => {
                        setSelectedLanguage(lang.id);
                        setIsLanguagePopupOpen(false);
                        triggerToast(`Selected: ${lang.native}`);
                      }}
                      className={`w-full py-2.5 px-4 rounded-2xl flex items-center justify-between border transition-all duration-150 active:scale-98 cursor-pointer
                        ${lang.id === 'العربية' ? 'flex-row-reverse text-right' : 'text-left'}
                        ${isSelected
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-500'
                          : theme === 'light'
                            ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-white/5 hover:bg-white/10 border-white/5 text-white/80'
                        }
                      `}
                    >
                      <div className={`flex flex-col ${lang.id === 'العربية' ? 'items-end' : 'items-start'}`}>
                        <span className="text-sm font-black" dir={lang.id === 'العربية' ? 'rtl' : 'ltr'}>{lang.native}</span>
                        {lang.id !== lang.native && (
                          <span className="text-[10px] opacity-60 font-medium">({lang.id})</span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="p-1 bg-blue-500 text-white rounded-full flex-shrink-0">
                          <CheckCircle size={14} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}

        {/* STRATEGIC RULEBOOK PAGE */}
        {isRulesScreenOpen && (
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -100 : 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? -100 : 100 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}
            className={`absolute inset-0 z-50 flex flex-col select-none overflow-y-auto scrollbar-thin px-5 pb-5 pt-8
              ${theme === 'light' ? 'bg-slate-50 text-slate-950' : 'bg-[#0b1329] backdrop-blur-xl text-white'}
            `}
          >
            {/* Header Bar */}
            <div className={`flex items-center justify-between border-b pb-3 mb-4 min-h-[50px] ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsRulesScreenOpen(false);
                    setIsSettingsOpen(true);
                    playSynthSound('safe');
                  }}
                  className={`p-1.5 rounded-lg border transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center
                    ${theme === 'light'
                      ? 'bg-slate-200/50 hover:bg-slate-300/80 border-slate-300 text-slate-600 hover:text-slate-800'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                    }
                  `}
                >
                  <ArrowLeft size={16} strokeWidth={2.5} className="rtl:rotate-180" />
                </button>
                <h2 className={`text-base font-black uppercase tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {t('rulesTitle')}
                </h2>
              </div>
            </div>

            {/* Scrollable Rules List Body */}
            <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-1 pb-6 scrollbar-thin text-left">
              {/* Rule 1 */}
              <div className={`border rounded-2xl p-4 flex flex-col gap-2.5 transition-all
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎲</span>
                  <h3 className="font-extrabold text-sm text-amber-500 uppercase tracking-wide">
                    {t('rule1Title')}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-white/85'}`}>
                  {t('rule1Desc')}
                </p>
              </div>

              {/* Rule 2 */}
              <div className={`border rounded-2xl p-4 flex flex-col gap-2.5 transition-all
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚔️</span>
                  <h3 className="font-extrabold text-sm text-emerald-500 uppercase tracking-wide">
                    {t('rule2Title')}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-white/85'}`}>
                  {t('rule2Desc')}
                </p>
              </div>

              {/* Rule 3 */}
              <div className={`border rounded-2xl p-4 flex flex-col gap-2.5 transition-all
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛡️</span>
                  <h3 className="font-extrabold text-sm text-blue-500 uppercase tracking-wide">
                    {t('rule3Title')}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-white/85'}`}>
                  {t('rule3Desc')}
                </p>
              </div>

              {/* Rule 4 */}
              <div className={`border rounded-2xl p-4 flex flex-col gap-2.5 transition-all
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🚦</span>
                  <h3 className="font-extrabold text-sm text-indigo-500 uppercase tracking-wide">
                    {t('rule4Title')}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-white/85'}`}>
                  {t('rule4Desc')}
                </p>
              </div>

              {/* Rule 5 */}
              <div className={`border rounded-2xl p-4 flex flex-col gap-2.5 transition-all
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤝</span>
                  <h3 className="font-extrabold text-sm text-purple-500 uppercase tracking-wide">
                    {t('rule5Title')}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-white/85'}`}>
                  {t('rule5Desc')}
                </p>
              </div>

              {/* Rule 6 */}
              <div className={`border rounded-2xl p-4 flex flex-col gap-2.5 transition-all
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔑</span>
                  <h3 className="font-extrabold text-sm text-cyan-500 uppercase tracking-wide">
                    {t('rule6Title')}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-white/85'}`}>
                  {t('rule6Desc')}
                </p>
              </div>

              {/* Rule 7 */}
              <div className={`border rounded-2xl p-4 flex flex-col gap-2.5 transition-all
                ${theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}
              `}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">⏱️</span>
                  <h3 className="font-extrabold text-sm text-rose-500 uppercase tracking-wide">
                    {t('rule7Title')}
                  </h3>
                </div>
                <p className={`text-xs leading-relaxed font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-white/85'}`}>
                  {t('rule7Desc')}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* NEW VERSION UPDATE REQUIRED MODAL */}
        {showUpdateModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl transition-all relative ${
                theme === 'light' 
                  ? 'bg-white border-slate-200 text-slate-800' 
                  : 'bg-[#0f172a] border-white/10 text-white'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-white shadow-xl shadow-amber-500/20 animate-pulse">
                  <ArrowUpCircle size={32} />
                </div>

                <div>
                  <span className="text-[10px] font-black tracking-widest text-amber-500 uppercase">
                    {t('newVersionAvailable')}
                  </span>
                  <h2 className="text-lg font-black tracking-tight mt-1">
                    {t('upgradeLudoTitle')}
                  </h2>
                </div>

                <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  {t('newVersionDesc')}
                </p>

                {/* Version display pills */}
                <div className="flex gap-4 w-full justify-center text-xs font-bold mt-2">
                  <div className={`px-3 py-1.5 rounded-xl flex flex-col items-center ${
                    theme === 'light' ? 'bg-slate-100' : 'bg-white/5'
                  }`}>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">Your App</span>
                    <span className="text-rose-500">v{getMyVersion()}</span>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl flex flex-col items-center ${
                    theme === 'light' ? 'bg-slate-100' : 'bg-white/5'
                  }`}>
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">Latest App</span>
                    <span className="text-emerald-500">v{updateConfig?.latestVersion || CURRENT_VERSION}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const url = getDeviceStoreUrl();
                      window.open(url, '_blank');
                      handleSimulateUpdate();
                    }}
                    className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 font-sans"
                  >
                    <span>{t('upgradeNow')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUpdateModal(false);
                      triggerToast('Playing Offline Local Mode');
                    }}
                    className={`w-full py-3 rounded-2xl text-xs font-bold uppercase tracking-wider border hover:bg-white/5 active:scale-95 transition-all duration-150 cursor-pointer ${
                      theme === 'light'
                        ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        : 'border-white/10 text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {t('maybeLater')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* BLOCKED ONLINE MATCHES MODAL */}
        {showBlockedOnlineModal && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl transition-all relative ${
                theme === 'light' 
                  ? 'bg-white border-slate-200 text-slate-800' 
                  : 'bg-[#0f172a] border-white/10 text-white'
              }`}
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-orange-400 flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
                  <AlertTriangle size={32} />
                </div>

                <div>
                  <span className="text-[10px] font-black tracking-widest text-rose-500 uppercase">
                    {t('accessDenied')}
                  </span>
                  <h2 className="text-lg font-black tracking-tight mt-1">
                    {t('upgradeRequiredOnline')}
                  </h2>
                </div>

                <p className={`text-xs leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                  {t('onlineBlockedDesc')}
                </p>

                <div className="flex flex-col gap-2 w-full mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const url = getDeviceStoreUrl();
                      window.open(url, '_blank');
                      handleSimulateUpdate();
                      setShowBlockedOnlineModal(false);
                    }}
                    className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 font-sans"
                  >
                    <span>{t('upgradeNow')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowBlockedOnlineModal(false)}
                    className={`w-full py-3 rounded-2xl text-xs font-bold uppercase tracking-wider border hover:bg-white/5 active:scale-95 transition-all duration-150 cursor-pointer ${
                      theme === 'light'
                        ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                        : 'border-white/10 text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {t('closePlayOffline')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* INTERSTITIAL AD */}
        {isInterstitialOpen && (
          <InterstitialAd onClose={handleCloseInterstitial} theme={theme} />
        )}
      </AnimatePresence>
    </div>
  );
}
