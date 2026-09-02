import { Metadata } from 'next';
import { dbQuery } from '@/lib/db/client';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, ChevronRight, Loader2, Crown, Flame, Sparkles } from 'lucide-react';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';

export const metadata: Metadata = {
  title: 'Global Meta Tier List & Top Decks | TCGMaster',
  description: 'Explore the top winning deck archetypes, tournament statistics, and meta shares across all Trading Card Games.',
};

export const revalidate = 60; // Revalidate every minute

// Map slugs to dynamic theme styles, colors, and banners
const gameStyles: Record<string, { bg: string; text: string; glow: string; border: string; banner: string }> = {
  'one-piece': {
    bg: 'from-orange-950/40 via-red-950/30 to-zinc-950/60',
    text: 'text-orange-400',
    glow: 'group-hover:border-orange-500/40',
    border: 'border-orange-500/20',
    banner: '/images/one-piece-banner.jpg',
  },
  'pokemon': {
    bg: 'from-blue-950/40 via-amber-950/20 to-zinc-950/60',
    text: 'text-blue-400',
    glow: 'group-hover:border-blue-400/40',
    border: 'border-blue-400/20',
    banner: '/images/pokemon-banner.jpg',
  },
  'dbfw': {
    bg: 'from-amber-950/40 via-orange-950/30 to-zinc-950/60',
    text: 'text-amber-400',
    glow: 'group-hover:border-amber-400/40',
    border: 'border-amber-400/20',
    banner: '/images/dbfw-banner.jpg',
  },
  'riftbound': {
    bg: 'from-violet-950/40 via-purple-950/30 to-zinc-950/60',
    text: 'text-purple-400',
    glow: 'group-hover:border-purple-400/40',
    border: 'border-purple-400/20',
    banner: '/images/riftbound-banner.jpg',
  },
};

const defaultStyle = {
  bg: 'from-zinc-900/40 via-zinc-950/40 to-black/60',
  text: 'text-emerald-400',
  glow: 'group-hover:border-emerald-400/40',
  border: 'border-emerald-400/20',
  banner: '',
};

type ArchetypeData = {
  leaderCardId: string;
  leaderCardName: string;
  leaderCardImage: string;
  gameSlug: string;
  tops: number;
};

type GameRow = {
  id: string;
  slug: string;
  display_name: string;
};

type GlobalDeckRow = {
  leader_card_id: string | null;
  cards: {
    name: string | null;
    image_url: string | null;
    local_image_url: string | null;
  } | null;
  tournaments: {
    games: { id: string; slug: string } | null;
  } | null;
};

