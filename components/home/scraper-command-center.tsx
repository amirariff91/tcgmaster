'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Cpu, 
  Server, 
  Database, 
  Activity, 
  RefreshCw, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  ShieldCheck,
  Flame,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MarketMovers, type MarketMover } from './market-movers';

interface ScraperCommandCenterProps {
  gainers: MarketMover[];
  losers: MarketMover[];
}

// Global data sources where bots harvest card prices
const DATA_SOURCES = [
  { id: 'tcgplayer', name: 'TCGPlayer', flag: '🇺🇸', color: 'from-blue-500 to-cyan-400', glow: 'shadow-cyan-500/30' },
  { id: 'snkrdunk', name: 'Snkrdunk JP', flag: '🇯🇵', color: 'from-rose-500 to-red-400', glow: 'shadow-rose-500/30' },
  { id: 'pricecharting', name: 'PriceCharting', flag: '📈', color: 'from-emerald-500 to-teal-400', glow: 'shadow-emerald-500/30' },
  { id: 'monsta', name: 'Monsta Studio', flag: '⚡', color: 'from-amber-500 to-orange-400', glow: 'shadow-amber-500/30' },
  { id: 'riot', name: 'Riot Games CDN', flag: '⚔️', color: 'from-purple-500 to-violet-400', glow: 'shadow-purple-500/30' },
];

// Simulated real-time streaming telemetry logs
const TELEMETRY_STREAM = [
  { bot: 'VoltBot-01', action: 'Scraped Snkrdunk Tokyo', detail: 'OP-05 Shanks Manga PSA 10', speed: '14ms', status: 'verified' },
  { bot: 'ChibiDramon', action: 'Synced TCGPlayer Direct', detail: 'Charizard Base Set #004', speed: '21ms', status: 'verified' },
  { bot: 'KokoBot', action: 'Parsed Monsta Galaxy Studio Scans', detail: 'BoBoiBoy Supra #047 (Ultra HD)', speed: '8ms', status: 'optimized' },
  { bot: 'HexByte-03', action: 'Validated Graded Comps', detail: 'Goku SCR Awakened Pulse (BGS 9.5)', speed: '18ms', status: 'verified' },
  { bot: 'RiftRunner', action: 'Fetched Riot Games Catalog', detail: 'Ahri Legendary Champion', speed: '12ms', status: 'verified' },
  { bot: 'ChibiDramon', action: 'Pruned Corrupt 404 URLs', detail: 'Cleaned 1,575 dead image records', speed: '5ms', status: 'pruned' },
  { bot: 'VoltBot-01', action: 'Currency Normalized', detail: 'Converted JPY -> RM 4,846.08', speed: '3ms', status: 'converted' },
];

