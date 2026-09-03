import { Metadata } from 'next';
import { connection } from 'next/server';
import { dbQuery } from '@/lib/db/client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Calendar, Users, ChevronRight, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';
import { FormattedPrice } from '@/components/ui/formatted-price';

export const revalidate = 60;

// Next 16 only puts a dynamic segment on the ISR path when it declares
// generateStaticParams. Prerender nothing; generate and cache on first request.
export async function generateStaticParams() {
  return [];
}

interface ArchetypePageProps {
  params: Promise<{
    game: string;
    id: string;
  }>;
}

type CardImageRecord = {
  name: string | null;
  image_url: string | null;
  local_image_url: string | null;
};

type ArchetypeDeck = {
  id: string;
  placement: string | null;
  total_price: number | null;
  player_name: string | null;
  tournaments: {
    name: string | null;
    date: string | null;
    num_players: number | null;
    source_url: string | null;
  } | null;
};

type StandardDeckCard = {
  count: number;
  cards: CardImageRecord | null;
};

export async function generateMetadata({ params }: ArchetypePageProps): Promise<Metadata> {
  const { id } = await params;
  let leaderName = 'Archetype';
  try {
    const rows = await dbQuery<{ name: string | null }>(
      'SELECT name FROM cards WHERE id = $1 LIMIT 1',
      [id],
    );
    leaderName = rows[0]?.name || leaderName;
  } catch (error) {
    // Metadata is best-effort so a build-time DB outage does not fail the route.
    console.error('Failed to load archetype metadata:', error);
    await connection();
  }
  
  return {
    title: `${leaderName} Decks & Meta | TCGMaster`,
    description: `View the top-performing ${leaderName} decklists and meta analysis.`,
  };
}

