'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Database, ShieldCheck, Activity, BookOpen, FlaskConical, Laptop, Search } from 'lucide-react';

// ============================================================================
// 12 UNIQUE DIGIMON & POKÉMON-INSPIRED CYBER BOTS (30% Scaled Down: ~24px)
// ============================================================================
interface BotConfig {
  id: string;
  name: string;
  species: string;
  source: string;
  payloadText: string;
  renderSprite: () => React.ReactNode;
}

const BOT_SPECIES: BotConfig[] = [
  {
    id: 'volt-mon',
    name: 'Volt-Mon',
    species: 'Pikachu-inspired',
    source: 'TCGplayer',
    payloadText: '⚡ Raw Market Comp',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_6px_rgba(250,204,21,0.85)]" fill="none">
        <rect x="3" y="1" width="3" height="3" fill="#18181b" />
        <rect x="18" y="1" width="3" height="3" fill="#18181b" />
        <rect x="4" y="4" width="3" height="4" fill="#facc15" />
        <rect x="17" y="4" width="3" height="4" fill="#facc15" />
        <rect x="6" y="6" width="12" height="11" fill="#facc15" rx="1" />
        <rect x="8" y="5" width="8" height="2" fill="#fef08a" />
        <circle cx="6.5" cy="12.5" r="1.5" fill="#ef4444" />
        <circle cx="17.5" cy="12.5" r="1.5" fill="#ef4444" />
        <rect x="8" y="9" width="2" height="3" fill="#09090b" />
        <rect x="14" y="9" width="2" height="3" fill="#09090b" />
        <rect x="8" y="9" width="1" height="1" fill="#ffffff" />
        <rect x="14" y="9" width="1" height="1" fill="#ffffff" />
        <rect x="11.5" y="11.5" width="1" height="1" fill="#78350f" />
        <path d="M10 13Q12 14.5 14 13" stroke="#78350f" strokeWidth="0.8" fill="none" />
        <rect x="7" y="17" width="3" height="2" fill="#ca8a04" />
        <rect x="14" y="17" width="3" height="2" fill="#ca8a04" />
        <path d="M2 13L5 10L4 14L8 12" stroke="#eab308" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'dra-mon',
    name: 'Dra-Mon',
    species: 'Agumon-inspired',
    source: 'SNKRDUNK',
    payloadText: '🦖 PSA 10 (+RM 4.8k)',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_6px_rgba(249,115,22,0.85)]" fill="none">
        <rect x="4" y="2" width="2" height="3" fill="#fb923c" />
        <rect x="18" y="2" width="2" height="3" fill="#fb923c" />
        <rect x="5" y="4" width="14" height="12" fill="#f97316" rx="1" />
        <rect x="7" y="3" width="10" height="2" fill="#fdba74" />
        <rect x="7" y="7" width="3" height="3" fill="#065f46" />
        <rect x="14" y="7" width="3" height="3" fill="#065f46" />
        <rect x="7" y="7" width="1.5" height="1.5" fill="#34d399" />
        <rect x="14" y="7" width="1.5" height="1.5" fill="#34d399" />
        <rect x="8" y="11" width="8" height="4" fill="#fb923c" />
        <rect x="10" y="12" width="1" height="1" fill="#7c2d12" />
        <rect x="13" y="12" width="1" height="1" fill="#7c2d12" />
        <rect x="6" y="16" width="3" height="3" fill="#c2410c" />
        <rect x="15" y="16" width="3" height="3" fill="#c2410c" />
      </svg>
    ),
  },
  {
    id: 'shadow-byte',
    name: 'Shadow-Byte',
    species: 'Gengar-inspired',
    source: 'Yuyu-tei',
    payloadText: '👻 Secret Rare Comp',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_8px_rgba(168,85,247,0.9)]" fill="none">
        <path d="M4 5L7 8M12 3L12 7M20 5L17 8" stroke="#9333ea" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="12" cy="13" r="8" fill="#7e22ce" />
        <circle cx="12" cy="11" r="6.5" fill="#9333ea" />
        <polygon points="7,9 10,11 7,12" fill="#ef4444" />
        <polygon points="17,9 14,11 17,12" fill="#ef4444" />
        <path d="M7 14Q12 18 17 14" stroke="#f3e8ff" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="10" y="14" width="1.5" height="1.5" fill="#f3e8ff" />
        <rect x="12.5" y="14" width="1.5" height="1.5" fill="#f3e8ff" />
      </svg>
    ),
  },
  {
    id: 'v-byte',
    name: 'V-Byte',
    species: 'Veemon-inspired',
    source: 'PriceCharting',
    payloadText: '🐉 Manga Rare Mapped',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_6px_rgba(2,132,199,0.85)]" fill="none">
        <polygon points="12,1 10,5 14,5" fill="#e0f2fe" />
        <rect x="3" y="3" width="3" height="4" fill="#0284c7" />
        <rect x="18" y="3" width="3" height="4" fill="#0284c7" />
        <rect x="5" y="5" width="14" height="11" fill="#0284c7" rx="1.5" />
        <rect x="8" y="12" width="8" height="4" fill="#f0f9ff" rx="1" />
        <rect x="7" y="8" width="3" height="2.5" fill="#b91c1c" />
        <rect x="14" y="8" width="3" height="2.5" fill="#b91c1c" />
        <rect x="8" y="8" width="1" height="1" fill="#fecaca" />
        <rect x="15" y="8" width="1" height="1" fill="#fecaca" />
        <rect x="7" y="16" width="3" height="2.5" fill="#0369a1" />
        <rect x="14" y="16" width="3" height="2.5" fill="#0369a1" />
      </svg>
    ),
  },
  {
    id: 'pyro-mon',
    name: 'Pyro-Mon',
    species: 'Charmander-inspired',
    source: 'eBay Comps',
    payloadText: '🔥 1st Edition Sold',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_7px_rgba(234,88,12,0.85)]" fill="none">
        <circle cx="12" cy="11" r="7.5" fill="#ea580c" />
        <circle cx="12" cy="9" r="6" fill="#f97316" />
        <ellipse cx="12" cy="14" rx="4.5" ry="3.5" fill="#fef08a" />
        <ellipse cx="9" cy="9" rx="1.5" ry="2" fill="#0284c7" />
        <ellipse cx="15" cy="9" rx="1.5" ry="2" fill="#0284c7" />
        <circle cx="8.5" cy="8.5" r="0.8" fill="#ffffff" />
        <circle cx="14.5" cy="8.5" r="0.8" fill="#ffffff" />
        <circle cx="4" cy="14" r="2.5" fill="#facc15" className="animate-pulse" />
        <circle cx="3" cy="13" r="1.5" fill="#ef4444" />
        <rect x="7.5" y="17" width="2.5" height="2" fill="#c2410c" />
        <rect x="14" y="17" width="2.5" height="2" fill="#c2410c" />
      </svg>
    ),
  },
  {
    id: 'hazard-pup',
    name: 'Hazard-Pup',
    species: 'Guilmon-inspired',
    source: 'Alt Vault',
    payloadText: '⚠️ BGS 9.5 Verified',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_6px_rgba(220,38,38,0.85)]" fill="none">
        <rect x="2" y="3" width="3" height="6" fill="#dc2626" />
        <rect x="19" y="3" width="3" height="6" fill="#dc2626" />
        <rect x="3" y="4" width="1" height="4" fill="#450a0a" />
        <rect x="20" y="4" width="1" height="4" fill="#450a0a" />
        <rect x="5" y="5" width="14" height="11" fill="#dc2626" rx="1" />
        <rect x="7" y="8" width="2.5" height="2.5" fill="#eab308" />
        <rect x="14.5" y="8" width="2.5" height="2.5" fill="#eab308" />
        <rect x="8" y="8" width="1" height="2" fill="#18181b" />
        <rect x="15.5" y="8" width="1" height="2" fill="#18181b" />
        <polygon points="12,12 10.5,15 13.5,15" fill="#18181b" />
        <rect x="7" y="16" width="3" height="2" fill="#991b1b" />
        <rect x="14" y="16" width="3" height="2" fill="#991b1b" />
      </svg>
    ),
  },
  {
    id: 'psy-mew',
    name: 'Psy-Mew',
    species: 'Mew-inspired',
    source: 'Goldin',
    payloadText: '🔮 Auction Record Low',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_9px_rgba(244,114,182,0.9)]" fill="none">
        <polygon points="5,4 8,8 4,8" fill="#f472b6" />
        <polygon points="19,4 16,8 20,8" fill="#f472b6" />
        <polygon points="6,5 7.5,7.5 5,7.5" fill="#fdf2f8" />
        <polygon points="18,5 16.5,7.5 19,7.5" fill="#fdf2f8" />
        <circle cx="12" cy="11" r="6.5" fill="#f472b6" />
        <circle cx="12" cy="10" r="5" fill="#fbcfe8" />
        <ellipse cx="9.5" cy="10" rx="1.5" ry="2" fill="#06b6d4" />
        <ellipse cx="14.5" cy="10" rx="1.5" ry="2" fill="#06b6d4" />
        <circle cx="9" cy="9.5" r="0.6" fill="#ffffff" />
        <circle cx="14" cy="9.5" r="0.6" fill="#ffffff" />
        <path d="M12 17C9 21 4 19 3 15C2 12 5 10 7 12" stroke="#f472b6" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    id: 'frost-gaba',
    name: 'Frost-Gaba',
    species: 'Garurumon-inspired',
    source: 'Fanatics',
    payloadText: '🐺 Foil Alt Art Scraped',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_6px_rgba(56,189,248,0.85)]" fill="none">
        <polygon points="4,2 7,7 3,7" fill="#0284c7" />
        <polygon points="20,2 17,7 21,7" fill="#0284c7" />
        <rect x="5" y="6" width="14" height="10" fill="#f8fafc" rx="1" />
        <rect x="7" y="6" width="2" height="4" fill="#0284c7" />
        <rect x="15" y="6" width="2" height="4" fill="#0284c7" />
        <rect x="7" y="10" width="3" height="2" fill="#38bdf8" />
        <rect x="14" y="10" width="3" height="2" fill="#38bdf8" />
        <polygon points="12,12 11,14 13,14" fill="#0f172a" />
        <rect x="6.5" y="16" width="3" height="2.5" fill="#94a3b8" />
        <rect x="14.5" y="16" width="3" height="2.5" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    id: 'seed-bot',
    name: 'Seed-Bot',
    species: 'Bulbasaur-inspired',
    source: 'CardRush',
    payloadText: '🌿 Lowest Deck Print',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_6px_rgba(16,185,129,0.85)]" fill="none">
        <ellipse cx="12" cy="5" rx="4.5" ry="3.5" fill="#10b981" className="animate-pulse" />
        <ellipse cx="12" cy="4.5" rx="2.5" ry="2" fill="#6ee7b7" />
        <rect x="4" y="7" width="16" height="9" fill="#14b8a6" rx="2" />
        <rect x="5" y="8" width="3" height="2.5" fill="#0f766e" />
        <rect x="16" y="8" width="3" height="2.5" fill="#0f766e" />
        <ellipse cx="8" cy="11" rx="1.8" ry="2" fill="#dc2626" />
        <ellipse cx="16" cy="11" rx="1.8" ry="2" fill="#dc2626" />
        <circle cx="7.5" cy="10.5" r="0.7" fill="#ffffff" />
        <circle cx="15.5" cy="10.5" r="0.7" fill="#ffffff" />
        <rect x="5" y="16" width="3.5" height="2.5" fill="#0d9488" />
        <rect x="15.5" y="16" width="3.5" height="2.5" fill="#0d9488" />
      </svg>
    ),
  },
  {
    id: 'terri-bot',
    name: 'Terri-Bot',
    species: 'Terriermon-inspired',
    source: 'Card Ladder',
    payloadText: '🐰 Population 1/1 Comp',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]" fill="none">
        <polygon points="12,1 10.5,4 13.5,4" fill="#a7f3d0" />
        <path d="M5 6C1 8 0 16 3 17C5 17 6 12 7 9" fill="#34d399" />
        <path d="M19 6C23 8 24 16 21 17C19 17 18 12 17 9" fill="#34d399" />
        <circle cx="12" cy="10" r="6" fill="#fef9c3" />
        <circle cx="9.5" cy="9.5" r="1.5" fill="#1c1917" />
        <circle cx="14.5" cy="9.5" r="1.5" fill="#1c1917" />
        <circle cx="9.2" cy="9.2" r="0.5" fill="#ffffff" />
        <circle cx="14.2" cy="9.2" r="0.5" fill="#ffffff" />
        <path d="M11 12Q12 13 13 12" stroke="#78350f" strokeWidth="0.8" fill="none" />
        <rect x="9" y="16" width="2.5" height="2" fill="#fef08a" />
        <rect x="12.5" y="16" width="2.5" height="2" fill="#fef08a" />
      </svg>
    ),
  },
  {
    id: 'hydro-shell',
    name: 'Hydro-Shell',
    species: 'Squirtle-inspired',
    source: 'TCG Republic',
    payloadText: '🐢 CGC 10 Pristine',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_7px_rgba(6,182,212,0.85)]" fill="none">
        <circle cx="12" cy="10" r="6.5" fill="#06b6d4" />
        <polygon points="5,8 19,8 18,12 13,12 12,10 11,12 6,12" fill="#09090b" />
        <polygon points="6,9 11,9 10,11 6,11" fill="#27272a" />
        <polygon points="13,9 18,9 17,11 13,11" fill="#27272a" />
        <path d="M10 13Q12 14.5 14 13" stroke="#083344" strokeWidth="1" fill="none" />
        <rect x="8" y="14" width="8" height="3" fill="#fef08a" rx="1" />
        <rect x="7" y="16.5" width="3" height="2" fill="#0891b2" />
        <rect x="14" y="16.5" width="3" height="2" fill="#0891b2" />
      </svg>
    ),
  },
  {
    id: 'aero-pato',
    name: 'Aero-Pato',
    species: 'Patamon-inspired',
    source: 'Carousell',
    payloadText: '🦇 JP Booster Comp',
    renderSprite: () => (
      <svg viewBox="0 0 24 24" className="w-6 h-6 shape-pixel drop-shadow-[0_0_7px_rgba(245,158,11,0.85)]" fill="none">
        <path d="M6 9C1 6 0 13 4 15C6 14 6 11 7 10" fill="#f59e0b" />
        <path d="M18 9C23 6 24 13 20 15C18 14 18 11 17 10" fill="#f59e0b" />
        <circle cx="12" cy="11" r="6" fill="#fbbf24" />
        <circle cx="12" cy="12.5" r="4.5" fill="#fef3c7" />
        <circle cx="9.5" cy="10" r="1.5" fill="#1e3a8a" />
        <circle cx="14.5" cy="10" r="1.5" fill="#1e3a8a" />
        <circle cx="9.2" cy="9.6" r="0.5" fill="#ffffff" />
        <circle cx="14.2" cy="9.6" r="0.5" fill="#ffffff" />
        <path d="M11 13Q12 14 13 13" stroke="#78350f" strokeWidth="0.8" fill="none" />
        <circle cx="9" cy="17" r="1.2" fill="#d97706" />
        <circle cx="15" cy="17" r="1.2" fill="#d97706" />
      </svg>
    ),
  },
];

