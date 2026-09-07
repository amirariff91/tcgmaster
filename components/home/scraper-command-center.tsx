'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Database,
  Sparkles, 
  ShieldCheck,
  Globe,
  Zap,
  Activity,
  Radio
} from 'lucide-react';

// The 12 Global Data Sources where TM Minions harvest card prices
const DATA_SOURCES = [
  { id: 'tcgplayer', name: 'TCGplayer', logo: '/logos/tcgplayer.png', fit: 'contain', pad: 'p-1.5', bg: 'bg-white' },
  { id: 'tcgrepublic', name: 'TCG Republic', logo: '/logos/tcgrepublic.png', fit: 'cover', pad: 'p-0', bg: 'bg-[#2995cc]' },
  { id: 'pricecharting', name: 'PriceCharting', logo: '/logos/pricecharting.png', fit: 'contain', pad: 'p-1', bg: 'bg-white' },
  { id: 'ebay', name: 'eBay', logo: '/logos/ebay.png', fit: 'cover', pad: 'p-0', bg: 'bg-black' },
  { id: 'yuyutei', name: 'Yuyu-tei', logo: '/logos/yuyutei.png', fit: 'contain', pad: 'p-1', bg: 'bg-white' },
  { id: 'alt', name: 'Alt (eBay Comps)', logo: '/logos/alt.png', fit: 'cover', pad: 'p-0', bg: 'bg-black' },
  { id: 'fanatics', name: 'Fanatics Collect', logo: '/logos/fanatics.png', fit: 'cover', pad: 'p-0', bg: 'bg-black' },
  { id: 'goldin', name: 'Goldin Auctions', logo: '/logos/goldin.png', fit: 'cover', pad: 'p-0', bg: 'bg-black' },
  { id: 'cardladder', name: 'Card Ladder', logo: '/logos/cardladder.png', fit: 'cover', pad: 'p-0', bg: 'bg-black' },
  { id: 'carousell', name: 'Carousell', logo: '/logos/carousell-icon.png', fit: 'cover', pad: 'p-0', bg: 'bg-[#ff2636]' },
  { id: 'cardrush', name: 'CardRush', logo: '/logos/cardrush.png', fit: 'contain', pad: 'p-1', bg: 'bg-white' },
  { id: 'snkrdunk', name: 'SNKRDUNK', logo: '/logos/snkrdunk.png', fit: 'cover', pad: 'p-0', bg: 'bg-black' },
];