export function ScraperCommandCenter({ gainers, losers }: ScraperCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<'bots' | 'table'>('bots');
  const [isOverclocked, setIsOverclocked] = useState(false);
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const [cardsProcessed, setCardsProcessed] = useState(50650);
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
      setCardsProcessed(prev => prev + (isOverclocked ? 7 : 2));
    }, isOverclocked ? 1200 : 2400);
    return () => clearInterval(interval);
  }, [isVisible, isOverclocked]);

  const currentLog = TELEMETRY_STREAM[telemetryIndex];

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Section Header with Live Status & Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
              Autonomous Engine Active
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-zinc-400">
              <Cpu className="w-3.5 h-3.5 text-zinc-500" />
              12 Cyber-Bots Working Overtime
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Live Scraper & <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">Mapper Grid</span>
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mt-1">
            Real-time autonomous bots harvesting price sales, verifying graded comps, and mapping lowest-cost deck variants.
          </p>
        </div>

        {/* View Switcher & Overclock Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsOverclocked(!isOverclocked)}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all duration-300 cursor-pointer",
              isOverclocked 
                ? "bg-red-500/20 border-red-500/50 text-red-300 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse" 
                : "bg-white/[0.04] border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
            )}
          >
            <Flame className={cn("w-3.5 h-3.5 transition-transform", isOverclocked && "text-red-400 scale-125")} />
            {isOverclocked ? "Overclocked 2x!" : "Overclock"}
          </button>

          <div className="p-1 rounded-xl bg-black/40 border border-white/10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('bots')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'bots' 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Cpu className="w-3.5 h-3.5" /> Bot Runway
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'table' 
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Layers className="w-3.5 h-3.5" /> Market Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      {activeTab === 'bots' ? (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0b1329]/95 via-[#060c18]/90 to-[#0b1329]/95 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
          
          {/* Cybernetic Ambient Grid Backdrop */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-orange-600/10 rounded-full blur-[100px] pointer-events-none" />

          {/* Top Telemetry Ticker Bar */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-3.5 mb-8 rounded-2xl bg-black/40 border border-white/10 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-mono text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-500">FEED:</span>
                <span className="text-orange-400 font-bold">{currentLog.bot}</span>
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

          {/* THE 3-STAGE BOT RUNWAY */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* STAGE 1: Source Market Terminals (Left) */}
            <div className="lg:col-span-3 space-y-2.5">
              <div className="text-[11px] uppercase tracking-widest font-black text-zinc-400 mb-2 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-orange-400" /> Global Data Terminals
              </div>
              {DATA_SOURCES.map((src) => (
                <div 
                  key={src.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all group"
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

            {/* STAGE 2: The Active Bot Runway (Center - 6 Cols) */}
            <div className="lg:col-span-6 relative h-[280px] sm:h-[320px] rounded-2xl border border-white/10 bg-black/60 overflow-hidden flex flex-col justify-between p-4">
              
              {/* Pipeline Floor & Laser Lines */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-cyan-500/20 via-orange-500/40 to-emerald-500/20" />
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-gradient-to-r from-cyan-400 via-orange-400 to-emerald-400 blur-[1px] animate-pulse" />

              {/* Lane 1: VoltBot (Scout Drone - Top Lane) */}
              <div className="relative h-16 w-full overflow-hidden">
                <div 
                  className={cn(
                    "absolute top-0 flex items-center gap-2 pointer-events-none transition-transform",
                    isOverclocked ? "animate-bot-patrol-fast" : "animate-bot-patrol"
                  )}
                  style={{ willChange: 'transform' }}
                >
                  {/* VoltBot SVG Avatar */}
                  <div className="relative group cursor-pointer pointer-events-auto">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-[1.5px] shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                      <div className="w-full h-full bg-zinc-950 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
                        {/* Robot Ears/Antennas */}
                        <div className="absolute -top-1 w-6 flex justify-between">
                          <span className="w-1 h-2 bg-cyan-400 rounded-full" />
                          <span className="w-1 h-2 bg-cyan-400 rounded-full" />
                        </div>
                        {/* Eye Visor */}
                        <div className="w-6 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] flex items-center justify-center">
                          <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                        </div>
                        <span className="text-[8px] font-black text-cyan-300 mt-1 uppercase tracking-tighter">VOLT-01</span>
                      </div>
                    </div>
                    {/* Floating Packet */}
                    <div className="absolute -top-3 -right-2 px-1.5 py-0.5 rounded bg-cyan-400/20 border border-cyan-400/40 text-[8px] font-mono text-cyan-300 flex items-center gap-0.5">
                      <Sparkles className="w-2 h-2 text-cyan-300" />
                      $Comp
                    </div>
                  </div>
                </div>
              </div>

              {/* Lane 2: Chibi-Dramon (Data Carrier - Digimon style Middle Lane) */}
              <div className="relative h-16 w-full overflow-hidden">
                <div 
                  className={cn(
                    "absolute top-0 flex items-center gap-2 pointer-events-none transition-transform",
                    isOverclocked ? "animate-bot-patrol-reverse-fast" : "animate-bot-patrol-reverse"
                  )}
                  style={{ willChange: 'transform' }}
                >
                  {/* Chibi-Dramon Avatar */}
                  <div className="relative group cursor-pointer pointer-events-auto">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 p-[2px] shadow-[0_0_20px_rgba(249,115,22,0.6)]">
                      <div className="w-full h-full bg-zinc-950 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
                        {/* Horns */}
                        <div className="absolute top-0.5 w-7 flex justify-between">
                          <span className="w-1.5 h-2 bg-amber-400 rotate-[-20deg] rounded-sm" />
                          <span className="w-1.5 h-2 bg-amber-400 rotate-[20deg] rounded-sm" />
                        </div>
                        {/* Cute Eyes */}
                        <div className="w-7 flex justify-around mt-1">
                          <span className="w-1.5 h-2.5 bg-orange-400 rounded-full shadow-[0_0_6px_rgba(249,115,22,1)]" />
                          <span className="w-1.5 h-2.5 bg-orange-400 rounded-full shadow-[0_0_6px_rgba(249,115,22,1)]" />
                        </div>
                        <span className="text-[7.5px] font-black text-amber-300 mt-1 uppercase tracking-tighter">CHIBI-DRA</span>
                      </div>
                    </div>
                    {/* Carried Card Payload */}
                    <div className="absolute -bottom-2 -right-3 px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-500/50 text-[8px] font-mono text-orange-300 shadow-md">
                      🎴 PSA 10
                    </div>
                  </div>
                </div>
              </div>

              {/* Lane 3: KokoBot (Mapper Validator - Bottom Lane) */}
              <div className="relative h-16 w-full overflow-hidden">
                <div 
                  className={cn(
                    "absolute top-0 flex items-center gap-2 pointer-events-none transition-transform",
                    isOverclocked ? "animate-bot-patrol-fast" : "animate-bot-patrol"
                  )}
                  style={{ willChange: 'transform', animationDelay: '-3.5s' }}
                >
                  {/* KokoBot Avatar */}
                  <div className="relative group cursor-pointer pointer-events-auto">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 p-[1.5px] shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                      <div className="w-full h-full bg-zinc-950 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
                        {/* Monocle Scanner */}
                        <div className="w-5 h-2.5 rounded-full border border-emerald-400 bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.8)] flex items-center justify-center">
                          <span className="w-1 h-1 bg-white rounded-full" />
                        </div>
                        <span className="text-[8px] font-black text-emerald-300 mt-1 uppercase tracking-tighter">KOKO-MAP</span>
                      </div>
                    </div>
                    {/* Stamp */}
                    <div className="absolute -top-3 -left-2 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-[8px] font-mono text-emerald-300">
                      ✓ RM Val
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Overtime Status Bar */}
              <div className="text-center text-[11px] font-mono text-zinc-500">
                &bull; Continuous Pipeline &bull; Automated 15-min Revalidation &bull; Zero Corrupt Data &bull;
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
      ) : (
        /* Fallback: Tabular View for users wanting traditional gainers/losers */
        <div className="rounded-3xl border border-white/10 bg-[#0b1329]/80 p-6 backdrop-blur-md shadow-2xl">
          <MarketMovers gainers={gainers} losers={losers} />
        </div>
      )}

      {/* Embedded 60 FPS Keyframe Animations */}
      <style jsx global>{`
        @keyframes botPatrol {
          0% {
            transform: translate3d(-5%, 0, 0);
          }
          50% {
            transform: translate3d(260px, 0, 0);
          }
          100% {
            transform: translate3d(-5%, 0, 0);
          }
        }
        @keyframes botPatrolReverse {
          0% {
            transform: translate3d(260px, 0, 0);
          }
          50% {
            transform: translate3d(-5%, 0, 0);
          }
          100% {
            transform: translate3d(260px, 0, 0);
          }
        }
        .animate-bot-patrol {
          animation: botPatrol 8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        .animate-bot-patrol-reverse {
          animation: botPatrolReverse 9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        .animate-bot-patrol-fast {
          animation: botPatrol 4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
        .animate-bot-patrol-reverse-fast {
          animation: botPatrolReverse 4.5s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }
      `}</style>
    </div>
  );
}
