'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  Search, 
  Sparkles, 
  ChevronRight, 
  Layers, 
  Palette
} from 'lucide-react';
import type { ArtistSummary } from '@/lib/artists/service';

interface GameInfo {
  id: string;
  slug: string;
  name: string;
}

interface ArtistsHubClientProps {
  games: GameInfo[];
  artistsByGame: Record<string, ArtistSummary[]>;
}

// Game badge styling configuration
const gameThemes: Record<string, {
  pillBg: string;
  pillBorder: string;
  pillText: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
}> = {
  'one-piece': {
    pillBg: 'bg-orange-500/15 text-orange-300 border-orange-500/30 hover:bg-orange-500/25',
    pillBorder: 'border-orange-500/40',
    pillText: 'text-orange-400',
    avatarBg: 'from-orange-500/20 via-red-500/20 to-amber-500/20 text-orange-400 border-orange-500/30',
    badgeBg: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
    badgeText: 'One Piece',
  },
  'pokemon': {
    pillBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25',
    pillBorder: 'border-blue-500/40',
    pillText: 'text-blue-400',
    avatarBg: 'from-blue-500/20 via-indigo-500/20 to-amber-500/20 text-blue-400 border-blue-500/30',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    badgeText: 'Pokémon',
  },
  'riftbound': {
    pillBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25',
    pillBorder: 'border-purple-500/40',
    pillText: 'text-purple-400',
    avatarBg: 'from-purple-500/20 via-violet-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
    badgeText: 'Riftbound',
  },
  'dbfw': {
    pillBg: 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25',
    pillBorder: 'border-red-500/40',
    pillText: 'text-red-400',
    avatarBg: 'from-red-500/20 via-amber-500/20 to-yellow-500/20 text-red-400 border-red-500/30',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-300',
    badgeText: 'Dragon Ball',
  },
};

const defaultTheme = {
  pillBg: 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700',
  pillBorder: 'border-zinc-700',
  pillText: 'text-zinc-400',
  avatarBg: 'from-zinc-800 via-zinc-850 to-zinc-900 text-zinc-400 border-zinc-700/60',
  badgeBg: 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300',
  badgeText: 'TCG',
};

function getArtistInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ArtistAvatar({
  name,
  photoUrl,
  avatarBg,
}: {
  name: string;
  photoUrl?: string | null;
  avatarBg: string;
}) {
  const [hasError, setHasError] = React.useState(false);

  // If photo exists and hasn't errored
  if (photoUrl && !hasError) {
    return (
      <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${avatarBg} border flex items-center justify-center shrink-0 group-hover:scale-105 transition-all duration-200 shadow-inner overflow-hidden p-0.5`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt=""
          width={56}
          height={56}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover rounded-xl"
        />
      </div>
    );
  }

  // Fallback monogram badge
  const initials = getArtistInitials(name);
  return (
    <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br ${avatarBg} border flex items-center justify-center shrink-0 group-hover:scale-105 transition-all duration-200 shadow-inner overflow-hidden select-none`}>
      <span className="font-mono font-black text-xs sm:text-sm tracking-wider text-white/90 drop-shadow">
        {initials}
      </span>
    </div>
  );
};