const REACTION_EMOJIS = [
  { emoji: '❤️', label: 'love' },
  { emoji: '✨', label: 'sparkle' },
  { emoji: '🎉', label: 'celebrate' },
  { emoji: '😎', label: 'cool' },
  { emoji: '🔥', label: 'fire' },
  { emoji: '🤝', label: 'partner' },
  { emoji: '⚡', label: 'clash' },
  { emoji: '❓', label: 'question' },
  { emoji: '🤔', label: 'thinking' },
  { emoji: '...', label: 'dots' },
];

// ============================================================================
// 4 PERIMETER RESEARCH STATIONS
// ============================================================================
interface ResearchStation {
  id: string;
  name: string;
  icon: any;
  px: number;
  py: number;
  studyPrompts: string[];
}

const RESEARCH_STATIONS: ResearchStation[] = [
  {
    id: 'archives',
    name: 'TCG Archives',
    icon: BookOpen,
    px: 0.16,
    py: 0.16,
    studyPrompts: ['📖 Reading Lore...', '📜 Vintage Sets', '📚 Price Guides', '📖 Set History'],
  },
  {
    id: 'terminal',
    name: 'Quantum Terminal',
    icon: Laptop,
    px: 0.84,
    py: 0.16,
    studyPrompts: ['💻 Crawling API...', '⚡ Algolia Index', '💻 Parsing Sales', '⚡ Syncing Nodes'],
  },
  {
    id: 'chemistry',
    name: 'Foil Analysis Lab',
    icon: FlaskConical,
    px: 0.16,
    py: 0.84,
    studyPrompts: ['🧪 Testing Foil...', '🔬 Holo Check', '🧪 Texture Scan', '✨ Foil Quality'],
  },
  {
    id: 'appraisal',
    name: 'Grading Station',
    icon: Search,
    px: 0.84,
    py: 0.84,
    studyPrompts: ['🔍 Centering 50/50', '📐 Edge Calipers', '💎 Gem Mint 10?', '🔍 Surface Check'],
  },
];