export default async function ArchetypePage({ params }: ArchetypePageProps) {
  const { game, id } = await params;
  let leaderCard: CardImageRecord | null = null;
  let decksData: ArchetypeDeck[] = [];

  try {
    // Fetch the Leader Card
    const leaderRows = await dbQuery<CardImageRecord>(`
      SELECT name, image_url, local_image_url
      FROM cards
      WHERE id = $1
      LIMIT 1
    `, [id]);
    leaderCard = leaderRows[0] || null;

    // Fetch all winning decks that use this Leader and rebuild the tournament embed.
    decksData = await dbQuery<ArchetypeDeck>(`
      SELECT
        d.id,
        d.placement,
        d.total_price::float8 AS total_price,
        d.player_name,
        json_build_object(
          'name', t.name,
          'date', t.date,
          'num_players', t.num_players,
          'source_url', t.source_url
        ) AS tournaments
      FROM decks d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.leader_card_id = $1
      ORDER BY d.created_at DESC
    `, [id]);
  } catch (error) {
    console.error('Failed to load archetype:', error);
    return notFound();
  }

  if (!leaderCard) {
    notFound();
  }

  const decks = decksData;

  // Sort decks by the actual date of the tournament (most recent first)
  decks.sort((a, b) => {
    const dateA = new Date(a.tournaments?.date || 0).getTime();
    const dateB = new Date(b.tournaments?.date || 0).getTime();
    return dateB - dateA;
  });

  // Calculate Aggregates
  const totalTops = decks.length;
  let totalPriceSum = 0;
  let decksWithPrice = 0;

  decks.forEach(deck => {
    if (deck.total_price) {
      totalPriceSum += deck.total_price;
      decksWithPrice++;
    }
  });

  const leaderCardRecord = leaderCard as unknown as CardImageRecord;
  const rawAvgPrice = decksWithPrice > 0 ? totalPriceSum / decksWithPrice : null;
  const leaderImage = resolveCardImageUrl(
    leaderCardRecord.local_image_url || leaderCardRecord.image_url,
  );

  // Find the standard build (most recent 1st place deck, or just most recent deck)
  const standardDeck = decks.find(d => d.placement === '1') || decks[0];
  
  let standardCards: StandardDeckCard[] = [];
  if (standardDeck) {
    try {
      const cardRows = await dbQuery<{ count: number; cards: StandardCardRecord }>(`
        SELECT
          dc.count,
          json_build_object(
            'name', c.name,
            'image_url', c.image_url,
            'local_image_url', c.local_image_url
          ) AS cards
        FROM deck_cards dc
        JOIN cards c ON c.id = dc.card_id
        WHERE dc.deck_id = $1
        ORDER BY c.name ASC
      `, [standardDeck.id]);
      standardCards = cardRows;
    } catch (e) {
      console.error('Failed to load standard deck cards:', e);
    }
  }

  return (
    <div className="min-h-screen bg-[#060c18] text-white pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-6xl space-y-12">
        
        {/* Navigation / Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Link href="/decks" className="hover:text-white transition-colors">Decks</Link>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
          <Link href={`/${game}/decks`} className="capitalize hover:text-white transition-colors">
            {game.replace('-', ' ')}
          </Link>
          <ChevronRight className="w-4 h-4 text-zinc-600" />
          <span className="text-zinc-200 font-semibold">{leaderCardRecord.name}</span>
        </div>

        {/* Hero Section (Compact & Responsive on Mobile) */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 sm:gap-6 md:gap-10 bg-[#080e1e]/90 p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl">
          
          <div className="flex gap-4 sm:gap-6 md:gap-8 items-start w-full md:w-auto">
            {/* Leader Card Image */}
            <div className="shrink-0 relative w-24 sm:w-32 md:w-56 aspect-[2.5/3.5] rounded-xl md:rounded-2xl overflow-hidden shadow-xl border-2 md:border-4 border-white/10 transform hover:scale-105 transition-transform duration-500 bg-black/50">
              {leaderImage ? (
                <Image 
                  src={leaderImage}
                  alt={leaderCardRecord.name || 'Leader'}
                  fill
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 font-bold text-xs">No Image</div>
              )}
            </div>

            {/* Leader Stats & Details */}
            <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
                Meta Archetype
              </div>
              
              <h1 className="text-xl sm:text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow-md leading-tight line-clamp-2 sm:line-clamp-none">
                {leaderCardRecord.name}
              </h1>
              
              <p className="text-xs sm:text-sm md:text-base text-zinc-400 font-medium max-w-2xl line-clamp-2">
                Explore the top-performing decklists and tournament results for this archetype.
              </p>

              {/* Stats Bar */}
              <div className="flex items-center gap-2 sm:gap-3 pt-1">
                <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-md">
                  <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-sm sm:text-lg md:text-xl font-black text-white leading-none">{totalTops}</div>
                    <div className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Total Tops</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-3 py-1.5 sm:px-4 sm:py-2 backdrop-blur-md">
                  <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-sm sm:text-lg md:text-xl font-black text-emerald-400 leading-none">
                      <FormattedPrice price={rawAvgPrice} />
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Avg Cost</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Standard Build (Visual Grid) */}
        {standardCards.length > 0 && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 sm:gap-3">
                  <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                  Standard Build
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-0.5 sm:mt-1">
                  Based on a recent top-performing decklist ({standardDeck?.player_name})
                </p>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl md:rounded-3xl p-3 sm:p-5 md:p-6 shadow-2xl">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3 md:gap-4">
                {standardCards.map((dc, i) => {
                  const card = dc.cards;
                  const imgUrl = resolveCardImageUrl(card?.local_image_url || card?.image_url);
                  
                  return (
                    <div key={i} className="relative group">
                      <div className="relative aspect-[2.5/3.5] rounded-lg sm:rounded-xl overflow-hidden border border-white/10 shadow-md transform group-hover:scale-105 transition-transform duration-300">
                        {imgUrl ? (
                          <Image 
                            src={imgUrl} 
                            alt={card?.name || 'Card'}
                            fill 
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-center text-zinc-500 p-1">
                            {card?.name || 'Unknown'}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-orange-600 text-white text-[10px] sm:text-xs font-black px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-full shadow-lg border-2 border-[#060c18] z-10">
                        x{dc.count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 sm:mt-6 flex justify-end">
                 <Link
                    href={`/${game}/decks/${standardDeck?.id}`}
                    className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <span>View Full Decklist Details</span>
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                 </Link>
              </div>
            </div>
          </div>
        )}

        {/* Recent Decklists Table */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 sm:gap-3">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
              Recent Winning Decklists
            </h2>
            <span className="text-xs sm:text-sm font-bold text-zinc-400 bg-white/5 px-2.5 py-1 rounded-lg">
              {decks.length} Decks Found
            </span>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] sm:text-xs uppercase tracking-wider text-zinc-400 font-bold">
                    <th className="px-3.5 sm:px-6 py-3 sm:py-4 whitespace-nowrap">Player</th>
                    <th className="px-3.5 sm:px-6 py-3 sm:py-4 whitespace-nowrap">Placement</th>
                    <th className="px-3.5 sm:px-6 py-3 sm:py-4 whitespace-nowrap">Tournament</th>
                    <th className="px-3.5 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {decks.map((deck) => (
                    <tr key={deck.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black shrink-0">
                            {deck.player_name ? deck.player_name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <span className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                            {deck.player_name || 'Unknown Player'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-500 font-bold text-sm border border-amber-500/20 shadow-inner">
                          <Trophy className="w-3.5 h-3.5" />
                          {deck.placement} Place
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-200 truncate max-w-[250px] sm:max-w-md">
                            {deck.tournaments?.name || 'Unknown Event'}
                          </span>
                          <span className="text-xs font-semibold text-zinc-500 mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {deck.tournaments?.date ? format(new Date(deck.tournaments.date), 'MMM d, yyyy') : 'Unknown Date'}
                            <span className="mx-1">•</span>
                            <Users className="w-3 h-3" />
                            {deck.tournaments?.num_players || 0} Players
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/${game}/decks/${deck.id}`}
                          className="inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-indigo-600/80 hover:bg-indigo-500 rounded-xl transition-colors shadow-lg hover:shadow-indigo-500/25 border border-indigo-500/50"
                        >
                          View List
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {decks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 font-medium bg-white/[0.01]">
                        No decklists found for this archetype.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
