'use client';

import Link from 'next/link';
import { BadgeCheck, Clock3, Database, Shield } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { MarketMovers, type MarketMover } from '@/components/home/market-movers';
import { CategoryCards, type Category } from '@/components/home/category-cards';
import { formatPrice, formatDate } from '@/lib/utils';

const POKE_IMG = (n: number) => `https://images.pokemontcg.io/base1/${n}_hires.png`;

const marketMovers: { gainers: MarketMover[]; losers: MarketMover[] } = {
  gainers: [
    {
      id: '1',
      name: 'Charizard',
      set: 'Base Set',
      grade: 'PSA 10',
      price: 42000,
      change: 15.2,
      image: POKE_IMG(4),
      slug: 'pokemon/base-set/charizard',
      volume: 14,
      confidence: 'High',
      source: 'Tracked sale comps',
    },
    {
      id: '2',
      name: 'Michael Jordan Rookie',
      set: '1986 Fleer',
      grade: 'PSA 9',
      price: 85000,
      change: 12.8,
      image: null,
      slug: 'sports-basketball/1986-fleer/michael-jordan-rookie',
      volume: 7,
      confidence: 'Medium',
      source: 'Auction comps',
    },
    {
      id: '3',
      name: 'Pikachu Illustrator',
      set: 'Promo',
      grade: 'PSA 9',
      price: 375000,
      change: 8.5,
      image: POKE_IMG(58),
      slug: 'pokemon/promo/pikachu-illustrator',
      volume: 3,
      confidence: 'Thin',
      source: 'Low-volume comps',
    },
  ],
  losers: [
    {
      id: '4',
      name: 'Blastoise',
      set: 'Base Set',
      grade: 'PSA 10',
      price: 8500,
      change: -7.3,
      image: POKE_IMG(2),
      slug: 'pokemon/base-set/blastoise',
      volume: 11,
      confidence: 'High',
      source: 'Tracked sale comps',
    },
    {
      id: '5',
      name: 'Mewtwo',
      set: 'Base Set',
      grade: 'PSA 9',
      price: 1200,
      change: -5.1,
      image: POKE_IMG(10),
      slug: 'pokemon/base-set/mewtwo',
      volume: 18,
      confidence: 'High',
      source: 'Tracked sale comps',
    },
  ],
};

const collectorDemand = [
  { id: '1', name: 'Charizard PSA 10', set: 'Base Set', searches: 12500, velocity: '+34%', slug: 'pokemon/base-set/charizard' },
  { id: '2', name: 'Lugia', set: 'Neo Genesis', searches: 8200, velocity: '+21%', slug: 'pokemon/neo-genesis/lugia' },
  { id: '3', name: 'LeBron James RC', set: '2003 Topps Chrome', searches: 7800, velocity: '+18%', slug: 'sports-basketball/2003-topps-chrome/lebron-james-rc' },
  { id: '4', name: 'Venusaur', set: 'Base Set', searches: 5600, velocity: '+11%', slug: 'pokemon/base-set/venusaur' },
  { id: '5', name: 'Umbreon', set: 'Neo Discovery', searches: 4900, velocity: '+9%', slug: 'pokemon/neo-discovery/umbreon' },
];

const generateNotableSales = () => {
  const today = new Date();
  return [
    {
      id: '1',
      name: 'Charizard 1st Edition',
      set: 'Base Set',
      grade: 'PSA 10',
      price: 420000,
      daysAgo: 2,
      source: 'PWCC',
      confidence: 'Verified auction comp',
      slug: 'pokemon/base-set/charizard',
    },
    {
      id: '2',
      name: 'Mickey Mantle',
      set: '1952 Topps',
      grade: 'PSA 9',
      price: 2880000,
      daysAgo: 5,
      source: 'Heritage',
      confidence: 'Auction archive',
      slug: 'sports-baseball/1952-topps/mickey-mantle',
    },
    {
      id: '3',
      name: 'Michael Jordan Rookie',
      set: '1986 Fleer',
      grade: 'BGS 10',
      price: 738000,
      daysAgo: 7,
      source: 'Goldin',
      confidence: 'Verified auction comp',
      slug: 'sports-basketball/1986-fleer/michael-jordan-rookie',
    },
  ].map((sale) => {
    const date = new Date(today);
    date.setDate(date.getDate() - sale.daysAgo);
    return {
      ...sale,
      date: date.toISOString().split('T')[0],
    };
  });
};

const notableSales = generateNotableSales();

