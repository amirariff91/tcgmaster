'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface Category {
  name: string;
  slug: string;
  description?: string;
  cardCount: string;
}

interface CategoryCardsProps {
  categories: Category[];
}

// Game-specific aesthetic tokens and official logo assets
const GAME_THEMES: Record<string, {
  logo: string;
  logoAlt: string;
  logoClass: string;
  borderGlow: string;
  bgGradient: string;
  accentColor: string;
}> = {
  'one-piece': {
    logo: '/images/logos/one-piece-card-game.png',
    logoAlt: 'ONE PIECE CARD GAME',
    logoClass: 'w-28 sm:w-32 md:w-36 h-12 sm:h-14 md:h-16',
    borderGlow: 'hover:border-rose-500/50 hover:shadow-[0_0_35px_rgba(244,63,94,0.22)]',
    bgGradient: 'from-rose-500/15 via-transparent to-transparent',
    accentColor: 'group-hover:text-rose-400',
  },
  'pokemon': {
    logo: '/images/logos/pokemon.svg',
    logoAlt: 'Pokémon Trading Card Game',
    logoClass: 'w-24 sm:w-28 md:w-32 h-12 sm:h-14 md:h-16',
    borderGlow: 'hover:border-cyan-400/50 hover:shadow-[0_0_35px_rgba(6,182,212,0.22)]',
    bgGradient: 'from-cyan-500/15 via-transparent to-transparent',
    accentColor: 'group-hover:text-cyan-400',
  },
  'riftbound': {
    logo: '/images/logos/riftbound.svg',
    logoAlt: 'Riftbound League of Legends TCG',
    logoClass: 'w-28 sm:w-32 md:w-36 h-12 sm:h-14 md:h-16',
    borderGlow: 'hover:border-purple-500/50 hover:shadow-[0_0_35px_rgba(168,85,247,0.22)]',
    bgGradient: 'from-purple-500/15 via-transparent to-transparent',
    accentColor: 'group-hover:text-purple-400',
  },
  'dbfw': {
    logo: '/images/logos/dragon-ball-super.png',
    logoAlt: 'Dragon Ball Super Card Game',
    logoClass: 'w-28 sm:w-32 md:w-36 h-12 sm:h-14 md:h-16',
    borderGlow: 'hover:border-amber-400/50 hover:shadow-[0_0_35px_rgba(245,158,11,0.22)]',
    bgGradient: 'from-amber-500/15 via-transparent to-transparent',
    accentColor: 'group-hover:text-amber-400',
  },
  'boboiboy': {
    logo: '/images/logos/monsta-galaxy-card.png',
    logoAlt: 'Monsta Galaxy Card Game',
    logoClass: 'w-26 sm:w-30 md:w-34 h-13 sm:h-15 md:h-18',
    borderGlow: 'hover:border-cyan-400/50 hover:shadow-[0_0_35px_rgba(6,182,212,0.22)]',
    bgGradient: 'from-cyan-500/15 via-transparent to-transparent',
    accentColor: 'group-hover:text-cyan-400',
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
              Ecosystems
            </span>
            <span className="text-xs font-semibold text-zinc-400">5 Active TCGs Universes</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">TCGs</span>
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
          Direct market pipelines actively monitored by TM Minions for accurate pricing, tournament deck metas, and print variants.
        </p>
      </div>

      {/* Side-by-Side Square TCG Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 md:gap-5">
        {categories.map((category) => {
          const theme = GAME_THEMES[category.slug] || {
            logo: '/images/logos/pokemon.svg',
            logoAlt: category.name,
            logoClass: 'w-24 h-12',
            borderGlow: 'hover:border-orange-500/40 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]',
            bgGradient: 'from-orange-500/10 via-transparent to-transparent',
            accentColor: 'group-hover:text-orange-400',
          };

          return (
            <Link
              key={category.slug}
              href={`/search?game=${category.slug}`}
              className={cn(
                "group relative flex flex-col justify-between items-center rounded-2xl sm:rounded-3xl border border-white/10 bg-[#080e1e]/90 p-4 sm:p-5 md:p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-2xl overflow-hidden aspect-[1/1] sm:aspect-[4/3] lg:aspect-[1/1]",
                theme.borderGlow
              )}
            >
              {/* Ambient Game-Themed Glow on Hover */}
              <div 
                className={cn(
                  "absolute inset-0 bg-gradient-to-b opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                  theme.bgGradient
                )} 
              />
              
              {/* Top: Franchise Official Logo */}
              <div className="relative z-10 flex-1 w-full flex items-center justify-center pt-2">
                <div className={cn("relative flex items-center justify-center transition-transform duration-300 group-hover:scale-108 drop-shadow-md", theme.logoClass)}>
                  <Image
                    src={theme.logo}
                    alt={theme.logoAlt}
                    fill
                    className="object-contain"
                    sizes="(max-width: 640px) 140px, (max-width: 1024px) 180px, 200px"
                    priority
                  />
                </div>
              </div>

              {/* Bottom: Total Cards Count */}
              <div className="relative z-10 w-full pt-3 border-t border-white/5 flex items-center justify-center text-center">
                <p className="font-mono text-xs sm:text-sm font-extrabold text-zinc-300 group-hover:text-white transition-colors tracking-tight">
                  {category.cardCount} <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-400">cards</span>
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default CategoryCards;

