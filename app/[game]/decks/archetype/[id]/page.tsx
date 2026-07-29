import { Metadata } from 'next';
// Cookie-free anon client keeps this route statically renderable (see card page).
import { createPublicClient } from '@/lib/supabase/client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Trophy, Calendar, Users, ChevronRight, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';

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
  const supabase = createPublicClient();
  const { data: leader } = await supabase.from('cards').select('name').eq('id', id).single();
  const leaderName = (leader as { name: string | null } | null)?.name || 'Archetype';
  
  return {
    title: `${leaderName} Decks & Meta | TCGMaster`,
    description: `View the top-performing ${leaderName} decklists and meta analysis.`,
  };
}

export default async function ArchetypePage({ params }: ArchetypePageProps) {
  const { game, id } = await params;
  const supabase = createPublicClient();

  // Fetch the Leader Card
  const { data: leaderCard } = await supabase
    .from('cards')
    .select('*')
    .eq('id', id)
    .single();

  if (!leaderCard) {
    notFound();
  }

  // Fetch all winning decks that use this Leader
  const { data: decksData } = await supabase
    .from('decks')
    .select('*, tournaments!inner(name, date, num_players, source_url)')
    .eq('leader_card_id', id)
    .order('created_at', { ascending: false });

  const decks = (decksData ?? []) as unknown as ArchetypeDeck[];

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
  const averagePrice = decksWithPrice > 0 ? (totalPriceSum / decksWithPrice).toFixed(2) : 'N/A';
  const leaderImage = resolveCardImageUrl(
    leaderCardRecord.local_image_url || leaderCardRecord.image_url,
  );

  // Find the standard build (most recent 1st place deck, or just most recent deck)
  const standardDeck = decks.find(d => d.placement === '1') || decks[0];
  
  let standardCards: StandardDeckCard[] = [];
  if (standardDeck) {
    const { data } = await supabase
      .from('deck_cards')
      .select('count, cards(name, image_url, local_image_url)')
      .eq('deck_id', standardDeck.id);
    standardCards = (data ?? []) as unknown as StandardDeckCard[];
  }

  return (
    <div className="min-h-screen bg-[#060c18] text-white pt-24 pb-20 relative overflow-hidden">
      
      {/* Cinematic Hero Background */}
      <div className="absolute top-0 inset-x-0 h-[500px] overflow-hidden opacity-20 pointer-events-none">
        {leaderImage && (
          <Image 
            src={leaderImage}
            alt="Hero Background"
            fill
            className="object-cover blur-[80px] transform scale-150"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060c18]/80 to-[#060c18]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        
        {/* Breadcrumb / Back Navigation */}
        <nav className="flex items-center gap-2 text-sm text-zinc-400 font-medium">
          <Link href="/decks" className="hover:text-white transition-colors">Global Meta</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/${game}/decks`} className="hover:text-white transition-colors capitalize">{game.replace('-', ' ')}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-zinc-100">{leaderCardRecord.name}</span>
        </nav>

        {/* Hero Section */}
        <div className="flex flex-col md:flex-row items-center gap-10">
          {/* Leader Card Image */}
          <div className="shrink-0 relative w-40 h-[220px] md:w-64 md:h-88 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 transform hover:scale-105 transition-transform duration-500 mx-auto md:mx-0">
            {leaderImage ? (
              <Image 
                src={leaderImage}
                alt={leaderCardRecord.name || 'Leader'}
                width={256}
                height={352}
                className="w-full h-auto object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 font-bold">No Image</div>
            )}
          </div>

          {/* Leader Stats & Details */}
          <div className="flex-1 space-y-6 text-center md:text-left">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold tracking-widest uppercase mb-4">
                Meta Archetype
              </div>
              <h1 className="text-3xl md:text-6xl font-black tracking-tight text-white drop-shadow-md mb-2">
                {leaderCardRecord.name}
              </h1>
              <p className="text-xl text-zinc-400 font-medium max-w-2xl">
                Explore the top-performing decklists and tournament results for this archetype.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-4">
              <div className="flex flex-col items-center justify-center bg-black/40 border border-white/5 rounded-2xl p-4 md:p-6 min-w-[120px] md:min-w-[140px] shadow-lg backdrop-blur-md">
                <Trophy className="w-6 h-6 text-amber-400 mb-2" />
                <span className="text-2xl md:text-3xl font-black text-white">{totalTops}</span>
                <span className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Tops</span>
              </div>

              <div className="flex flex-col items-center justify-center bg-black/40 border border-white/5 rounded-2xl p-4 md:p-6 min-w-[120px] md:min-w-[140px] shadow-lg backdrop-blur-md">
                <Coins className="w-6 h-6 text-emerald-400 mb-2" />
                <span className="text-2xl md:text-3xl font-black text-white">{averagePrice !== 'N/A' ? `$${averagePrice}` : 'N/A'}</span>
                <span className="text-[10px] md:text-xs font-bold text-zinc-500 uppercase tracking-widest">Avg Cost</span>
              </div>
            </div>
          </div>
        </div>

        {/* Standard Build (Visual Grid) */}
        {standardCards.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  Standard Build
                </h2>
                <p className="text-sm text-zinc-400 font-medium mt-1">
                  Based on a recent top-performing decklist ({standardDeck?.player_name})
                </p>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-2xl">
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
                {standardCards.map((dc, i) => {
                  const card = dc.cards;
                  const imgUrl = resolveCardImageUrl(card?.local_image_url || card?.image_url);
                  
                  return (
                    <div key={i} className="relative group">
                      <div className="relative aspect-[2.5/3.5] rounded-xl overflow-hidden border border-white/10 shadow-lg transform group-hover:scale-105 transition-transform duration-300">
                        {imgUrl ? (
                          <Image 
                            src={imgUrl} 
                            alt={card?.name || 'Card'}
                            fill 
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs text-center text-zinc-500 p-2">
                            {card?.name || 'Unknown'}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg border-2 border-[#060c18] z-10">
                        x{dc.count}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-end">
                 <Link
                    href={`/${game}/decks/${standardDeck?.id}`}
                    className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View Full Decklist Details <ChevronRight className="w-4 h-4" />
                 </Link>
              </div>
            </div>
          </div>
        )}

        {/* Recent Decklists Table */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
              <Calendar className="w-6 h-6 text-indigo-400" />
              Recent Winning Decklists
            </h2>
            <span className="text-sm font-bold text-zinc-500 bg-white/5 px-3 py-1 rounded-lg">
              {decks.length} Decks Found
            </span>
          </div>

          <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-xs uppercase tracking-wider text-zinc-500 font-bold">
                    <th className="px-6 py-4 whitespace-nowrap">Player</th>
                    <th className="px-6 py-4 whitespace-nowrap">Placement</th>
                    <th className="px-6 py-4 whitespace-nowrap">Tournament</th>
                    <th className="px-6 py-4 whitespace-nowrap text-right">Action</th>
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