const categories: Category[] = [
  {
    name: 'Pokemon',
    slug: 'pokemon',
    description: 'Base Set, Neo, modern chase cards, promos',
    cardCount: '15,000+',
    change: '+8.4%',
    topMover: 'Charizard PSA 10',
  },
  {
    name: 'Basketball',
    slug: 'sports-basketball',
    description: 'Topps, Fleer, Panini, rookie-market signals',
    cardCount: '25,000+',
    change: '+5.7%',
    topMover: 'Jordan Fleer PSA 9',
  },
  {
    name: 'Baseball',
    slug: 'sports-baseball',
    description: 'Vintage grails, Bowman, Topps, modern slabs',
    cardCount: '50,000+',
    change: '-1.9%',
    topMover: 'Mantle 1952 Topps',
  },
];

const methodology = [
  {
    icon: Database,
    title: 'Sale comps first',
    copy: 'Completed sales are weighted above active listings so wishful pricing does not set the market.',
  },
  {
    icon: Shield,
    title: 'Grade-aware pricing',
    copy: 'Raw, PSA, BGS, and low-volume cards are separated before movement is calculated.',
  },
  {
    icon: Clock3,
    title: 'Freshness visible',
    copy: 'Every market module should expose recency, source context, volume, and confidence.',
  },
];