export function ArtistsHubClient({ games, artistsByGame }: ArtistsHubClientProps) {
  const [selectedGame, setSelectedGame] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Combine all artists into a single searchable list with duplicate deduplication across games
  const allArtists = React.useMemo(() => {
    const list: ArtistSummary[] = [];
    for (const game of games) {
      const items = artistsByGame[game.slug] || [];
      list.push(...items);
    }
    return list;
  }, [games, artistsByGame]);

  // Filter artists based on selected game tab and search text
  const filteredArtists = React.useMemo(() => {
    let result = allArtists;

    if (selectedGame !== 'all') {
      result = result.filter(a => a.gameSlug === selectedGame);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(a => 
        a.artist.toLowerCase().includes(q) || 
        (a.japaneseName && a.japaneseName.includes(q)) ||
        (a.role && a.role.toLowerCase().includes(q)) ||
        a.gameName.toLowerCase().includes(q)
      );
    }

    // Sort by card count descending
    return [...result].sort((a, b) => b.cardCount - a.cardCount);
  }, [allArtists, selectedGame, searchQuery]);

  // Calculate totals
  const totalArtistsCount = React.useMemo(() => {
    const unique = new Set(allArtists.map(a => a.slug));
    return unique.size;
  }, [allArtists]);

  return (
    <div className="min-h-screen bg-[#060c18] text-white pt-24 sm:pt-28 pb-24 relative overflow-hidden">
      {/* Background Ambience Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-20 right-1/4 w-[500px] h-[350px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8 relative z-10 space-y-8 sm:space-y-10">
        
        {/* Header Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3 sm:space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> TCG Illustrators Directory
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-400 drop-shadow-md">
            TCG Artists & Creators
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto font-medium leading-relaxed">
            Discover the master illustrators, character designers, and creative studios behind {totalArtistsCount}+ card artists.
          </p>

          {/* Quick Search Input */}
          <div className="max-w-md mx-auto relative pt-2">
            <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search illustrator (e.g. Arita, Sugimori, kankurou)..."
              className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-[#0a1324] border border-white/10 rounded-2xl text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* TCG Franchise Filter Pills (Mobile Horizontal Scrollable) */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedGame('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 border ${
              selectedGame === 'all'
                ? 'bg-purple-600 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                : 'bg-white/[0.03] text-zinc-400 border-white/10 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            All Franchises ({totalArtistsCount})
          </button>

          {games.map((g) => {
            const count = (artistsByGame[g.slug] || []).length;
            if (count === 0) return null;
            const theme = gameThemes[g.slug] || defaultTheme;
            const isSelected = selectedGame === g.slug;

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGame(g.slug)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 border flex items-center gap-1.5 ${
                  isSelected
                    ? `${theme.pillBg} border-current shadow-lg font-black`
                    : 'bg-white/[0.03] text-zinc-400 border-white/10 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <span>{g.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Profile Card Grid (Mobile-friendly 1-col on small, 2-col on mobile/tablet, 3-4 col on desktop) */}
        {filteredArtists.length === 0 ? (
          <div className="bg-[#0a1324]/50 border border-white/5 rounded-3xl p-12 text-center max-w-md mx-auto space-y-3">
            <Palette className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-white">No illustrators found</p>
            <p className="text-xs text-zinc-500">
              Try searching with another name or switch to &quot;All Franchises&quot;.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredArtists.map((artist, idx) => {
              const theme = gameThemes[artist.gameSlug] || defaultTheme;

              return (
                <Link
                  key={artist.slug + '-' + artist.gameSlug + '-' + idx}
                  href={`/artists/${artist.slug}`}
                  className="group relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-[#0b1329]/90 hover:bg-[#0f1b38] border border-white/10 hover:border-purple-500/40 transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5"
                >
                  {/* Avatar Container with Photo, Direct Loading, or Monogram Fallback */}
                  <ArtistAvatar
                    name={artist.artist}
                    photoUrl={artist.photoUrl}
                    avatarBg={theme.avatarBg}
                  />

                  {/* Profile Info Details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-purple-300 transition-colors truncate">
                        {artist.artist}
                      </h3>
                      {artist.japaneseName && (
                        <span className="text-[10px] text-zinc-500 hidden sm:inline truncate">
                          {artist.japaneseName}
                        </span>
                      )}
                    </div>

                    {/* Role or default subtitle */}
                    <p className="text-[11px] text-zinc-400 truncate">
                      {artist.role || `${artist.gameName} Illustrator`}
                    </p>

                    {/* Meta Tags: TCG Badge & Total Cards Pill */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${theme.badgeBg}`}>
                        {artist.gameName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/5">
                        <Layers className="w-2.5 h-2.5 text-zinc-500" />
                        <strong className="text-white font-semibold">{artist.cardCount}</strong> cards
                      </span>
                    </div>
                  </div>

                  {/* Right Action Chevron */}
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
