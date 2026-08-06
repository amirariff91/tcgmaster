import { getAuthUser } from '@/lib/auth-server';
import { dbQuery } from '@/lib/db/client';
import { SourcesTable } from './sources-table';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface SourceCard {
  id: string;
  slug: string;
  name: string;
  number: string;
  snkrdunk_url: string | null;
  pricecharting_url: string | null;
  yuyutei_url: string | null;
  price_cache_ttl: number | null;
  curation_status: string | null;
}

export default async function SourcesDashboardPage() {
  // Basic sanity check for auth - in a real app you'd check roles
  const user = await getAuthUser();
  if (!user) {
    redirect('/');
  }

  // Fetch top 200 expensive Japanese OP cards
  let cards: SourceCard[];
  try {
    cards = await dbQuery<SourceCard>(`
      SELECT
        id,
        slug,
        name,
        number,
        snkrdunk_url,
        pricecharting_url,
        yuyutei_url,
        price_cache_ttl,
        curation_status
      FROM cards
      WHERE slug LIKE $1
      ORDER BY price_cache_ttl DESC NULLS LAST
      LIMIT $2
    `, ['op-%-ja', 200]);
  } catch {
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
