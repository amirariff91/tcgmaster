import { createServerClient } from '@/lib/supabase/server';
import { SourcesTable } from './sources-table';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SourcesDashboardPage() {
  const supabase = await createServerClient();
  
  // Basic sanity check for auth - in a real app you'd check roles
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect('/');
  }

  // Fetch top 200 expensive Japanese OP cards
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, slug, name, number, snkrdunk_url, pricecharting_url, yuyutei_url, price_cache_ttl, curation_status')
    .like('slug', 'op-%-ja')
    .order('price_cache_ttl', { ascending: false, nullsFirst: false })
    .limit(200);

  if (error || !cards) {
    return <div className="p-8 text-red-500">Error loading cards from database.</div>;
  }

  return (
    <div className="min-h-screen bg-[#060c18] pt-24 pb-20">
      <div className="container max-w-[1400px] mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Source Data Quality</h1>
            <p className="text-zinc-400">Manage scraper URLs for the top 200 most expensive Japanese OP cards.</p>
          </div>
        </div>

        <div className="bg-[#0b1329] rounded-xl border border-white/10 overflow-hidden">
          <SourcesTable initialCards={cards} />
        </div>
      </div>
    </div>
  );
}