export default async function GlobalDecksHub() {
  let games: GameRow[] = [];
  let allDecks: GlobalDeckRow[] = [];

  try {
    games = await dbQuery<GameRow>(`
      SELECT id, slug, display_name
      FROM games
      WHERE is_active = true
    `);

    allDecks = await dbQuery<GlobalDeckRow>(`
      SELECT
        d.leader_card_id,
        CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object(
          'name', c.name,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url
        ) END AS cards,
        json_build_object(
          'games', json_build_object('id', g.id, 'slug', g.slug)
        ) AS tournaments
      FROM decks d
      LEFT JOIN cards c ON c.id = d.leader_card_id
      JOIN tournaments t ON t.id = d.tournament_id
      JOIN games g ON g.id = t.game_id
    `);
  } catch (error) {
    console.error('Failed to load global deck data:', error);
  }

  // Desired display order: One Piece, Pokémon, Dragon Ball Fusion World, Riftbound
  const order = ['one-piece', 'pokemon', 'dbfw', 'riftbound'];
  games.sort((a, b) => {
    const idxA = order.indexOf(a.slug);
    const idxB = order.indexOf(b.slug);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  // Aggregate Data in JS
  const groupedData: Record<string, Record<string, ArchetypeData>> = {};

  for (const deck of allDecks) {
    if (!deck.leader_card_id || !deck.cards) continue;

    const gameId = deck.tournaments?.games?.id;
    const gameSlug = deck.tournaments?.games?.slug;
    if (!gameId || !gameSlug) continue;

    if (!groupedData[gameId]) {
      groupedData[gameId] = {};
    }

    const leaderId = deck.leader_card_id;
    if (!groupedData[gameId][leaderId]) {
      groupedData[gameId][leaderId] = {
        leaderCardId: leaderId,
        leaderCardName: (deck.cards.name || 'Unknown Leader').replace(/\s*\(Alternate Art\)\s*/gi, '').replace(/\s*\(Parallel\)\s*/gi, ''),
        leaderCardImage: deck.cards.local_image_url || deck.cards.image_url || '',
        gameSlug: gameSlug,
        tops: 0,
      };
    }

    groupedData[gameId][leaderId].tops += 1;
  }

  // Convert the grouped data into sorted arrays per game
  const tierListsByGame: Record<string, ArchetypeData[]> = {};
  for (const gameId in groupedData) {
    const archetypes = Object.values(groupedData[gameId]);
    archetypes.sort((a, b) => b.tops - a.tops);
    tierListsByGame[gameId] = archetypes;
  }

  return (
    <div className="min-h-screen bg-[#060c18] text-white pt-24 pb-20 relative overflow-hidden">
      {/* Background ambient glow effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[350px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-10 right-1/4 w-[600px] h-[350px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
        
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Live Tournament Meta Tier Lists
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500 drop-shadow-md">
            Global Meta Tier List
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto font-medium">
            Explore the top-performing deck archetypes dominating competitive tournaments across all major TCG ecosystems.
          </p>
        </div>

        {/* 4-Column Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {games.map((game) => {
            const archetypes = tierListsByGame[game.id] || [];
            const style = gameStyles[game.slug] || defaultStyle;
            const maxTops = archetypes.length > 0 ? archetypes[0].tops : 1; 

            // Calculate safe skeletons count (never negative)
            const numSkeletons = Math.max(0, 8 - archetypes.length);
            const skeletons = Array.from({ length: numSkeletons });

            return (
              <div key={game.id} className="flex flex-col bg-zinc-950/40 border border-white/5 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
                
                {/* Game Category Header Banner */}
                <div className="relative h-44 flex flex-col items-center justify-end text-center p-5 overflow-hidden group bg-zinc-900 border-b border-white/5">
                  {/* Banner Image */}
                  {style.banner && (
                    <Image 
                      src={style.banner}
                      alt={game.display_name}
                      fill
                      className="object-cover object-top opacity-60 group-hover:scale-105 group-hover:opacity-85 transition-all duration-700 z-0"
                    />
                  )}
                  {/* Gradient Overlay for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060c18] via-[#060c18]/60 to-transparent z-10" />

                  <div className="relative z-20 flex flex-col items-center mt-auto w-full">
                    <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] mb-1 uppercase">
                      {game.display_name}
                    </h2>
                    <Link 
                      href={`/${game.slug}/decks`}
                      className={`text-xs font-black flex items-center justify-center gap-1 drop-shadow hover:underline transition-colors ${style.text}`}
                    >
                      View Tournaments <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Fixed Height Archetypes List */}
                <div className="relative h-[550px] lg:h-[750px]">
                  {/* Empty / Ingesting Overlay for games without decks */}
                  {archetypes.length === 0 && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-6 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
                        <Flame className="w-6 h-6 text-purple-400" />
                      </div>
                      <span className="font-black text-white tracking-wider uppercase text-sm mb-1">Circuit Launching Soon</span>
                      <p className="text-zinc-400 text-xs max-w-[200px]">Competitive tournament reporting begins with upcoming regional qualifiers.</p>
                    </div>
                  )}

                  <div className="h-full flex flex-col gap-2.5 p-3.5 bg-black/20 overflow-y-auto custom-scrollbar">
                    {archetypes.map((arch, index) => {
                      // Rank badge styling
                      const isRank1 = index === 0;
                      const isRank2 = index === 1;
                      const isRank3 = index === 2;

                      let rankBadgeColor = 'text-zinc-500 bg-white/[0.04] border-white/5';
                      if (isRank1) rankBadgeColor = 'text-amber-300 bg-amber-500/10 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]';
                      else if (isRank2) rankBadgeColor = 'text-slate-200 bg-slate-300/10 border-slate-300/30';
                      else if (isRank3) rankBadgeColor = 'text-amber-600 bg-amber-700/10 border-amber-700/30';

                      return (
                        <Link 
                          key={arch.leaderCardId} 
                          href={`/${arch.gameSlug}/decks/archetype/${arch.leaderCardId}`}
                          className={`group relative flex items-center h-[72px] px-3 py-2 rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden shrink-0 transition-all hover:bg-white/[0.06] ${style.glow}`}
                        >
                          {/* Rank Badge */}
                          <div className={`shrink-0 w-7 h-7 rounded-xl border flex items-center justify-center font-black text-xs mr-3 ${rankBadgeColor}`}>
                            {isRank1 ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : `#${index + 1}`}
                          </div>

                          {/* Leader Image */}
                          <div className="relative shrink-0 w-11 h-11 rounded-full overflow-hidden border border-white/10 shadow-md bg-black/80 mr-3">
                            {arch.leaderCardImage ? (
                              <Image
                                src={resolveCardImageUrl(arch.leaderCardImage) ?? arch.leaderCardImage}
                                alt={arch.leaderCardName}
                                fill
                                className="object-cover object-top group-hover:scale-110 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-zinc-500 font-bold bg-zinc-900">N/A</div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex-1 min-w-0 pr-1">
                            <h3 className="font-bold text-sm text-white truncate mb-1 group-hover:text-amber-300 transition-colors">
                              {arch.leaderCardName}
                            </h3>
                            
                            {/* Meta Share Bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700 ease-out"
                                  style={{ width: `${Math.max(8, (arch.tops / maxTops) * 100)}%` }}
                                />
                              </div>
                              <div className="shrink-0 flex items-center gap-1 text-[10px] uppercase font-black text-zinc-400">
                                <Trophy className="w-3 h-3 text-amber-500" />
                                {arch.tops} tops
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}

                    {/* Skeletons for empty slots */}
                    {skeletons.map((_, i) => (
                      <div 
                        key={`skeleton-${i}`} 
                        className="relative flex items-center h-[72px] px-3 py-2 rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden shrink-0 opacity-40"
                      >
                        <div className="shrink-0 w-7 h-7 rounded-xl bg-white/[0.02] mr-3" />
                        <div className="shrink-0 w-11 h-11 rounded-full bg-white/[0.02] mr-3" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3.5 bg-white/[0.03] rounded-md w-3/4" />
                          <div className="h-1.5 bg-white/[0.02] rounded-full w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.18);
        }
      `}} />
    </div>
  );
}
