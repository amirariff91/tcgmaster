'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  User, 
  Sparkles, 
  Layers, 
  MapPin, 
  Calendar, 
  BookOpen, 
  ChevronRight, 
  Search,
  Trophy,
  Medal,
  Award
} from 'lucide-react';
import { CardImage } from '@/components/card/card-image';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { formatDisplayNumber, getRarityDisplay, splitCardName } from '@/lib/utils';
import type { ArtistProfile, ArtistCardItem } from '@/lib/artists/service';

interface ArtistDetailClientProps {
  artist: string;
  profile: ArtistProfile;
  cards: ArtistCardItem[];
}

// Game badge styling configuration
const gameThemes: Record<string, {
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}> = {
  'one-piece': {
    badgeBg: 'bg-orange-500/15',
    badgeBorder: 'border-orange-500/30',
    badgeText: 'text-orange-400',
  },
  'pokemon': {
    badgeBg: 'bg-blue-500/15',
    badgeBorder: 'border-blue-500/30',
    badgeText: 'text-blue-400',
  },
  'riftbound': {
    badgeBg: 'bg-purple-500/15',
    badgeBorder: 'border-purple-500/30',
    badgeText: 'text-purple-400',
  },
  'dbfw': {
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-400',
  },
};

const defaultGameTheme = {
  badgeBg: 'bg-zinc-800/60',
  badgeBorder: 'border-zinc-700',
  badgeText: 'text-zinc-300',
};