interface BotState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  state: 'studying' | 'carrying' | 'depositing' | 'walking_to_station' | 'interacting';
  timer: number;
  stationIndex: number;
  speechBubble: string | null;
  bubbleType?: 'card' | 'emoji' | 'study';
  cooldown: number;
}

export function ScraperCommandCenter() {
  const arenaRef = useRef<HTMLDivElement>(null);
  const [activeCompsCount, setActiveCompsCount] = useState(148920);
  const [glowWaveRings, setGlowWaveRings] = useState<{ id: number; key: number }[]>([]);
  const [botRenderList, setBotRenderList] = useState<BotState[]>([]);

  const botsRef = useRef<BotState[]>([]);
  const animFrameRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);
  const waveIdRef = useRef<number>(0);

  // Initialize bot positions distributed around the 4 research stations (Scaled down)
  useEffect(() => {
    const initialBots: BotState[] = BOT_SPECIES.map((_, i) => {
      const stationIdx = i % RESEARCH_STATIONS.length;
      const station = RESEARCH_STATIONS[stationIdx];
      // Arena size scaled down to ~360px
      const initX = 28 + station.px * 300 + (Math.random() - 0.5) * 40;
      const initY = 28 + station.py * 300 + (Math.random() - 0.5) * 40;

      return {
        x: initX,
        y: initY,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        facing: Math.random() > 0.5 ? 1 : -1,
        state: 'studying',
        timer: Math.random() * 80,
        stationIndex: stationIdx,
        speechBubble: station.studyPrompts[i % station.studyPrompts.length],
        bubbleType: 'study',
        cooldown: 200 + Math.random() * 240,
      };
    });

    botsRef.current = initialBots;
    setBotRenderList([...initialBots]);

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );

    if (arenaRef.current) {
      observer.observe(arenaRef.current);
    }

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Main 60 FPS Anti-Clumping Boids + Calm Movement State Machine
  useEffect(() => {
    let lastTime = performance.now();
    let renderThrottle = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (isVisibleRef.current && arenaRef.current) {
        const size = arenaRef.current.clientWidth || 360;
        const W = size;
        const H = size;
        
        const coreCenterX = W / 2;
        const coreCenterY = H / 2;
        const bots = botsRef.current;

        // Step 1: Mutual Separation Physics (Scaled down for smaller 24px bots)
        for (let i = 0; i < bots.length; i++) {
          const b1 = bots[i];
          if (b1.state === 'interacting') continue;

          for (let j = i + 1; j < bots.length; j++) {
            const b2 = bots[j];
            if (b2.state === 'interacting') continue;

            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const distSq = dx * dx + dy * dy;

            // Separation force if closer than 34px
            if (distSq < 1156 && distSq > 0.01) {
              const dist = Math.sqrt(distSq);
              const force = (34 - dist) / 34 * 0.5;
              const nx = dx / dist;
              const ny = dy / dist;

              b1.vx -= nx * force;
              b1.vy -= ny * force;
              b2.vx += nx * force;
              b2.vy += ny * force;

              // Friendly peer-to-peer greeting
              if (dist < 26 && b1.cooldown <= 0 && b2.cooldown <= 0 && Math.random() < 0.03) {
                b1.state = 'interacting';
                b2.state = 'interacting';
                b1.timer = 0;
                b2.timer = 0;
                b1.facing = dx > 0 ? 1 : -1;
                b2.facing = dx > 0 ? -1 : 1;

                const e1 = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
                const e2 = REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
                b1.speechBubble = e1.emoji;
                b1.bubbleType = 'emoji';
                b2.speechBubble = e2.emoji;
                b2.bubbleType = 'emoji';
              }
            }
          }
        }

        // Step 2: Calm Bot Behavior Loop
        for (let i = 0; i < bots.length; i++) {
          const bot = bots[i];
          bot.timer += dt * 60;
          if (bot.cooldown > 0) bot.cooldown -= dt * 60;

          // ------------------------------------------------------------------
          // STATE: INTERACTING (Social Emoji Encounter)
          // ------------------------------------------------------------------
          if (bot.state === 'interacting') {
            if (bot.timer > 100) { // ~1.6s
              bot.state = 'walking_to_station';
              bot.speechBubble = null;
              bot.cooldown = 450 + Math.random() * 300;
              bot.stationIndex = (bot.stationIndex + 1 + Math.floor(Math.random() * 2)) % RESEARCH_STATIONS.length;
            }
            continue;
          }

          // ------------------------------------------------------------------
          // STATE: STUDYING (Dwelling at Research Station looking busy & calm)
          // ------------------------------------------------------------------
          if (bot.state === 'studying') {
            const station = RESEARCH_STATIONS[bot.stationIndex];
            const targetX = station.px * W;
            const targetY = station.py * H;

            // Gentle anchor toward station workbench
            bot.vx += (targetX - bot.x) * 0.008;
            bot.vy += (targetY - bot.y) * 0.008;
            bot.vx *= 0.85;
            bot.vy *= 0.85;

            bot.x += bot.vx;
            bot.y += bot.vy;
            bot.facing = targetX >= bot.x ? 1 : -1;

            // Relaxed dwell for ~2.2s to 2.8s (135 - 170 frames)
            if (bot.timer > 140 + (i % 4) * 15) {
              bot.state = 'carrying';
              bot.timer = 0;
              bot.speechBubble = BOT_SPECIES[i].payloadText;
              bot.bubbleType = 'card';
            }
          }

          // ------------------------------------------------------------------
          // STATE: CARRYING (Walking studied comp to the Central Core - Slower)
          // ------------------------------------------------------------------
          else if (bot.state === 'carrying') {
            const dx = coreCenterX - bot.x;
            const dy = (coreCenterY + 12) - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 26) {
              // Calm, methodical walking speed (~0.72)
              const speed = 0.72;
              bot.vx = (dx / dist) * speed;
              bot.vy = (dy / dist) * speed;
              bot.x += bot.vx;
              bot.y += bot.vy;
              bot.facing = bot.vx >= 0 ? 1 : -1;
            } else {
              // Reached the Core! Dwell at core base for ~1 second
              bot.state = 'depositing';
              bot.timer = 0;
              bot.speechBubble = '✓ Ingested';
              bot.bubbleType = 'card';

              // Emit warm amber-gold wave pulse from the incubator core
              waveIdRef.current += 1;
              const newWaveId = waveIdRef.current;
              setGlowWaveRings(prev => [...prev.slice(-2), { id: newWaveId, key: Date.now() }]);
              setActiveCompsCount(c => c + 1);

              setTimeout(() => {
                setGlowWaveRings(prev => prev.filter(w => w.id !== newWaveId));
              }, 1400);
            }
          }

          // ------------------------------------------------------------------
          // STATE: DEPOSITING (Dwelling at Core for ~0.9s)
          // ------------------------------------------------------------------
          else if (bot.state === 'depositing') {
            bot.vx *= 0.8;
            bot.vy *= 0.8;
            bot.x += bot.vx;
            bot.y += bot.vy;

            // Pause for ~0.9s (55 frames) while depositing data
            if (bot.timer > 55) {
              bot.state = 'walking_to_station';
              bot.timer = 0;
              bot.speechBubble = null;
              bot.stationIndex = (bot.stationIndex + 1 + Math.floor(Math.random() * 3)) % RESEARCH_STATIONS.length;
            }
          }

          // ------------------------------------------------------------------
          // STATE: WALKING TO STATION (Journeying to next study desk - Slower)
          // ------------------------------------------------------------------
          else if (bot.state === 'walking_to_station') {
            const station = RESEARCH_STATIONS[bot.stationIndex];
            const targetX = station.px * W;
            const targetY = station.py * H;

            const dx = targetX - bot.x;
            const dy = targetY - bot.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Avoid bumping into the core cylinder
            const toCoreX = bot.x - coreCenterX;
            const toCoreY = bot.y - coreCenterY;
            const coreDistSq = toCoreX * toCoreX + toCoreY * toCoreY;
            if (coreDistSq < 2200) {
              const coreDist = Math.sqrt(coreDistSq) || 1;
              bot.vx += (toCoreX / coreDist) * 0.6;
              bot.vy += (toCoreY / coreDist) * 0.6;
            }

            if (dist > 22) {
              // Smooth, relaxed travel speed (~0.62)
              const speed = 0.62;
              bot.vx = (dx / dist) * speed;
              bot.vy = (dy / dist) * speed;
              bot.x += bot.vx;
              bot.y += bot.vy;
              bot.facing = bot.vx >= 0 ? 1 : -1;
            } else {
              // Arrived at the research station! Begin studying
              bot.state = 'studying';
              bot.timer = 0;
              const prompts = station.studyPrompts;
              bot.speechBubble = prompts[Math.floor(Math.random() * prompts.length)];
              bot.bubbleType = 'study';
            }
          }

          // Soft Boundary Protection
          const pad = 20;
          if (bot.x < pad) { bot.x = pad; bot.vx = Math.abs(bot.vx) * 0.8; }
          if (bot.x > W - pad) { bot.x = W - pad; bot.vx = -Math.abs(bot.vx) * 0.8; }
          if (bot.y < pad) { bot.y = pad; bot.vy = Math.abs(bot.vy) * 0.8; }
          if (bot.y > H - pad) { bot.y = H - pad; bot.vy = -Math.abs(bot.vy) * 0.8; }
        }

        renderThrottle++;
        if (renderThrottle % 2 === 0) {
          setBotRenderList([...bots]);
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleBotClick = (index: number) => {
    const bot = botsRef.current[index];
    if (!bot) return;
    bot.state = 'interacting';
    bot.timer = 0;
    const happyPick = ['❤️', '⭐', '✨', '🥰', '🔥'][Math.floor(Math.random() * 5)];
    bot.speechBubble = happyPick;
    bot.bubbleType = 'emoji';
  };

  return (
    <div className="relative w-full">
      {/* ==================================================================== */}
      {/* 1. AMBIENT THEMED GRADIENT GLOW UNDERLAY (Behind the Frosted Glass)  */}
      {/* Matching user reference: Magenta/Purple -> Warm Amber -> Luminous Cyan */}
      {/* ==================================================================== */}
      <div className="absolute inset-0 -inset-x-4 -inset-y-4 pointer-events-none overflow-hidden rounded-[40px] opacity-70 sm:opacity-85">
        {/* Left Orb: Deep Magenta & Purple (Riftbound / Vintage) */}
        <div className="absolute top-1/2 -translate-y-1/2 -left-12 w-[340px] h-[340px] rounded-full bg-gradient-to-tr from-purple-600/35 via-fuchsia-600/25 to-transparent blur-[110px]" />
        
        {/* Center Orb: Signature Electric Orange & Amber (TCG Master Brand Accent) */}
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[400px] h-[320px] rounded-full bg-gradient-to-r from-orange-500/30 via-amber-500/25 to-yellow-500/20 blur-[120px]" />
        
        {/* Right Orb: Cyber Cyan & Luminous Gold (Scouting Arena) */}
        <div className="absolute top-1/2 -translate-y-1/2 -right-12 w-[360px] h-[360px] rounded-full bg-gradient-to-bl from-cyan-400/25 via-amber-400/20 to-transparent blur-[110px]" />
      </div>

      {/* ==================================================================== */}
      {/* 2. UNIFIED FROSTED GLASS RECTANGULAR CONTAINER                       */}
      {/* ==================================================================== */}
      <div className="relative rounded-3xl sm:rounded-[36px] border border-white/10 bg-[#060c18]/50 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] p-6 sm:p-8 lg:p-10 overflow-hidden">
        {/* Subtle interior sheen along the top border */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* ==================================================================== */}
      {/* LEFT COLUMN: UNBOXED TYPOGRAPHY (Branded Orange/Amber & Dark Navy)    */}
      {/* ==================================================================== */}
      <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
        <div>
          {/* Main Unboxed Title matching Hero Orange/Amber Gradient */}
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400">TCG Master Core</span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 mt-3 leading-relaxed">
            Real-time autonomous intelligence agents scouting global card comp transactions, inspecting vintage archives, verifying foil authenticity, and feeding live price comps into the canonical vault.
          </p>
        </div>

        {/* Live Vault Comps Metric Pill & Integrity Badges (Themed to Orange & Cyan) */}
        <div className="space-y-3 pt-1">
          <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-orange-500/25 bg-orange-950/20 backdrop-blur-md">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Database className="w-4 h-4 text-orange-400 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Vault Comps Ingested</div>
              <div className="text-xl font-mono font-black text-white">
                {activeCompsCount.toLocaleString()}
              </div>
            </div>
            <span className="ml-2 text-[10px] font-mono font-bold text-orange-400 bg-orange-950/60 px-2 py-0.5 rounded-full border border-orange-500/30">
              LIVE +1
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              <span>100% Verified Comps</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>11ms Sync Pipeline</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* RIGHT COLUMN: 30% SMALLER SEAMLESS ARENA WITH 4-EDGE FADE MASK       */}
      {/* ==================================================================== */}
      <div className="lg:col-span-6 flex justify-center w-full">
        <div 
          ref={arenaRef}
          className="relative w-full max-w-[360px] sm:max-w-[380px] aspect-square overflow-hidden select-none"
          style={{
            // Seamless radial fade into the website background on all edges
            background: 'radial-gradient(circle at center, rgba(249, 115, 22, 0.04) 0%, rgba(6, 12, 24, 0.4) 60%, transparent 100%)',
            maskImage: 'radial-gradient(circle at center, black 50%, rgba(0,0,0,0.6) 75%, transparent 98%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 50%, rgba(0,0,0,0.6) 75%, transparent 98%)',
          }}
        >
          {/* Subtle Cyber Floor Grid (Seamlessly blended, no outer box border) */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

          {/* ================================================================ */}
          {/* 4-SIDED RESEARCH STATIONS (30% Scaled Down Equipment)           */}
          {/* ================================================================ */}
          
          {/* 1. TOP-LEFT: GRAND TCG ARCHIVES & BOOKSHELF 📚 */}
          <div className="absolute top-2 left-2 z-10 flex flex-col items-center pointer-events-none">
            <div className="text-[7px] font-mono font-bold text-amber-400/90 bg-black/60 px-1 py-0.2 rounded border border-amber-500/30 mb-0.5">
              ARCHIVES
            </div>
            {/* Scaled Bookshelf SVG */}
            <svg viewBox="0 0 50 42" className="w-9 h-8 sm:w-10 sm:h-9 shape-pixel drop-shadow-[0_0_6px_rgba(245,158,11,0.25)]" fill="none">
              <rect x="2" y="2" width="46" height="38" fill="#291a10" stroke="#5c3820" strokeWidth="2" rx="1" />
              <rect x="5" y="19" width="40" height="2" fill="#5c3820" />
              <rect x="6" y="6" width="4" height="13" fill="#dc2626" />
              <rect x="11" y="8" width="5" height="11" fill="#2563eb" />
              <rect x="17" y="5" width="4" height="14" fill="#f59e0b" />
              <rect x="22" y="7" width="6" height="12" fill="#d97706" />
              <rect x="29" y="9" width="4" height="10" fill="#9333ea" />
              <rect x="34" y="6" width="5" height="13" fill="#e11d48" />
              <rect x="40" y="8" width="4" height="11" fill="#0284c7" />
              <rect x="6" y="23" width="7" height="14" fill="#ca8a04" />
              <rect x="14" y="24" width="5" height="13" fill="#0284c7" />
              <rect x="20" y="22" width="6" height="15" fill="#eab308" />
              <rect x="27" y="25" width="8" height="12" fill="#475569" />
              <rect x="36" y="23" width="8" height="14" fill="#b91c1c" />
            </svg>
          </div>

          {/* 2. TOP-RIGHT: QUANTUM TERMINAL & SUPERCOMPUTER 💻 */}
          <div className="absolute top-2 right-2 z-10 flex flex-col items-center pointer-events-none">
            <div className="text-[7px] font-mono font-bold text-cyan-300/90 bg-black/60 px-1 py-0.2 rounded border border-cyan-500/30 mb-0.5">
              TERMINAL
            </div>
            {/* Scaled Cyber Terminal SVG */}
            <svg viewBox="0 0 50 42" className="w-9 h-8 sm:w-10 sm:h-9 shape-pixel drop-shadow-[0_0_6px_rgba(6,182,212,0.3)]" fill="none">
              <rect x="14" y="4" width="24" height="18" fill="#082f49" stroke="#0284c7" strokeWidth="1.5" rx="1" />
              <path d="M16 13H20L22 9L25 17L28 11L30 14H36" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" />
              <rect x="24" y="22" width="4" height="6" fill="#334155" />
              <rect x="18" y="28" width="16" height="2" fill="#475569" />
              <rect x="3" y="10" width="9" height="20" fill="#0f172a" stroke="#1e293b" strokeWidth="1" />
              <circle cx="7.5" cy="14" r="1" fill="#f59e0b" className="animate-pulse" />
              <circle cx="7.5" cy="18" r="1" fill="#38bdf8" />
              <circle cx="7.5" cy="22" r="1" fill="#f97316" />
              <rect x="16" y="32" width="20" height="4" fill="#1e293b" />
              <rect x="18" y="33" width="16" height="2" fill="#64748b" />
            </svg>
          </div>

          {/* 3. BOTTOM-LEFT: ALCHEMICAL FOIL LAB BENCH 🔬 */}
          <div className="absolute bottom-2 left-2 z-10 flex flex-col items-center pointer-events-none">
            <svg viewBox="0 0 50 42" className="w-9 h-8 sm:w-10 sm:h-9 shape-pixel drop-shadow-[0_0_6px_rgba(249,115,22,0.3)]" fill="none">
              <rect x="4" y="26" width="42" height="4" fill="#334155" />
              <rect x="8" y="30" width="3" height="10" fill="#1e293b" />
              <rect x="39" y="30" width="3" height="10" fill="#1e293b" />
              <polygon points="12,26 8,16 16,16" fill="#7c2d12" stroke="#ea580c" strokeWidth="1" />
              <rect x="11" y="12" width="2" height="4" fill="#f97316" />
              <circle cx="12" cy="22" r="1.5" fill="#fde047" className="animate-pulse" />
              <circle cx="26" cy="21" r="5" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
              <rect x="25" y="13" width="2" height="4" fill="#d97706" />
              <rect x="34" y="18" width="10" height="8" fill="#1e293b" />
              <rect x="36" y="15" width="2" height="8" fill="#38bdf8" />
              <rect x="40" y="15" width="2" height="8" fill="#fb923c" />
            </svg>
            <div className="text-[7px] font-mono font-bold text-orange-400/90 bg-black/60 px-1 py-0.2 rounded border border-orange-500/30 mt-0.5">
              FOIL LAB
            </div>
          </div>

          {/* 4. BOTTOM-RIGHT: PSA / BGS APPRAISAL & GRADING DESK 📐 */}
          <div className="absolute bottom-2 right-2 z-10 flex flex-col items-center pointer-events-none">
            <svg viewBox="0 0 50 42" className="w-9 h-8 sm:w-10 sm:h-9 shape-pixel drop-shadow-[0_0_6px_rgba(168,85,247,0.3)]" fill="none">
              <rect x="4" y="26" width="42" height="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              <rect x="8" y="30" width="3" height="10" fill="#0f172a" />
              <rect x="39" y="30" width="3" height="10" fill="#0f172a" />
              <rect x="18" y="21" width="14" height="9" fill="#09090b" stroke="#38bdf8" strokeWidth="0.8" />
              <rect x="21" y="23" width="8" height="5" fill="#facc15" opacity="0.8" />
              <path d="M12 26L10 14L16 10" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="17" cy="9" r="4" fill="#38bdf8" opacity="0.5" />
              <path d="M35 22L41 18" stroke="#cbd5e1" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <div className="text-[7px] font-mono font-bold text-purple-300/90 bg-black/60 px-1 py-0.2 rounded border border-purple-500/30 mt-0.5">
              GRADING
            </div>
          </div>

          {/* ================================================================ */}
          {/* THE TCG MASTER CORE (Brand-Themed Amber Energy Matrix Tube)      */}
          {/* ================================================================ */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none">
            {/* Floating Plate Header (Amber Glow) */}
            <div className="mb-1 px-2 py-0.5 rounded bg-zinc-950/95 border border-orange-500/40 text-[8px] font-mono font-black text-amber-300 shadow-[0_0_10px_rgba(249,115,22,0.3)] tracking-wider">
              TCG MASTER CORE
            </div>

            {/* 30% Scaled Down Industrial Amber Incubator Tube */}
            <div className="relative w-14 h-26 sm:w-16 sm:h-28 flex items-center justify-center">
              {/* Expanding Golden-Amber Glow Wave Ring */}
              {glowWaveRings.map(ring => (
                <div 
                  key={ring.key}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 bg-orange-500/20 animate-glow-wave pointer-events-none"
                />
              ))}

              <svg viewBox="0 0 100 160" className="w-full h-full shape-pixel drop-shadow-[0_0_16px_rgba(249,115,22,0.4)]" fill="none">
                {/* Overhead Industrial Piping */}
                <rect x="44" y="0" width="12" height="18" fill="#1e293b" />
                <rect x="40" y="8" width="20" height="4" fill="#334155" />
                <rect x="20" y="4" width="24" height="4" fill="#1e293b" />
                <rect x="56" y="4" width="24" height="4" fill="#1e293b" />

                {/* Steel Top Cap Collar */}
                <path d="M26 18H74L70 28H30L26 18Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <rect x="34" y="24" width="32" height="5" fill="#0f172a" />
                <circle cx="32" cy="22" r="1.5" fill="#64748b" />
                <circle cx="50" cy="22" r="1.5" fill="#64748b" />
                <circle cx="68" cy="22" r="1.5" fill="#64748b" />

                {/* Amber Energy Plasma Tube Body */}
                <rect x="30" y="29" width="40" height="85" fill="#451a03" stroke="#ea580c" strokeWidth="1" rx="2" />
                <rect x="32" y="34" width="36" height="78" fill="url(#amberPlasma)" opacity="0.95" />

                {/* Golden Embers & Ascension Particles */}
                <circle cx="48" cy="98" r="3" fill="#fef08a" className="animate-pulse" />
                <circle cx="56" cy="85" r="2.5" fill="#fde047" />
                <circle cx="42" cy="72" r="2" fill="#fb923c" />
                <circle cx="52" cy="60" r="3.5" fill="#f59e0b" className="animate-pulse" />
                <circle cx="45" cy="46" r="2" fill="#fef08a" />
                <circle cx="58" cy="42" r="1.5" fill="#ffffff" />
                <circle cx="38" cy="88" r="1.8" fill="#fb923c" />

                {/* Glass Highlights */}
                <rect x="33" y="32" width="3" height="78" fill="#ffffff" opacity="0.3" rx="1" />
                <rect x="38" y="32" width="1.5" height="78" fill="#ffffff" opacity="0.15" />

                {/* Heavy Tiered Base */}
                <path d="M28 114H72L78 126H22L28 114Z" fill="#1e293b" stroke="#334155" strokeWidth="1.5" />
                <path d="M18 126H82L86 138H14L18 126Z" fill="#0f172a" stroke="#1e293b" strokeWidth="1.5" />
                
                {/* Status LED Indicators */}
                <circle cx="45" cy="132" r="2.5" fill="#ef4444" />
                <circle cx="55" cy="132" r="2.5" fill="#f59e0b" className="animate-pulse" />

                {/* Floor Energy Specks */}
                <rect x="22" y="142" width="4" height="2" fill="#f59e0b" opacity="0.8" />
                <rect x="32" y="144" width="6" height="2" fill="#f97316" opacity="0.9" />
                <rect x="64" y="143" width="8" height="2" fill="#f59e0b" opacity="0.8" />
                <rect x="76" y="141" width="3" height="2" fill="#fef08a" opacity="0.7" />

                <defs>
                  <linearGradient id="amberPlasma" x1="50" y1="112" x2="50" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#9a3412" />
                    <stop offset="0.35" stopColor="#ea580c" />
                    <stop offset="0.75" stopColor="#f59e0b" />
                    <stop offset="1" stopColor="#fde047" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>

          {/* ================================================================ */}
          {/* THE 12 CYBER RESEARCH BOTS (Compact 24px Size)                   */}
          {/* ================================================================ */}
          <div className="absolute inset-0 pointer-events-none">
            {botRenderList.map((bot, index) => {
              const species = BOT_SPECIES[index];
              if (!species) return null;

              return (
                <div
                  key={species.id}
                  onClick={() => handleBotClick(index)}
                  style={{
                    transform: `translate3d(${bot.x}px, ${bot.y}px, 0)`,
                    willChange: 'transform',
                    zIndex: Math.floor(bot.y + 100),
                  }}
                  className="absolute top-0 left-0 pointer-events-auto cursor-pointer group flex flex-col items-center transition-transform duration-75"
                >
                  {/* Speech / Study / Reaction Bubble (Themed to Dark Glass & Orange/Gold) */}
                  {bot.speechBubble && (
                    <div className="absolute -top-6 whitespace-nowrap animate-bounce z-30 pointer-events-none">
                      {bot.bubbleType === 'emoji' ? (
                        <div className="px-1.5 py-0.5 rounded-full bg-black/95 border border-amber-400/80 text-xs shadow-[0_0_10px_rgba(251,191,36,0.5)] flex items-center justify-center">
                          <span>{bot.speechBubble}</span>
                        </div>
                      ) : bot.bubbleType === 'study' ? (
                        <div className="px-1.5 py-0.5 rounded bg-zinc-950/95 border border-cyan-400/50 text-[8px] font-mono font-bold text-cyan-200 shadow-[0_0_6px_rgba(6,182,212,0.3)] flex items-center gap-1">
                          {bot.speechBubble}
                        </div>
                      ) : (
                        <div className="px-1.5 py-0.5 rounded bg-black/95 border border-orange-400/80 text-[8px] font-mono font-black text-amber-300 shadow-[0_0_8px_rgba(249,115,22,0.4)] flex items-center gap-1">
                          <Sparkles className="w-2 h-2 text-yellow-400" />
                          {bot.speechBubble}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Character Sprite (30% Smaller, 24px) */}
                  <div 
                    style={{
                      transform: `scaleX(${bot.facing})`,
                      transition: 'transform 0.15s ease',
                    }}
                    className="relative group-hover:scale-110 transition-transform"
                  >
                    {species.renderSprite()}
                    <div className="w-4 h-1 rounded-full bg-black/50 blur-[1px] mx-auto mt-0.5" />
                  </div>

                  {/* Micro Hover Tag */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-3.5 text-[7px] font-mono font-bold text-zinc-300 bg-zinc-950/90 px-1 py-0.2 rounded border border-white/10 whitespace-nowrap pointer-events-none z-40">
                    {species.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </div>

      {/* Hardware-Accelerated CSS */}
      <style jsx global>{`
        .shape-pixel {
          shape-rendering: crispEdges;
          image-rendering: pixelated;
        }
        @keyframes glowWave {
          0% {
            width: 20px;
            height: 20px;
            opacity: 0.9;
          }
          100% {
            width: 170px;
            height: 170px;
            opacity: 0;
          }
        }
        .animate-glow-wave {
          animation: glowWave 1.3s cubic-bezier(0.1, 0.7, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
}