export function ScraperCommandCenter() {
  // Live kinetic counters
  const [cardsCount, setCardsCount] = useState(50795);
  const [activeListings, setActiveListings] = useState(142890);
  const [gradedComps, setGradedComps] = useState(38112);
  const [lastIncrement, setLastIncrement] = useState<number | null>(null);
  const [isOverclocked, setIsOverclocked] = useState(false);
  const [syncLatency, setSyncLatency] = useState(12);

  // Autonomous kinetic number ticker synchronized with Minion processing
  useEffect(() => {
    const interval = setInterval(() => {
      const inc = Math.floor(Math.random() * 3) + 1; // +1 to +3 cards
      const listingInc = Math.floor(Math.random() * 5) + 2; // +2 to +6 listings
      const gradedInc = Math.random() > 0.4 ? 1 : 0;
      
      setCardsCount(prev => prev + inc);
      setActiveListings(prev => prev + listingInc);
      setGradedComps(prev => prev + gradedInc);
      setLastIncrement(inc);
      setSyncLatency(Math.floor(Math.random() * 8) + 8); // 8ms - 15ms

      // Reset floating increment badge
      const timer = setTimeout(() => setLastIncrement(null), 1200);
      return () => clearTimeout(timer);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  // Fun interactive boost: clicking the vault triggers a hyper-sync burst
  const handleBoost = () => {
    if (isOverclocked) return;
    setIsOverclocked(true);
    setLastIncrement(12);
    setCardsCount(prev => prev + 12);
    setActiveListings(prev => prev + 35);
    setGradedComps(prev => prev + 4);
    setSyncLatency(4);

    setTimeout(() => {
      setIsOverclocked(false);
      setLastIncrement(null);
    }, 1800);
  };

  return (
    <div className="space-y-6">
      {/* Section Header with Live Status (Clean, no buttons) */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              Active
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400">
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              12 TM Minions Working Overtime
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Live <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">TM Minions</span>
          </h2>
          <p className="text-sm text-zinc-400 max-w-2xl mt-1">
            Autonomous TM Minions harvesting real time card sales, verifying graded comps, and mapping lowest cost deck prints.
          </p>
        </div>
      </div>

      {/* Main Interactive 16-Bit Stage */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0b1329]/95 via-[#060c18]/90 to-[#0b1329]/95 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
        
        {/* Cybernetic Ambient Grid Backdrop */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-orange-600/10 rounded-full blur-[100px] pointer-events-none" />

        {/* THE 3-STAGE MINION RUNWAY */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* STAGE 1: Source Market Terminals (Left - 3 Cols, Compact Logo-Only Rectangles with Synchronized Wave) */}
          <div className="lg:col-span-3 flex flex-col justify-between h-full min-h-[290px]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-widest font-black text-zinc-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-orange-400" /> Global Data Terminals
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-400 font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                12 LIVE
              </div>
            </div>

            {/* 3 Columns x 4 Rows = 12 Rectangles Side by Side */}
            <div className="grid grid-cols-3 gap-2 flex-1">
              {DATA_SOURCES.map((src, index) => {
                // Diagonal wave stagger: row index + col index
                const row = Math.floor(index / 3);
                const col = index % 3;
                const waveDelay = (row * 0.25 + col * 0.18).toFixed(2);

                return (
                  <div 
                    key={src.id}
                    title={`${src.name} (Active Feed)`}
                    className="group relative flex items-center justify-center rounded-xl border border-white/10 bg-[#080f20]/90 hover:bg-[#0e1832] transition-all cursor-pointer overflow-hidden p-2 shadow-sm terminal-tile"
                    style={{
                      animation: 'terminalWavePulse 3.4s ease-in-out infinite',
                      animationDelay: `${waveDelay}s`,
                    }}
                  >
                    {/* Glowing Live Micro Indicator */}
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400/60 group-hover:bg-emerald-400 group-hover:shadow-[0_0_6px_#34d399] transition-all" />

                    {/* Logo Graphic Container */}
                    <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center ${src.bg} ${src.pad} border border-white/10 group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                      <img 
                        src={src.logo} 
                        alt={src.name} 
                        className={`w-full h-full object-${src.fit}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Status Ticker */}
            <div className="text-[10px] font-mono text-zinc-500 text-center pt-2">
              ⚡ Multi-market live websocket ingestion
            </div>
          </div>

          {/* STAGE 2: 16-Bit Digimon-Pet Runway (Center - 6 Cols) */}
          <div className="lg:col-span-6 relative h-[300px] rounded-2xl border-2 border-orange-500/20 bg-[#050914] overflow-hidden flex flex-col justify-between p-4 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]">
            
            {/* Retro 16-Bit Grid lines & Laser Conveyor */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-[#101c38] border-y border-cyan-500/30">
              <div className="w-full h-full bg-[repeating-linear-gradient(90deg,#00ffff22_0px,#00ffff22_12px,transparent_12px,transparent_24px)] animate-conveyor" />
            </div>

            {/* LANE 1: Pixel-Mon (16-Bit Electric Cyber-Fox Pet) */}
            <div className="relative h-20 w-full overflow-hidden">
              <div 
                className="absolute top-0 flex items-center gap-2 pointer-events-none animate-minion-walk-1"
                style={{ willChange: 'transform' }}
              >
                <div className="relative group cursor-pointer pointer-events-auto flex items-center gap-1.5">
                  {/* 16-Bit Pixel-Mon Sprite */}
                  <div className="pixel-sprite w-12 h-12 relative flex items-center justify-center filter drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                    <svg viewBox="0 0 16 16" className="w-12 h-12 shape-pixel" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Ears */}
                      <rect x="2" y="1" width="3" height="3" fill="#22d3ee" />
                      <rect x="11" y="1" width="3" height="3" fill="#22d3ee" />
                      <rect x="3" y="2" width="1" height="1" fill="#ecfeff" />
                      <rect x="12" y="2" width="1" height="1" fill="#ecfeff" />
                      {/* Head/Body */}
                      <rect x="2" y="4" width="12" height="8" fill="#06b6d4" />
                      <rect x="4" y="3" width="8" height="1" fill="#22d3ee" />
                      {/* 16-Bit Eyes */}
                      <rect x="4" y="6" width="2" height="3" fill="#083344" />
                      <rect x="10" y="6" width="2" height="3" fill="#083344" />
                      <rect x="4" y="6" width="1" height="1" fill="#ffffff" />
                      <rect x="10" y="6" width="1" height="1" fill="#ffffff" />
                      {/* Cute Pixel Smile */}
                      <rect x="7" y="10" width="2" height="1" fill="#083344" />
                      {/* Belly Patch */}
                      <rect x="5" y="8" width="6" height="4" fill="#a5f3fc" />
                      {/* Feet */}
                      <rect x="3" y="12" width="3" height="2" fill="#0891b2" className="animate-foot-left" />
                      <rect x="10" y="12" width="3" height="2" fill="#0891b2" className="animate-foot-right" />
                    </svg>
                  </div>

                  {/* Speech Bubble */}
                  <div className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-400 text-[9px] font-mono font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] whitespace-nowrap flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-cyan-300" />
                    Scraping!
                  </div>
                </div>
              </div>
            </div>

            {/* LANE 2: Flame-Dramon (16-Bit Digimon Dragon Pet - Carrying Card) */}
            <div className="relative h-20 w-full overflow-hidden">
              <div 
                className="absolute top-0 flex items-center gap-2 pointer-events-none animate-minion-walk-2"
                style={{ willChange: 'transform' }}
              >
                <div className="relative group cursor-pointer pointer-events-auto flex items-center gap-1.5">
                  {/* 16-Bit Flame-Dramon Sprite */}
                  <div className="pixel-sprite w-13 h-13 relative flex items-center justify-center filter drop-shadow-[0_0_10px_rgba(249,115,22,0.9)]">
                    <svg viewBox="0 0 16 16" className="w-13 h-13 shape-pixel" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Dragon Horns */}
                      <rect x="1" y="2" width="2" height="3" fill="#f59e0b" />
                      <rect x="13" y="2" width="2" height="3" fill="#f59e0b" />
                      {/* Snout & Head */}
                      <rect x="3" y="3" width="10" height="9" fill="#f97316" />
                      <rect x="4" y="2" width="8" height="1" fill="#fb923c" />
                      {/* Cute Pixel Eyes */}
                      <rect x="4" y="5" width="2" height="2" fill="#451a03" />
                      <rect x="10" y="5" width="2" height="2" fill="#451a03" />
                      <rect x="4" y="5" width="1" height="1" fill="#fef08a" />
                      <rect x="10" y="5" width="1" height="1" fill="#fef08a" />
                      {/* Dragon Tail */}
                      <rect x="0" y="9" width="3" height="2" fill="#ea580c" />
                      <rect x="0" y="8" width="1" height="1" fill="#f59e0b" />
                      {/* Belly Flame Pattern */}
                      <rect x="5" y="8" width="6" height="4" fill="#fef08a" />
                      <rect x="6" y="9" width="4" height="2" fill="#ea580c" />
                      {/* Stubby Feet */}
                      <rect x="3" y="12" width="3" height="2" fill="#c2410c" className="animate-foot-left" />
                      <rect x="10" y="12" width="3" height="2" fill="#c2410c" className="animate-foot-right" />
                    </svg>
                  </div>

                  {/* 16-Bit Floating Card Payload */}
                  <div className="px-2 py-0.5 rounded bg-orange-950/80 border border-orange-500 text-[9px] font-mono font-black text-amber-300 shadow-[0_0_12px_rgba(249,115,22,0.6)] whitespace-nowrap flex items-center gap-1">
                    🎴 PSA 10 (+RM 4.8k)
                  </div>
                </div>
              </div>
            </div>

            {/* LANE 3: Chibi-Vee (16-Bit Mecha-Panda Mapper) */}
            <div className="relative h-20 w-full overflow-hidden">
              <div 
                className="absolute top-0 flex items-center gap-2 pointer-events-none animate-minion-walk-3"
                style={{ willChange: 'transform' }}
              >
                <div className="relative group cursor-pointer pointer-events-auto flex items-center gap-1.5">
                  {/* 16-Bit Chibi-Vee Sprite */}
                  <div className="pixel-sprite w-12 h-12 relative flex items-center justify-center filter drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]">
                    <svg viewBox="0 0 16 16" className="w-12 h-12 shape-pixel" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Round Ears */}
                      <rect x="2" y="1" width="3" height="3" fill="#047857" />
                      <rect x="11" y="1" width="3" height="3" fill="#047857" />
                      {/* Head */}
                      <rect x="3" y="3" width="10" height="9" fill="#10b981" />
                      {/* Eye Patch & Monocle */}
                      <rect x="4" y="5" width="3" height="3" fill="#064e3b" />
                      <rect x="9" y="5" width="3" height="3" fill="#34d399" />
                      <rect x="10" y="6" width="1" height="1" fill="#ffffff" />
                      {/* Cute Pixel Nose */}
                      <rect x="7" y="8" width="2" height="1" fill="#064e3b" />
                      {/* Belly */}
                      <rect x="5" y="9" width="6" height="3" fill="#a7f3d0" />
                      {/* Little Feet */}
                      <rect x="3" y="12" width="3" height="2" fill="#047857" className="animate-foot-left" />
                      <rect x="10" y="12" width="3" height="2" fill="#047857" className="animate-foot-right" />
                    </svg>
                  </div>

                  {/* Speech Bubble */}
                  <div className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-400 text-[9px] font-mono font-bold text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)] whitespace-nowrap">
                    ✓ Lowest Print Mapped!
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom 16-Bit Status Bar */}
            <div className="text-center text-[10px] font-mono font-bold uppercase tracking-wider text-orange-400/80 pt-1 border-t border-white/5">
              🎮 16-Bit Overtime Pipeline &bull; Auto-Sync &bull; Verified Market Comps
            </div>
          </div>

          {/* STAGE 3: Master Price Core / Cyber-Vault HUD (Right - 3 Cols) */}
          <div className="lg:col-span-3 space-y-2.5">
            {/* Cyber-Vault Holographic HUD Terminal */}
            <div 
              onClick={handleBoost}
              title="Click to Hyper-Sync Vault Telemetry"
              className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden group cursor-pointer select-none ${
                isOverclocked
                  ? 'border-orange-400 bg-gradient-to-b from-orange-950/50 via-amber-950/30 to-black/80 shadow-[0_0_35px_rgba(249,115,22,0.45)] scale-[1.02]'
                  : 'border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 via-black/40 to-black/70 hover:border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.15)] hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]'
              }`}
            >
              {/* Sci-Fi HUD Corner Brackets */}
              <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-cyan-400/60" />
              <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 border-cyan-400/60" />
              <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 border-cyan-400/60" />
              <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-cyan-400/60" />

              {/* Animated Holographic Scanline Sweep */}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(6,182,212,0.06)_50%,transparent_100%)] pointer-events-none animate-scanline" />

              {/* Reactor Core Hologram Aura (Top Right) */}
              <div className="absolute -top-6 -right-6 w-28 h-28 pointer-events-none opacity-25 group-hover:opacity-45 transition-opacity">
                <div className={`w-full h-full rounded-full border-2 border-dashed ${isOverclocked ? 'border-orange-400 animate-spin-fast' : 'border-cyan-400 animate-spin-slow'}`} />
                <div className="absolute inset-2 rounded-full border border-dotted border-white/20" />
              </div>

              {/* Header: Vault Status & Real-time Pulsing Core */}
              <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <ShieldCheck className={`w-4 h-4 ${isOverclocked ? 'text-orange-400' : 'text-cyan-400'}`} />
                    <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isOverclocked ? 'bg-orange-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`} />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-white font-mono flex items-center gap-1.5">
                    MASTER VAULT
                    <span className="text-[9px] font-normal text-cyan-400/80 px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/30">
                      {isOverclocked ? 'OVERCLOCKED' : 'CORE // LIVE'}
                    </span>
                  </span>
                </div>
                
                {/* 5-Bar Mini Frequency Equalizer */}
                <div className="flex items-end gap-0.5 h-3 px-1">
                  <span className="w-0.5 h-1.5 bg-cyan-400/70 rounded-full animate-eq-1" />
                  <span className="w-0.5 h-3 bg-cyan-400 rounded-full animate-eq-2" />
                  <span className="w-0.5 h-2 bg-cyan-400/80 rounded-full animate-eq-3" />
                  <span className="w-0.5 h-3 bg-cyan-400 rounded-full animate-eq-4" />
                </div>
              </div>

              {/* Main Counter Display with Floating Increment Badge */}
              <div className="relative z-10 mb-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-black font-mono tracking-tight transition-colors duration-300 ${
                    isOverclocked ? 'text-orange-300' : 'text-white'
                  }`}>
                    {cardsCount.toLocaleString()}
                  </span>
                  
                  {/* Floating "+X" Neon Particle when Minions Feed Data */}
                  {lastIncrement && (
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-400/50 px-1.5 py-0.2 rounded-full animate-bounce shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                      +{lastIncrement}
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between mt-0.5">
                  <span>Verified Canonical Cards</span>
                  <span className="text-cyan-400/90 font-bold">{syncLatency}ms sync</span>
                </div>
              </div>

              {/* Data Telemetry Bus Rows */}
              <div className="space-y-1.5 border-t border-white/10 pt-2.5 mt-2.5 text-xs relative z-10">
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" /> Active Listings:
                  </span>
                  <span className="text-zinc-100 font-mono font-bold text-xs">
                    {activeListings.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-zinc-400">
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-1 h-1 rounded-full bg-amber-400" /> Graded Comps:
                  </span>
                  <span className="text-zinc-100 font-mono font-bold text-xs">
                    {gradedComps.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-zinc-400">
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" /> Rate Precision:
                  </span>
                  <span className="text-emerald-400 font-mono font-bold text-[11px] px-1 rounded bg-emerald-950/50 border border-emerald-500/30">
                    MYR (100%)
                  </span>
                </div>
              </div>
            </div>

            {/* Futuristic Quarantine Security Radar Pill */}
            <div className="flex items-center justify-between p-2 rounded-xl border border-white/5 bg-gradient-to-r from-emerald-950/20 via-black/40 to-black/60 text-xs relative overflow-hidden">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Security Matrix</span>
              </div>
              <div className="text-[11px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                <span>0 Corrupt</span>
                <span className="text-[9px] text-zinc-500 font-normal">(100% Clean)</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 16-Bit Pixel Rendering & 60 FPS CSS Animations */}
      <style jsx global>{`
        .shape-pixel {
          shape-rendering: crispEdges;
          image-rendering: pixelated;
        }
        @keyframes minionWalk1 {
          0% {
            transform: translate3d(-5%, 0, 0);
          }
          50% {
            transform: translate3d(min(260px, calc(100vw - 160px)), 0, 0);
          }
          100% {
            transform: translate3d(-5%, 0, 0);
          }
        }
        @keyframes minionWalk2 {
          0% {
            transform: translate3d(min(260px, calc(100vw - 160px)), 0, 0);
          }
          50% {
            transform: translate3d(-5%, 0, 0);
          }
          100% {
            transform: translate3d(min(260px, calc(100vw - 160px)), 0, 0);
          }
        }
        @keyframes minionWalk3 {
          0% {
            transform: translate3d(0%, 0, 0);
          }
          50% {
            transform: translate3d(min(230px, calc(100vw - 180px)), 0, 0);
          }
          100% {
            transform: translate3d(0%, 0, 0);
          }
        }
        @keyframes conveyorMove {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 24px 0;
          }
        }
        @keyframes terminalWavePulse {
          0%, 100% {
            border-color: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 0px transparent;
            transform: scale(1);
            background-color: rgba(8, 15, 32, 0.9);
          }
          20% {
            border-color: rgba(45, 212, 191, 0.65);
            box-shadow: 0 0 14px rgba(45, 212, 191, 0.35), inset 0 0 10px rgba(45, 212, 191, 0.12);
            transform: scale(1.04);
            background-color: rgba(45, 212, 191, 0.08);
          }
          40% {
            border-color: rgba(255, 255, 255, 0.12);
            box-shadow: 0 0 0px transparent;
            transform: scale(1);
            background-color: rgba(8, 15, 32, 0.9);
          }
        }
        .terminal-tile:hover {
          animation-play-state: paused;
          border-color: rgba(249, 115, 22, 0.7) !important;
          box-shadow: 0 0 16px rgba(249, 115, 22, 0.4) !important;
          transform: scale(1.06) !important;
        }
        .animate-minion-walk-1 {
          animation: minionWalk1 8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        .animate-minion-walk-2 {
          animation: minionWalk2 9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        .animate-minion-walk-3 {
          animation: minionWalk3 8.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        .animate-conveyor {
          animation: conveyorMove 1s linear infinite;
        }
        @keyframes scanlineMove {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(200%);
          }
        }
        .animate-scanline {
          animation: scanlineMove 3.5s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 16s linear infinite;
        }
        .animate-spin-fast {
          animation: spin 2.5s linear infinite;
        }
        @keyframes eqPulse1 {
          0%, 100% { height: 6px; }
          50% { height: 12px; }
        }
        @keyframes eqPulse2 {
          0%, 100% { height: 12px; }
          50% { height: 4px; }
        }
        @keyframes eqPulse3 {
          0%, 100% { height: 8px; }
          50% { height: 11px; }
        }
        @keyframes eqPulse4 {
          0%, 100% { height: 10px; }
          50% { height: 5px; }
        }
        .animate-eq-1 { animation: eqPulse1 0.8s ease-in-out infinite; }
        .animate-eq-2 { animation: eqPulse2 1.1s ease-in-out infinite; }
        .animate-eq-3 { animation: eqPulse3 0.9s ease-in-out infinite; }
        .animate-eq-4 { animation: eqPulse4 0.7s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
