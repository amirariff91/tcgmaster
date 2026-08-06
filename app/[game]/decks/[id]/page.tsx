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

        {/* Header Hero Section */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0d1834] p-8 md:p-12">
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

          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
            {/* Leader Image */}
            <div className="shrink-0 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10 w-40 md:w-56 aspect-[2.5/3.5] bg-black/50">
               {(leaderCard?.image_url || leaderCard?.local_image_url) ? (
                  <Image
                    src={resolveCardImageUrl(leaderCard.local_image_url || leaderCard.image_url) ?? ''}
                    alt={leaderCard.name || 'Leader'}
                    width={224}
                    height={314}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 font-bold p-4 text-center">
                    Leader Not Found
                  </div>
                )}
            </div>

            {/* Deck Info */}
            <div className="flex-1 space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-sm font-medium">
                <Trophy className="w-4 h-4 text-amber-500" />
                {deck.placement} Place at {deck.tournaments?.name}
              </div>
              
              <h1 className="text-4xl md:text-5xl font-black italic tracking-tight text-white drop-shadow-lg">
                {leaderCard?.name || 'Unknown Leader'} Deck
              </h1>
              
              <p className="text-xl text-zinc-300 font-medium flex items-center gap-2">
                Piloted by <span className="text-emerald-400">{deck.player_name}</span>
              </p>

              <div className="pt-4 flex flex-wrap gap-4">
                <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-xl font-bold transition-colors">
                  <Copy className="w-4 h-4" />
                  Export Deck
                </button>
                <a 
                  href={deck.source_url ?? undefined}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 px-6 py-3 rounded-xl font-bold transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Source
                </a>
              </div>
            </div>

            {/* Total Price Widget */}
            <div className="shrink-0 bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-center min-w-[200px]">
              <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest mb-2">Total Deck Value</p>
              {deck.total_price ? (
                <FormattedPrice price={deck.total_price} className="text-4xl font-black text-emerald-400" />
              ) : (
                <span className="text-2xl font-bold text-zinc-500">Syncing...</span>
              )}
              <button className="mt-4 w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold transition-colors">
                <ShoppingCart className="w-4 h-4" />
                Buy on TCGPlayer
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
