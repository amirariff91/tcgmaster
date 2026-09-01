import { Metadata } from 'next';
import { dbQuery } from '@/lib/db/client';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, ChevronRight, Loader2 } from 'lucide-react';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';

export const metadata: Metadata = {
  title: 'Global Meta Tier List | TCGMaster',
  description: 'Explore the top winning deck archetypes across all your favorite Trading Card Games.',
};

export const revalidate = 60; // Revalidate every minute

// Map slugs to dynamic background gradients for the headers
const gameStyles: Record<string, { bg: string; text: string; banner: string }> = {
  'one-piece': {
    bg: 'from-orange-900/40 to-red-900/40 border-orange-500/30',
    text: 'text-orange-500',
    banner: '/images/one-piece-banner.jpg',
  },
  'pokemon': {
    bg: 'from-blue-900/40 to-yellow-900/40 border-blue-400/30',
    text: 'text-blue-400',
    banner: '/images/pokemon-banner.jpg',
  },
  'dbfw': {
    bg: 'from-amber-900/40 to-orange-900/40 border-amber-400/30',
    text: 'text-amber-400',
    banner: '/images/dbfw-banner.jpg',
  },
};

const defaultStyle = {
  bg: 'from-zinc-800/40 to-zinc-900/40 border-emerald-400/30',
  text: 'text-emerald-400',
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
  // 1. Fetch all active games
  let games: GameRow[] = [];
  let allDecks: GlobalDeckRow[] = [];

  try {
    games = await dbQuery<GameRow>(`
      SELECT id, slug, display_name
      FROM games
      WHERE is_active = true
    `);

    // JOIN the tournament/game relation and rebuild the nested embed shape.
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

  // Enforce strict order: One Piece (left), DBFW (middle), Pokemon (right)
  const order = ['one-piece', 'dbfw', 'pokemon'];
  games.sort((a, b) => {
    const idxA = order.indexOf(a.slug);
    const idxB = order.indexOf(b.slug);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  // 2. Aggregate Data in JS
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
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-indigo-500/10 rounded-[100%] blur-[120px] pointer-events-none" />

      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500 drop-shadow-sm">
            Global Meta Tier List
          </h1>
          <p className="text-xl text-zinc-400 font-medium">
            Explore the top-performing deck archetypes dominating the competitive scene across all your favorite games.
          </p>
        </div>

        {/* 3-Column Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {games.map((game) => {
            const archetypes = tierListsByGame[game.id] || [];
            const style = gameStyles[game.slug] || defaultStyle;
            const maxTops = archetypes.length > 0 ? archetypes[0].tops : 1; 

            // Calculate how many skeleton slots we need to reach 10
            const numSkeletons = 10 - archetypes.length;
            const skeletons = Array.from({ length: numSkeletons });

            return (
              <div key={game.id} className="flex flex-col">
                
                {/* Game Category Header Banner */}
                <div className="relative h-48 flex flex-col items-center justify-end text-center p-6 rounded-t-3xl border-t border-x border-white/5 overflow-hidden group bg-zinc-900">
                  {/* Banner Image */}
                  {style.banner && (
                    <Image 
                      src={style.banner}
                      alt={game.display_name}
                      fill
                      className="object-cover object-top opacity-70 group-hover:scale-110 group-hover:opacity-100 transition-all duration-700 z-0"
                    />
                  )}
                  {/* Gradient Overlay for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060c18] via-[#060c18]/50 to-transparent z-10" />

                  <div className="relative z-20 flex flex-col items-center mt-auto w-full">
                    <h2 className="text-3xl font-black tracking-tight text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] mb-1 uppercase">
                      {game.display_name}
                    </h2>
                    <Link 
                      href={`/${game.slug}/decks`}
                      className={`text-sm font-black flex items-center justify-center gap-1 drop-shadow-lg hover:underline transition-colors ${style.text}`}
                    >
                      View Tournaments <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                {/* Fixed Height Archetypes List (Top 10) */}
                {/* lg:h-[900px] provides a permanent, flawless layout column on desktop, while h-[450px] prevents massive scrolling on mobile */}
                <div className="relative h-[450px] lg:h-[900px]">
                  {/* Coming Soon Overlay */}
                  {game.slug === 'pokemon' && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-b-3xl">
                      <div className="bg-[#060c18]/90 border border-indigo-500/30 px-6 py-3 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.2)] flex items-center justify-center transform -translate-y-12">
                        <span className="font-bold text-white tracking-wide uppercase text-sm">Coming Soon</span>
                      </div>
                    </div>
                  )}

                  <div className="h-full flex flex-col gap-3 p-4 bg-black/20 border border-white/5 rounded-b-3xl overflow-y-auto custom-scrollbar">
                    {archetypes.map((arch, index) => (
                      <Link 
                        key={arch.leaderCardId} 
                        href={`/${arch.gameSlug}/decks/archetype/${arch.leaderCardId}`}
                        className={`group relative flex items-center h-[76px] p-3 rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden shrink-0 transition-all ${game.slug !== 'pokemon' ? 'hover:bg-white/10 hover:border-white/20' : 'opacity-30 pointer-events-none'}`}
                      >
                      {/* Rank Number Background */}
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 text-6xl font-black italic text-white/[0.02] group-hover:text-white/[0.04] transition-colors pointer-events-none z-0">
                        #{index + 1}
                      </div>

                      {/* Leader Image */}
                      <div className="relative z-10 shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 shadow-lg bg-black/80 mr-4">
                        {arch.leaderCardImage ? (
                          <Image
                            src={resolveCardImageUrl(arch.leaderCardImage) ?? arch.leaderCardImage}
                            alt={arch.leaderCardName}
                            fill
                            className="object-cover object-top group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500 font-bold bg-zinc-900">N/A</div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="relative z-10 flex-1 min-w-0 pr-2">
                        <h3 className="font-bold text-base text-white truncate mb-1.5 group-hover:text-amber-400 transition-colors">
                          {arch.leaderCardName}
                        </h3>
                        
                        {/* Progress Bar for Meta Share */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className={`h-full bg-gradient-to-r ${style.text.replace('text', 'from').replace('-500', '-600')} to-amber-400 rounded-full transition-all duration-1000 ease-out`}
                              style={{ width: `${(arch.tops / maxTops) * 100}%` }}
                            />
                          </div>
                          <div className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider font-black text-zinc-400">
                            <Trophy className="w-3 h-3 text-amber-500" />
                            {arch.tops}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {/* Skeletons to maintain fixed 10-item layout */}
                  {skeletons.map((_, i) => (
                    <div 
                      key={`skeleton-${i}`} 
                      className="relative flex items-center h-[76px] p-3 rounded-2xl border border-white/5 bg-white/[0.01] overflow-hidden shrink-0 opacity-50"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                      
                      <div className="shrink-0 w-12 h-12 rounded-full border-2 border-white/5 bg-white/[0.02] mr-4" />
                      
                      <div className="flex-1 space-y-3">
                        <div className="h-4 bg-white/[0.03] rounded-md w-3/4" />
                        <div className="h-1.5 bg-white/[0.02] rounded-full w-full" />
                      </div>
                    </div>
                  ))}
                  
                  {archetypes.length === 0 && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex flex-col items-center text-center">
                      <Loader2 className="w-8 h-8 text-zinc-600 animate-spin mb-3" />
                      <p className="text-zinc-500 font-bold text-sm">Waiting for Tournament Data...</p>
                      <p className="text-zinc-600 text-xs mt-1">Scraper integration pending</p>
                    </div>
                  )}

                </div>
              </div>

              </div>
            );
          })}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.2);
        }
      `}} />
    </div>
  );
}
