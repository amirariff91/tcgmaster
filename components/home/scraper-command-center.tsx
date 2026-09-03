'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Cpu, 
  Database, 
  Sparkles, 
  ShieldCheck,
  Globe
} from 'lucide-react';

// Global data sources where TM Minions harvest card prices
const DATA_SOURCES = [
  { id: 'tcgplayer', name: 'TCGPlayer', flag: '🇺🇸' },
  { id: 'snkrdunk', name: 'Snkrdunk JP', flag: '🇯🇵' },
  { id: 'pricecharting', name: 'PriceCharting', flag: '📈' },
  { id: 'cardrush', name: 'CardRush', flag: '🇯🇵' },
];

// Simulated real-time streaming telemetry logs
const TELEMETRY_STREAM = [
  { bot: 'FlameDramon', action: 'Scraped Snkrdunk Tokyo', detail: 'OP-05 Shanks Manga PSA 10', speed: '14ms' },
  { bot: 'ChibiVee', action: 'Synced TCGPlayer Direct', detail: 'Charizard Base Set #004', speed: '21ms' },
  { bot: 'PixelMon', action: 'Parsed CardRush Akihabara', detail: 'BoBoiBoy Supra #047', speed: '8ms' },
  { bot: 'ChibiVee', action: 'Validated Graded Comps', detail: 'Goku SCR Awakened Pulse (BGS 9.5)', speed: '18ms' },
  { bot: 'FlameDramon', action: 'Mapped Lowest Cost Deck Print', detail: 'Ahri Legendary Champion', speed: '12ms' },
  { bot: 'PixelMon', action: 'Pruned Corrupt 404 URLs', detail: '1,575 dead images quarantined', speed: '5ms' },
  { bot: 'FlameDramon', action: 'Currency Normalized', detail: 'Converted JPY -> RM 4,846.08', speed: '3ms' },
];

export function ScraperCommandCenter() {
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const [cardsProcessed, setCardsProcessed] = useState(50747);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Performance safeguard: Pause animations when offscreen
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Live telemetry ticker
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setTelemetryIndex(prev => (prev + 1) % TELEMETRY_STREAM.length);
      setCardsProcessed(prev => prev + 3);
    }, 2200);
    return () => clearInterval(interval);
  }, [isVisible]);

  const currentLog = TELEMETRY_STREAM[telemetryIndex];

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Section Header with Live Status (Clean, no buttons) */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              Autonomous Engine Active
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

        {/* Top Telemetry Ticker Bar */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-3.5 mb-8 rounded-2xl bg-black/50 border border-white/10 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-mono text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-500 font-bold">FEED:</span>
              <span className="text-orange-400 font-black tracking-wide">{currentLog.bot}</span>
              <span className="text-zinc-400">&rarr;</span>
              <span className="text-white">{currentLog.action}</span>
              <span className="text-zinc-500">({currentLog.detail})</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono font-medium text-zinc-400">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>LATENCY: <strong className="text-emerald-400">{currentLog.speed}</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-blue-400" />
              <span>VAULT: <strong className="text-white">{cardsProcessed.toLocaleString()} cards</strong></span>
            </div>
          </div>
        </div>

        {/* THE 3-STAGE MINION RUNWAY */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* STAGE 1: Source Market Terminals (Left - 3 Cols) */}
          <div className="lg:col-span-3 space-y-2.5">
            <div className="text-[11px] uppercase tracking-widest font-black text-zinc-400 mb-2 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-orange-400" /> Global Data Terminals
            </div>
            {DATA_SOURCES.map((src) => (
              <div 
                key={src.id}
                className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{src.flag}</span>
                  <span className="text-xs font-bold text-zinc-200 group-hover:text-white transition-colors">{src.name}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE
                </div>
              </div>
            ))}
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

          {/* STAGE 3: Master Price Core / TCG Vault (Right - 3 Cols) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="p-4 rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-950/20 via-black/40 to-black/60 shadow-[0_0_30px_rgba(249,115,22,0.15)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <Database className="w-16 h-16 text-orange-500" />
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">Canonical Master Vault</span>
              </div>

              <div className="text-2xl sm:text-3xl font-black text-white font-mono mb-1">
                {cardsProcessed.toLocaleString()}
              </div>
              <div className="text-[11px] text-zinc-400 mb-4 font-medium">
                Verified Cards across 5 TCG ecosystems
              </div>

              <div className="space-y-2 border-t border-white/10 pt-3 text-xs">
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Active Listings:</span>
                  <span className="text-white font-mono font-bold">142,890</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Graded Comps:</span>
                  <span className="text-white font-mono font-bold">38,112</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Currency Precision:</span>
                  <span className="text-emerald-400 font-mono font-bold">MYR (100%)</span>
                </div>
              </div>
            </div>

            {/* Instant Status Pill */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] text-xs">
              <span className="text-zinc-400 font-medium">Quarantine Status:</span>
              <span className="text-emerald-400 font-bold font-mono">0 Corrupt (Clean)</span>
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
      `}</style>
    </div>
  );
}
