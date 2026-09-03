'use client';

import type * as React from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Layers, 
  Sparkles, 
  Cpu, 
  Flame, 
  Zap, 
  ShieldCheck, 
  Swords, 
  Orbit 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Category {
  name: string;
  slug: string;
  description: string;
  cardCount: string;
}

interface CategoryCardsProps {
  categories: Category[];
}

// Game-specific tactical aesthetic tokens matching TM Minions theme
const GAME_THEMES: Record<string, {
  color: string;
  borderGlow: string;
  bgGradient: string;
  badge: string;
  icon: React.ReactNode;
  pipelineStatus: string;
}> = {
  'one-piece': {
    color: 'text-rose-400',
    borderGlow: 'hover:border-rose-500/40 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
    bgGradient: 'from-rose-500/10 via-transparent to-transparent',
    badge: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    icon: <Flame className="w-5 h-5 text-rose-400" />,
    pipelineStatus: '⚡ Minion Sync: Live',
  },
  'pokemon': {
    color: 'text-cyan-400',
    borderGlow: 'hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]',
    bgGradient: 'from-cyan-500/10 via-transparent to-transparent',
    badge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    icon: <Zap className="w-5 h-5 text-cyan-400" />,
    pipelineStatus: '⚡ 7,013 Market Comps',
  },
  'riftbound': {
    color: 'text-purple-400',
    borderGlow: 'hover:border-purple-500/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
    bgGradient: 'from-purple-500/10 via-transparent to-transparent',
    badge: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    icon: <Swords className="w-5 h-5 text-purple-400" />,
    pipelineStatus: '⚡ Riot CDN Verified',
  },
  'dbfw': {
    color: 'text-amber-400',
    borderGlow: 'hover:border-amber-500/40 hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    bgGradient: 'from-amber-500/10 via-transparent to-transparent',
    badge: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    icon: <Sparkles className="w-5 h-5 text-amber-400" />,
    pipelineStatus: '⚡ Graded & Raw Comps',
  },
  'boboiboy': {
    color: 'text-teal-400',
    borderGlow: 'hover:border-teal-500/40 hover:shadow-[0_0_30px_rgba(20,184,166,0.15)]',
    bgGradient: 'from-teal-500/10 via-transparent to-transparent',
    badge: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
    icon: <Orbit className="w-5 h-5 text-teal-400" />,
    pipelineStatus: '⚡ 1000x1500 Studio Scans',
  },
};

export function CategoryCards({ categories }: CategoryCardsProps) {
  return (
    <section className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest bg-orange-500/10 border border-orange-500/30 text-orange-400">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              Verified Ecosystems
            </span>
            <span className="text-xs font-semibold text-zinc-400">5 Active Card Universes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">TCGs</span>
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
          Direct market pipelines actively monitored by TM Minions for accurate pricing, tournament deck metas, and print variants.
        </p>
      </div>

      {/* Advanced TM Minions Ecosystem Matrix */}
      <div className="space-y-3">
        {categories.map((category) => {
          const theme = GAME_THEMES[category.slug] || {
            color: 'text-orange-400',
            borderGlow: 'hover:border-orange-500/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]',
            bgGradient: 'from-orange-500/10 via-transparent to-transparent',
            badge: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
            icon: <Layers className="w-5 h-5 text-orange-400" />,
            pipelineStatus: '⚡ Minion Sync: Live',
          };

          return (
            <Link
              key={category.slug}
              href={`/search?game=${category.slug}`}
              className={cn(
                "group relative block overflow-hidden rounded-2xl border border-white/10 bg-[#080e1e]/90 p-5 md:p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5",
                theme.borderGlow
              )}
            >
              {/* Ambient Game Gradient Accent */}
              <div 
                className={cn(
                  "absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                  theme.bgGradient
                )} 
              />

              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                
                {/* Game Title, Icon & Description */}
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 shadow-inner group-hover:scale-105 transition-transform">
                    {theme.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-black text-white group-hover:text-orange-400 transition-colors">
                        {category.name}
                      </h3>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border", theme.badge)}>
                        {theme.pipelineStatus}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-1 line-clamp-1">
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* Right Side: Indexed Count & Tactical Explore Action */}
                <div className="flex items-center justify-between md:justify-end gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Indexed Catalog</p>
                    <p className="font-mono text-base font-black text-white tracking-tight">
                      {category.cardCount} <span className="text-xs text-zinc-400 font-medium">cards</span>
                    </p>
                  </div>

                  {/* Tactical Action Button */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-bold text-white group-hover:bg-gradient-to-r group-hover:from-orange-600 group-hover:to-amber-500 group-hover:border-transparent group-hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all">
                    <span>Enter Market</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>

              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default CategoryCards;