export default function HomePage() {
  const notableSalesData = notableSales;

  return (
    <main className="min-h-screen bg-[var(--surface-warm)] text-stone-950">
      <section className="border-b border-stone-200 bg-[var(--surface-paper)]">
        <div className="container grid gap-10 py-12 md:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              TCG price intelligence
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-5xl font-semibold tracking-[-0.04em] text-stone-950 md:text-7xl">
              Know what your cards are really worth.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-700 md:text-xl">
              Search recent card prices, compare graded comps, monitor market movement, and manage collection value across Pokemon and sports cards.
            </p>

            <div className="mt-8 max-w-2xl">
              <SearchBar size="lg" placeholder="Search ‘Charizard PSA 10’, ‘Jordan Fleer’, or a cert number..." />
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                {['Moonbreon PSA 10', 'Base Set Charizard', '1952 Topps Mantle'].map((query) => (
                  <Link key={query} href={`/search?q=${encodeURIComponent(query)}`} className="rounded-full border border-stone-300 bg-white px-3 py-1.5 transition-colors hover:border-amber-700 hover:text-stone-950">
                    {query}
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <HeroProof label="Cards tracked" value="100,000+" />
              <HeroProof label="Grade lookup" value="PSA / BGS" />
              <HeroProof label="Last sync" value="14 min ago" />
            </div>
          </div>

          <MarketDeskPreview />
        </div>
      </section>

      <section className="container py-10 md:py-14">
        <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(41,37,36,0.06)] md:grid-cols-4 md:p-6">
          <SnapshotMetric label="Sales indexed / 30d" value="418K" />
          <SnapshotMetric label="Fastest market" value="Pokemon +8.4%" />
          <SnapshotMetric label="Coverage" value="Raw · PSA · BGS" />
          <SnapshotMetric label="Method" value="Volume weighted" />
        </div>
      </section>

      <section className="container py-8 md:py-12">
        <CategoryCards categories={categories} />
      </section>

      <section className="container py-8 md:py-12">
        <MarketMovers gainers={marketMovers.gainers} losers={marketMovers.losers} />
      </section>

      <section className="container grid gap-6 py-8 md:py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <CollectorDemand />
        <LatestComps sales={notableSalesData} />
      </section>

      <section className="container py-8 md:py-12">
        <div className="grid gap-5 md:grid-cols-3">
          {methodology.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_1px_2px_rgba(41,37,36,0.06)]">
                <Icon className="h-5 w-5 text-amber-700" />
                <h3 className="mt-5 font-serif text-2xl font-semibold text-stone-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{item.copy}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="container py-10 pb-16 md:pb-20">
        <div className="grid gap-8 rounded-2xl border border-stone-300 bg-stone-950 p-6 text-white md:grid-cols-[1fr_0.85fr] md:items-center md:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Start with a card you already own</p>
            <h2 className="mt-3 font-serif text-4xl font-semibold tracking-tight md:text-5xl">Track the market before your next move.</h2>
            <p className="mt-4 max-w-2xl text-stone-300">
              Whether you are buying, grading, selling, or holding, TCGMaster gives you pricing context before money moves.
            </p>
          </div>
          <div className="space-y-3">
            <Link
              href="/search"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-white px-6 text-base font-medium text-stone-950 transition-colors hover:bg-stone-100"
            >
              Check a card price
            </Link>
            <Link
              href="/collection"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-stone-700 px-6 text-base font-medium text-white transition-colors hover:bg-stone-900"
            >
              Build my collection
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroProof({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-stone-950">{value}</p>
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-stone-950">{value}</p>
    </div>
  );
}

function MarketDeskPreview() {
  return (
    <div className="rounded-2xl border border-stone-300 bg-stone-950 p-4 text-white shadow-2xl shadow-stone-950/10 md:p-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Live comp card</p>
          <h2 className="mt-1 font-serif text-2xl font-semibold">Charizard Base Set</h2>
        </div>
        <BadgeCheck className="h-5 w-5 text-emerald-300" />
      </div>
      <div className="grid gap-3 py-5 sm:grid-cols-2">
        <TerminalMetric label="Grade" value="PSA 10" />
        <TerminalMetric label="Market price" value="$42,000" />
        <TerminalMetric label="30d move" value="+15.2%" tone="up" />
        <TerminalMetric label="Confidence" value="High" />
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5">
        {[
          ['PWCC', 'PSA 10', '$41,800', '2h ago'],
          ['Tracked sale', 'PSA 10', '$42,300', '1d ago'],
          ['Auction archive', 'PSA 9', '$12,900', '3d ago'],
        ].map(([source, grade, price, time]) => (
          <div key={`${source}-${time}`} className="grid grid-cols-[1fr_0.7fr_0.8fr_0.8fr] gap-3 border-b border-white/10 px-4 py-3 text-xs last:border-b-0">
            <span className="text-stone-300">{source}</span>
            <span className="font-mono text-stone-400">{grade}</span>
            <span className="text-right font-mono text-white">{price}</span>
            <span className="text-right text-stone-400">{time}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-stone-400">
        Example market view. Production rows should link to source records and expose volume thresholds.
      </p>
    </div>
  );
}

function TerminalMetric({ label, value, tone }: { label: string; value: string; tone?: 'up' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-400">{label}</p>
      <p className={`mt-2 font-mono text-xl font-semibold tabular-nums ${tone === 'up' ? 'text-emerald-300' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function CollectorDemand() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(41,37,36,0.06)]">
      <div className="border-b border-stone-200 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Collector demand</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-stone-950">What collectors are checking now</h2>
      </div>
      <ul className="divide-y divide-stone-200">
        {collectorDemand.map((item, i) => (
          <li key={item.id}>
            <Link href={`/${item.slug}`} className="grid grid-cols-[2rem_1fr_auto] gap-3 px-6 py-4 transition-colors hover:bg-amber-50/50">
              <span className="font-mono text-sm text-stone-400">{i + 1}</span>
              <span>
                <span className="block font-semibold text-stone-950">{item.name}</span>
                <span className="text-sm text-stone-600">{item.set}</span>
              </span>
              <span className="text-right">
                <span className="block font-mono text-sm font-semibold text-emerald-700">{item.velocity}</span>
                <span className="text-xs text-stone-500">{item.searches.toLocaleString()} searches</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LatestComps({ sales }: { sales: Array<{ id: string; name: string; set: string; grade: string; price: number; date: string; source: string; confidence: string; slug: string }> }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(41,37,36,0.06)]">
      <div className="border-b border-stone-200 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Latest confirmed comps</p>
        <h2 className="mt-2 font-serif text-3xl font-semibold text-stone-950">Recent sales should earn trust.</h2>
      </div>
      <ul className="divide-y divide-stone-200">
        {sales.map((sale) => (
          <li key={sale.id}>
            <Link href={`/${sale.slug}`} className="grid gap-4 px-6 py-4 transition-colors hover:bg-amber-50/50 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-stone-300 bg-stone-100 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{sale.grade.split(' ')[0]}</span>
                  <span className="font-mono text-xs font-semibold text-stone-900">{sale.grade.split(' ')[1]}</span>
                </div>
                <div>
                  <p className="font-semibold text-stone-950">{sale.name}</p>
                  <p className="text-sm text-stone-600">{sale.set} · {sale.grade} · {sale.source}</p>
                  <p className="mt-1 text-xs text-stone-500">{sale.confidence}</p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-mono text-lg font-semibold tabular-nums text-stone-950">{formatPrice(sale.price)}</p>
                <p className="text-xs text-stone-500">{formatDate(sale.date)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
