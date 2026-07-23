import { Metadata } from 'next';
import { createPublicClient as createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { Trophy, Calendar, Users, Target } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Top Decks & Tournaments | TCGMaster',
  description: 'View the latest winning decklists and tournament results.',
};

export const revalidate = 900; // Revalidate every 15 minutes to keep meta fresh

export default async function DecksPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  const supabase = createClient();

  // 1. Fetch recent tournaments
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*, games!inner(slug)')
    .eq('games.slug', game)
    .order('date', { ascending: false })
    .limit(10);

  // 2. Fetch top decks with their leader cards
  const { data: decks } = await supabase
    .from('decks')
    .select('*, tournaments!inner(games!inner(slug)), cards(name, image_url, local_image_url)')
    .eq('tournaments.games.slug', game)
    .in('placement', ['1st', '1', '2nd', '2', '3rd', '3', '4th', '4'])
    .order('created_at', { ascending: false })
    .limit(24);

  return (
    <div className="min-h-screen bg-[#0b1329] text-white pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600 mb-2">
              COMPETITIVE META
            </h1>
            <p className="text-zinc-400 text-lg">
              The top performing decks from recent tournaments around the world.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-400 bg-emerald-400/10 px-4 py-2 rounded-full border border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
            <Target className="w-4 h-4 animate-pulse" />
            Live Sync Active
          </div>
        </div>

        {/* Top Decks Grid */}
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3 mb-6 text-white">
            <Trophy className="w-6 h-6 text-amber-500" />
            Recent Winning Decks
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {(decks as any[])?.map((deck) => (
              <Link key={deck.id} href={`/${game}/decks/${deck.id}`}>
                <Card className="group overflow-hidden rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/20 h-full flex flex-col">
                  {/* Leader Image Header */}
                  <div className="relative h-32 w-full bg-black/50 overflow-hidden">
                    {(deck.cards?.image_url || deck.cards?.local_image_url) ? (
                      <Image
                        src={deck.cards.local_image_url || deck.cards.image_url}
                        alt={deck.cards.name}
                        fill
                        className="object-cover object-top opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1329] to-transparent" />
                    
                    {/* Placement Badge */}
                    <div className="absolute top-3 right-3 px-3 py-1 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-xs font-bold flex items-center gap-1">
                      {deck.placement.includes('1') && <span className="text-yellow-400">🥇</span>}
                      {deck.placement.includes('2') && <span className="text-zinc-400">🥈</span>}
                      {deck.placement.includes('3') && <span className="text-orange-700">🥉</span>}
                      {deck.placement}
                    </div>
                  </div>

                  <CardContent className="flex-1 p-5 pt-4 flex flex-col justify-between z-10 relative bg-[#0b1329]/95 backdrop-blur-md -mt-6 mx-3 mb-3 rounded-xl border border-white/10 shadow-xl">
                    <div>
                      <h3 className="font-bold text-lg mb-1 truncate text-orange-50">
                        {deck.cards?.name || 'Unknown Leader'}
                      </h3>
                      <p className="text-sm font-medium text-orange-400/80 mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        {deck.player_name}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-between items-center mt-auto">
                      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Deck Value</span>
                      {deck.total_price ? (
                        <FormattedPrice price={deck.total_price} className="font-black text-emerald-400 text-lg" />
                      ) : (
                        <span className="text-sm font-bold text-zinc-600">Syncing...</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {(!decks || decks.length === 0) && (
              <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                <Trophy className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-zinc-400">No Decks Found</h3>
                <p className="text-zinc-500 mt-2">Tournaments are currently being synced...</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Tournaments Table */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold flex items-center gap-3 mb-6 text-white">
            <Calendar className="w-6 h-6 text-blue-500" />
            Recent Tournaments
          </h2>
          
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-xs uppercase tracking-widest text-zinc-400 border-b border-white/10">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Tournament Name</th>
                    <th className="p-4 font-semibold">Format</th>
                    <th className="p-4 font-semibold text-right">Players</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-sm">
                  {(tournaments as any[])?.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4 text-zinc-400 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-medium text-white">
                        <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">
                          {t.name}
                        </a>
                      </td>
                      <td className="p-4 text-zinc-400">
                        <span className="bg-zinc-800/50 px-2 py-1 rounded-md text-xs border border-zinc-700/50 group-hover:border-zinc-500 transition-colors">{t.format}</span>
                      </td>
                      <td className="p-4 text-right font-medium text-zinc-300 flex items-center justify-end gap-1.5">
                        <Users className="w-4 h-4 text-zinc-500" />
                        {t.num_players}
                      </td>
                    </tr>
                  ))}
                  {(!tournaments || tournaments.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-500">
                        No tournaments recorded yet. Waiting for sync...
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
