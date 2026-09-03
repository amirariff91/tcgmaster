import { Metadata } from 'next';
import { dbQuery } from '@/lib/db/client';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { Trophy, ChevronLeft, ExternalLink, Copy, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';

export const metadata: Metadata = {
  title: 'Deck Details | TCGMaster',
};

export const revalidate = 60; // Revalidate every minute

// Next 16 only puts a dynamic segment on the ISR path when it declares
// generateStaticParams. Prerender nothing; generate and cache on first request.
export async function generateStaticParams() {
  return [];
}

type DeckCardImage = {
  name: string;
  image_url: string | null;
  local_image_url: string | null;
};

type DeckCardEntry = {
  count: number;
  raw_card_name: string | null;
  raw_card_id_string: string | null;
  cards: DeckCardImage | null;
};

type DeckDetail = {
  placement: string;
  player_name: string | null;
  source_url: string | undefined;
  total_price: number | null;
  tournaments: { name: string | null } | null;
  leader_card: DeckCardImage | null;
  deck_cards: DeckCardEntry[] | null;
};

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ game: string; id: string }>;
}) {
  const { game, id } = await params;
  let deck: DeckDetail | null = null;
  try {
    const rows = await dbQuery(`
      SELECT
        d.placement,
        d.player_name,
        d.source_url,
        d.total_price::float8 AS total_price,
        json_build_object('name', t.name) AS tournaments,
        (
          SELECT json_build_object(
            'name', leader.name,
            'image_url', leader.image_url,
            'local_image_url', leader.local_image_url
          )
          FROM cards leader
          WHERE leader.id = d.leader_card_id
        ) AS leader_card,
        COALESCE((
          SELECT json_agg(json_build_object(
            'count', dc.count,
            'raw_card_name', dc.raw_card_name,
            'raw_card_id_string', dc.raw_card_id_string,
            'cards', CASE WHEN card.id IS NULL THEN NULL ELSE json_build_object(
              'name', card.name,
              'image_url', card.image_url,
              'local_image_url', card.local_image_url
            ) END
          ) ORDER BY dc.id)
          FROM deck_cards dc
          LEFT JOIN cards card ON card.id = dc.card_id
          WHERE dc.deck_id = d.id
        ), '[]'::json) AS deck_cards
      FROM decks d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = $1
      LIMIT 1
    `, [id]);
    deck = (rows[0] as DeckDetail | undefined) || null;
  } catch (error) {
    console.error('Failed to load deck:', error);
    return notFound();
  }

  if (!deck) return notFound();

  // Group cards by type if available, otherwise just dump them
  const leaderCard = deck.leader_card;
  const mainDeckCards = deck.deck_cards ?? [];

  return (
    <div className="min-h-screen bg-[#0b1329] text-white pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Back Navigation */}
        <Link 
          href={`/${game}/decks`}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Meta
        </Link>

        {/* Header Hero Section (Compact & Responsive on Mobile) */}
        <div className="relative rounded-2xl md:rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d1834] p-4 sm:p-6 md:p-10">
          {/* Background Leader Blur */}
          {(leaderCard?.image_url || leaderCard?.local_image_url) && (
            <div className="absolute inset-0 opacity-20 pointer-events-none">
               <Image
                  src={resolveCardImageUrl(leaderCard.local_image_url || leaderCard.image_url) ?? ''}
                  alt="Background"
                  fill
                  className="object-cover blur-3xl scale-125"
                />
            </div>
          )}

          <div className="relative z-10 flex flex-col md:flex-row gap-4 sm:gap-6 md:gap-8 items-start md:items-center">
            
            {/* Top Row on Mobile: Leader Image + Core Details Side-by-Side */}
            <div className="flex gap-4 sm:gap-5 md:gap-8 items-start w-full md:w-auto">
              {/* Leader Image */}
              <div className="shrink-0 rounded-xl md:rounded-2xl overflow-hidden shadow-xl border-2 md:border-4 border-white/10 w-24 sm:w-32 md:w-52 aspect-[2.5/3.5] bg-black/50">
                 {(leaderCard?.image_url || leaderCard?.local_image_url) ? (
                    <Image
                      src={resolveCardImageUrl(leaderCard.local_image_url || leaderCard.image_url) ?? ''}
                      alt={leaderCard.name || 'Leader'}
                      width={224}
                      height={314}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold p-2 text-center text-xs">
                      Leader Not Found
                    </div>
                  )}
              </div>

              {/* Mobile Core Info (Adjacent to Image) */}
              <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2 md:space-y-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-[11px] sm:text-xs font-semibold text-zinc-300 max-w-full">
                  <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{deck.placement} Place at {deck.tournaments?.name || 'Tournament'}</span>
                </div>
                
                <h1 className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-black italic tracking-tight text-white drop-shadow-md leading-tight line-clamp-2 sm:line-clamp-none">
                  {leaderCard?.name || 'Unknown Leader'} Deck
                </h1>
                
                <p className="text-xs sm:text-sm md:text-lg text-zinc-300 font-medium flex items-center gap-1.5">
                  <span>Piloted by</span>
                  <span className="text-emerald-400 font-bold truncate">{deck.player_name || 'Anonymous'}</span>
                </p>

                {/* Desktop/Tablet Action Buttons */}
                <div className="hidden md:flex flex-wrap gap-3 pt-2">
                  <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                    Export Deck
                  </button>
                  <a 
                    href={deck.source_url ?? undefined}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 px-4 py-2 rounded-xl text-xs font-bold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View Source
                  </a>
                </div>
              </div>
            </div>

            {/* Mobile Action Buttons Bar */}
            <div className="flex md:hidden items-center gap-2 w-full pt-1">
              <button className="flex-1 flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 py-2 px-3 rounded-lg text-xs font-bold transition-colors">
                <Copy className="w-3.5 h-3.5" />
                Export
              </button>
              <a 
                href={deck.source_url ?? undefined}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 bg-black/40 hover:bg-black/60 border border-white/10 py-2 px-3 rounded-lg text-xs font-bold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Source
              </a>
            </div>

            {/* Total Price Widget */}
            <div className="w-full md:w-auto md:shrink-0 bg-black/40 backdrop-blur-md rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-6 border border-white/10 flex md:flex-col items-center justify-between md:justify-center gap-3 min-w-[180px] md:min-w-[200px]">
              <div className="text-left md:text-center">
                <p className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">Total Deck Value</p>
                {deck.total_price ? (
                  <FormattedPrice price={deck.total_price} className="text-xl sm:text-2xl md:text-4xl font-black text-emerald-400 font-mono" />
                ) : (
                  <span className="text-base sm:text-lg font-bold text-zinc-500">Syncing...</span>
                )}
              </div>
              <button className="flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors shrink-0">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Buy on TCGPlayer</span>
              </button>
            </div>

          </div>
        </div>

        {/* Decklist Visual Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold border-b border-white/10 pb-4">Main Deck</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {mainDeckCards.map((c, i) => {
              const card = c.cards;
              return (
                <div key={i} className="relative group rounded-xl overflow-hidden shadow-lg border border-white/5 bg-black/20 aspect-[2.5/3.5]">
                  {(card?.image_url || card?.local_image_url) ? (
                    <Image
                      src={resolveCardImageUrl(card.local_image_url || card.image_url) ?? ''}
                      alt={card.name || 'Card'}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center text-xs text-zinc-500 font-bold bg-zinc-900">
                       <span className="text-orange-500/50 mb-1">{c.raw_card_id_string}</span>
                       {c.raw_card_name}
                    </div>
                  )}
                  {/* Quantity Badge */}
                  <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md text-emerald-400 font-black text-sm px-2 py-0.5 rounded-md border border-white/20 shadow-xl">
                    x{c.count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