export function ArtistDetailClient({ artist, profile, cards }: ArtistDetailClientProps) {
  const [selectedGame, setSelectedGame] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'price-desc' | 'price-asc' | 'name-asc'>('price-desc');

  // Available games in this artist's catalog
  const gamesMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const card of cards) {
      map.set(card.gameSlug, card.gameName);
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [cards]);

  // Filter and sort cards
  const filteredCards = React.useMemo(() => {
    let result = cards;

    if (selectedGame !== 'all') {
      result = result.filter(c => c.gameSlug === selectedGame);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.setName.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q)
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'price-desc') {
        return (b.priceUsd ?? 0) - (a.priceUsd ?? 0);
      }
      if (sortBy === 'price-asc') {
        if (a.priceUsd == null) return 1;
        if (b.priceUsd == null) return -1;
        return a.priceUsd - b.priceUsd;
      }
      return a.name.localeCompare(b.name);
    });
  }, [cards, selectedGame, searchQuery, sortBy]);

  return (
    <div className="min-h-screen bg-[#060c18] text-white pt-24 sm:pt-28 pb-24 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[350px] bg-zinc-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-[500px] h-[350px] bg-slate-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 relative z-10 space-y-8">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center space-x-2 text-xs text-zinc-400">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <Link href="/artists" className="hover:text-white transition-colors">Artists</Link>
          <ChevronRight className="h-3 w-3 opacity-50" />
          <span className="text-white font-medium">{profile.name}</span>
        </nav>

        {/* Artist Profile Hero Header - Silver Styling */}
        <div className="rounded-3xl border border-zinc-500/25 bg-gradient-to-b from-[#1e2433]/90 via-[#131926]/90 to-[#0b101c]/95 backdrop-blur-xl p-5 sm:p-7 lg:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Silver Top Shimmer */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-300/40 to-transparent" />
          
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start justify-between">
            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-start flex-1 min-w-0">
              
              {/* Profile Picture / Avatar Icon - 2x Bigger */}
              <div className="relative shrink-0 mx-auto sm:mx-0">
                <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-2xl sm:rounded-3xl border-2 border-zinc-400/30 bg-gradient-to-b from-zinc-700/50 via-zinc-800/70 to-zinc-900/90 shadow-2xl flex items-center justify-center overflow-hidden p-1 sm:p-1.5">
                  {profile.photoUrl ? (
                    <Image
                      src={profile.photoUrl}
                      alt={profile.name}
                      width={200}
                      height={200}
                      priority
                      className="w-full h-full object-cover rounded-xl sm:rounded-2xl"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl sm:rounded-2xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                      <User className="w-16 h-16 sm:w-20 sm:h-20 stroke-[1.5] text-zinc-300/80" />
                    </div>
                  )}
                </div>
              </div>

              {/* Info Column - Optimized Spacing */}
              <div className="space-y-3 flex-1 min-w-0 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-zinc-700/40 border border-zinc-500/30 text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                    <Sparkles className="w-3 h-3 text-zinc-300" />
                    {profile.role || 'TCG Illustrator'}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                    {profile.name}
                  </h1>
                  {profile.japaneseName && (
                    <span className="text-base sm:text-xl font-bold text-zinc-400/80">
                      ({profile.japaneseName})
                    </span>
                  )}
                </div>

                {/* Biography & Overview Box */}
                <div className="bg-black/25 border border-zinc-700/30 rounded-2xl p-3.5 sm:p-4 text-zinc-300 text-sm leading-relaxed space-y-2 max-w-3xl">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <BookOpen className="w-3.5 h-3.5 text-zinc-300" />
                    Artist Overview
                  </div>
                  <p className="text-zinc-300/90 leading-relaxed text-xs sm:text-[13px]">
                    {profile.bio}
                  </p>

                  {(profile.country || profile.birth) && (
                    <div className="pt-2 border-t border-zinc-700/30 flex flex-wrap gap-4 text-xs text-zinc-400">
                      {profile.country && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-zinc-400" />
                          {profile.country}
                        </span>
                      )}
                      {profile.birth && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {profile.birth}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar - Silver Themed */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 w-full lg:w-64 shrink-0">
              {/* Total Artworks */}
              <div className="bg-zinc-800/40 border border-zinc-500/20 rounded-2xl p-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-300" />
                  Total Artworks
                </span>
                <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                  {cards.length}
                </span>
                <span className="text-[11px] text-zinc-400/80 mt-0.5">official card prints</span>
              </div>

              {/* TCG Franchises Badges */}
              <div className="bg-zinc-800/40 border border-zinc-500/20 rounded-2xl p-4 flex flex-col justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-300" />
                  TCG Franchises
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {gamesMap.map((g) => {
                    const theme = gameThemes[g.slug] || defaultGameTheme;
                    return (
                      <span
                        key={g.slug}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText}`}
                      >
                        {g.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Complete Illustrated Catalog - Compact & Ranked */}
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                Illustrated Card Artworks
              </h2>
              <p className="text-xs text-zinc-400">
                Showing {filteredCards.length} of {cards.length} total cards
              </p>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Game Filter Pills */}
              {gamesMap.length > 1 && (
                <div className="flex items-center gap-1 bg-[#0a1324] p-1 rounded-xl border border-white/10 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSelectedGame('all')}
                    className={`px-3 py-1 rounded-lg transition-all text-xs ${
                      selectedGame === 'all'
                        ? 'bg-zinc-700 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    All ({cards.length})
                  </button>
                  {gamesMap.map((g) => (
                    <button
                      key={g.slug}
                      type="button"
                      onClick={() => setSelectedGame(g.slug)}
                      className={`px-3 py-1 rounded-lg transition-all text-xs ${
                        selectedGame === g.slug
                          ? 'bg-zinc-700 text-white shadow-md'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Search Inside Artist Cards */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search cards..."
                  className="pl-8 pr-3 py-1.5 bg-[#0a1324] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-400/50 w-36 sm:w-44"
                />
              </div>

              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#0a1324] text-xs font-semibold text-zinc-300 border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none focus:border-zinc-400/50 cursor-pointer"
                >
                  <option value="price-desc">Rank / Price: High to Low</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="name-asc">Card Name: A to Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Cards Gallery Grid - Scaled to screenshot proportions */}
          {filteredCards.length === 0 ? (
            <div className="bg-[#0a1324]/50 border border-white/5 rounded-3xl p-12 text-center text-zinc-400">
              <p className="text-sm font-semibold">No cards match your filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-3.5">
              {filteredCards.map((card, index) => {
                const { baseName: cleanName } = splitCardName(card.name);
                const displayNumber = formatDisplayNumber(card.gameSlug, card.number);

                // Check for Top 1, 2, 3 rank badges when sorted by price descending
                const isRankedSort = sortBy === 'price-desc' && selectedGame === 'all' && !searchQuery.trim();
                const rank = isRankedSort && index < 3 ? index + 1 : null;

                return (
                  <Link
                    key={card.id}
                    href={`/${card.gameSlug}/${card.setSlug}/${card.slug}`}
                    className={`group relative flex flex-col bg-[#0b1329] rounded-xl border p-2.5 sm:p-3 transition-all duration-300 shadow-sm hover:shadow-md ${
                      rank === 1
                        ? 'border-amber-500/50 bg-gradient-to-b from-[#171c2e] to-[#0b1329] hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                        : rank === 2
                        ? 'border-slate-400/50 bg-gradient-to-b from-[#161a29] to-[#0b1329] hover:border-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.12)]'
                        : rank === 3
                        ? 'border-amber-700/50 bg-gradient-to-b from-[#181625] to-[#0b1329] hover:border-amber-600 shadow-[0_0_10px_rgba(180,83,9,0.1)]'
                        : 'border-white/10 hover:border-white/20 hover:bg-[#0e1730]'
                    }`}
                  >
                    {/* Trophy Badge for 1st, 2nd, 3rd place */}
                    {rank === 1 && (
                      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/90 text-black text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-sm">
                        <Trophy className="w-3 h-3 text-black" />
                        <span>#1</span>
                      </div>
                    )}
                    {rank === 2 && (
                      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-300/90 text-black text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-sm">
                        <Medal className="w-3 h-3 text-black" />
                        <span>#2</span>
                      </div>
                    )}
                    {rank === 3 && (
                      <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-700/90 text-white text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur-sm">
                        <Award className="w-3 h-3 text-white" />
                        <span>#3</span>
                      </div>
                    )}

                    {/* Card Image Box - Scaled & compact */}
                    <div className="relative aspect-[5/7] w-full max-w-[150px] mx-auto mb-2 flex items-center justify-center">
                      <CardImage
                        src={card.imageUrl}
                        alt={cleanName}
                        className="w-full h-auto object-contain rounded drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Card Text Content (Exact style as screenshot) */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs sm:text-[13px] text-white group-hover:text-amber-400 transition-colors truncate">
                        {cleanName}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {card.setName}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {card.rarity ? getRarityDisplay(card.rarity) : 'Common'} &bull; #{displayNumber || '?'}
                      </p>
                    </div>

                    {/* Card Price - Orange Highlight */}
                    <div className="mt-2.5 pt-1.5 border-t border-white/5 flex items-baseline justify-between">
                      {card.priceUsd != null && card.priceUsd > 0 ? (
                        <FormattedPrice
                          price={card.priceUsd}
                          className="text-xs sm:text-[13px] font-black text-amber-500 tabular-nums"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                          --
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

