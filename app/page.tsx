import Link from 'next/link';
import Image from 'next/image';
import { Search } from 'lucide-react';
import { HeroCardsAnimation } from '@/components/home/hero-cards-animation';
import { MarketMovers, type MarketMover } from '@/components/home/market-movers';
import { ScraperCommandCenter } from '@/components/home/scraper-command-center';
import { CategoryCards, type Category } from '@/components/home/category-cards';
import { CardsMarquee } from '@/components/home/cards-marquee';
import { dbQuery } from '@/lib/db/client';

// Mock data (same as before)
const marketMovers: { gainers: MarketMover[]; losers: MarketMover[] } = {
  gainers: [
    { id: '1', name: 'Shanks (Manga)', set: 'Romance Dawn', grade: 'PSA 10', price: 1200, change: 15.2, image: null, slug: 'one-piece/romance-dawn/shanks-manga', volume: 14, confidence: 'High', source: 'Sample sale comps' },
    { id: '2', name: 'Son Goku (SCR)', set: 'Awakened Pulse', grade: 'Raw', price: 85, change: 12.8, image: null, slug: 'dragon-ball/awakened-pulse/son-goku-scr', volume: 7, confidence: 'Medium', source: 'Sample auction comps' },
    { id: '3', name: 'Monkey.D.Luffy (Manga)', set: 'Pillars of Strength', grade: 'PSA 10', price: 1500, change: 8.5, image: null, slug: 'one-piece/pillars-of-strength/monkey-d-luffy-manga', volume: 3, confidence: 'Thin', source: 'Sample low-volume comps' },
  ],
  losers: [
    { id: '4', name: 'Roronoa Zoro (Manga)', set: 'Romance Dawn', grade: 'PSA 10', price: 850, change: -7.3, image: null, slug: 'one-piece/romance-dawn/roronoa-zoro-manga', volume: 11, confidence: 'High', source: 'Sample sale comps' },
    { id: '5', name: 'Broly (SCR)', set: 'Awakened Pulse', grade: 'Raw', price: 45, change: -5.1, image: null, slug: 'dragon-ball/awakened-pulse/broly-scr', volume: 18, confidence: 'High', source: 'Sample sale comps' },
  ],
};

const categories: Category[] = [
  { name: 'One Piece', slug: 'one-piece', description: 'Romance Dawn, Pillars of Strength, Manga Rares', cardCount: '10,000+' },
  { name: 'Pokémon', slug: 'pokemon', description: 'Base Set, 151, Vintage Holos, Special Illustration Rares', cardCount: '20,000+' },
  { name: 'Riftbound', slug: 'riftbound', description: 'Origins, Spiritforged, Unleashed, Vendetta, Champions', cardCount: '1,400+' },
  { name: 'Dragon Ball', slug: 'dbfw', description: 'Fusion World, Awakened Pulse, Super Rares', cardCount: '5,200+' },
  { name: 'Monsta Galaxy', slug: 'boboiboy', description: 'Pek Fusion, Pek Adiwira, Pek Elemental, Pek Versus', cardCount: '630+' },
];

// Without this the page has no dynamic API left after the cookie-free client swap, so
// Next bakes it once at build and freezes it until the next manual Coolify deploy —
// pinning the Math.random() shuffle below to one permanent set of 60 cards and hiding
// every newly ingested card. An hourly window keeps the marquee rotating.
export const revalidate = 3600;

export default async function HomePage() {
  // Database-level scan for all high-end hits across the entire table
  let rawCards: Array<{
    id: string;
    name: string;
    image_url: string | null;
    local_image_url: string | null;
    slug: string;
    rarity: string | null;
  }> = [];

  try {
    rawCards = await dbQuery(`
      SELECT id, name, image_url, local_image_url, slug, rarity
      FROM cards
      WHERE image_url IS NOT NULL
        AND (
          rarity ILIKE $1
          OR rarity ILIKE $2
          OR rarity ILIKE $3
          OR rarity ILIKE $4
          OR rarity ILIKE $5
          OR name ILIKE $6
          OR name ILIKE $7
          OR name ILIKE $8
          OR name ILIKE $9
        )
      LIMIT 800
    `, [
      '%sp%', '%sec%', '%scr%', '%illustration%', '%legendary%',
      '%manga%', '%tournament%', '%wanted%', '%charizard%'
    ]) as typeof rawCards;
  } catch (error) {
    console.error('Failed to load home cards:', error);
  }

  // In-memory filter to strictly enforce high-end hits per game
  const filteredCards = rawCards.filter((card) => {
    const slug = card.slug || '';
    const rarity = (card.rarity || '').toLowerCase();
    const name = (card.name || '').toLowerCase();

    const isOP = slug.startsWith('op-');
    const isDB = slug.startsWith('dbfw-');
    const isPokemon = slug.startsWith('pokemon-');
    const isRiftbound = slug.startsWith('riftbound-');
    const isBoboiboy = slug.startsWith('boboiboy/');

    if (isOP) {
      // For One Piece: SP, Manga, Tournament, Wanted, SEC
      return rarity.includes('sp') || rarity.includes('sec') || name.includes('manga') || name.includes('tournament') || name.includes('wanted');
    }
    if (isDB) {
      // For Dragon Ball: SCR, SEC
      return rarity.includes('scr') || rarity.includes('sec');
    }
    if (isPokemon) {
      // For Pokémon: Special Illustration Rare, Illustration Rare, Secret, Charizard, Pikachu, Vintage Holos
      return rarity.includes('illustration') || rarity.includes('secret') || rarity.includes('holo') || name.includes('charizard') || name.includes('pikachu') || name.includes('mew');
    }
    if (isRiftbound) {
      // For Riftbound: Legendary, Epic, Rare
      return rarity.includes('legendary') || rarity.includes('epic') || rarity.includes('rare');
    }
    if (isBoboiboy) {
      // For Monsta Galaxy: Super Rare, Special, Fusion, Elemental
      return rarity.includes('rare') || rarity.includes('special') || name.includes('frostfire') || name.includes('supra') || name.includes('glacier') || name.includes('solar');
    }
    return false;
  });

  // Perfectly shuffle cards across games, then grab up to 60
  // eslint-disable-next-line react-hooks/purity
  const dbCards = filteredCards.sort(() => Math.random() - 0.5).slice(0, 60);

  return (
    <main className="min-h-screen bg-[#060c18] text-zinc-100 overflow-hidden font-sans pt-24 pb-20">

      {/* Immersive Hero Section */}
      <section className="relative w-full flex flex-col items-center pt-10 md:pt-20 px-4">
        {/* Background Image & Gradients */}
        <div className="absolute top-[-96px] left-0 w-full h-[800px] z-0 overflow-hidden pointer-events-none">
          <Image
            src="/hero-bg.jpg"
            alt="Hero Background"
            fill
            className="object-cover opacity-80 [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]"
            priority
          />
        </div>
        <div className="absolute top-[-96px] left-1/2 -translate-x-1/2 w-full max-w-7xl h-[800px] bg-radial-gradient from-orange-500/10 to-transparent blur-[120px] pointer-events-none z-0" />

        <div className="relative z-10 text-center flex flex-col items-center">
          <h2 className="text-white text-[20px] sm:text-[25px] md:text-[41px] font-black tracking-widest uppercase mb-[-10px] md:mb-[-15px] z-20 drop-shadow-xl" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.8)' }}>
            BECOME
          </h2>
          <h1 className="text-transparent bg-clip-text bg-gradient-to-b from-orange-400 to-orange-600 text-[48px] sm:text-[68px] md:text-[102px] font-black tracking-tighter uppercase leading-none z-10 drop-shadow-2xl whitespace-nowrap">
            TCG MASTER
          </h1>
          <p className="mt-2 relative -top-2.5 text-white font-bold tracking-[0.2em] text-[10px] sm:text-[12px] md:text-[14px] uppercase max-w-xl mx-auto drop-shadow-md">
            Track prices. Build decks. Stay informed.
          </p>
        </div>

        {/* 3D Animated Cards Fan */}
        <div className="w-full relative z-20 mt-[-45px] sm:mt-[-75px] mb-16">
          <HeroCardsAnimation />
        </div>

        {/* Tactile Quick-Search & 1-Tap Game Launchpad */}
        <div className="relative z-30 mt-[-55px] sm:mt-[-65px] mb-12 w-full max-w-xl px-4">
          <Link 
            href="/search" 
            className="group relative flex items-center justify-between w-full px-5 py-3.5 rounded-full bg-black/60 border border-white/20 hover:border-orange-500/50 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.6)] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all duration-300"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Search className="w-4 h-4 text-orange-400 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="text-xs sm:text-sm text-zinc-400 font-medium truncate">
                Search 50,000+ cards across 5 games...
              </span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 text-xs font-bold text-white shrink-0 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.5)] transition-all">
              Discover
              <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </span>
          </Link>

          {/* 1-Tap Quick Filter Pills */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 overflow-x-auto py-1 no-scrollbar text-[11px] font-semibold">
            <Link href="/search" className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-orange-500 hover:text-white border border-white/10 text-zinc-300 transition-all shrink-0">
              All
            </Link>
            <Link href="/search?game=one-piece" className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 border border-white/10 text-zinc-300 transition-all shrink-0">
              One Piece
            </Link>
            <Link href="/search?game=pokemon" className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-300 border border-white/10 text-zinc-300 transition-all shrink-0">
              Pokémon
            </Link>
            <Link href="/search?game=boboiboy" className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-teal-500/20 hover:border-teal-500/40 hover:text-teal-300 border border-white/10 text-zinc-300 transition-all shrink-0">
              Monsta Galaxy
            </Link>
            <Link href="/search?game=dbfw" className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-amber-500/20 hover:border-amber-500/40 hover:text-amber-300 border border-white/10 text-zinc-300 transition-all shrink-0">
              Dragon Ball
            </Link>
            <Link href="/search?game=riftbound" className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-purple-500/20 hover:border-purple-500/40 hover:text-purple-300 border border-white/10 text-zinc-300 transition-all shrink-0">
              Riftbound
            </Link>
          </div>
        </div>
      </section>

      {/* Streamlined Content Sections - Adapted for Dark Theme */}
      <div className="container mx-auto px-4 mt-24 relative z-30">

        {/* Live TM Minions (Replacing static Market Movers) */}
        <section className="mb-24">
          <ScraperCommandCenter />
        </section>

        {/* Dynamic Cards Marquee */}
        <section className="mb-24 mt-12 w-screen relative left-1/2 -translate-x-1/2">
          <CardsMarquee cards={dbCards || []} />
        </section>

        {/* Categories */}
        <section className="mb-24">
           <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white tracking-tight">Explore <span className="text-orange-500">Tcgs</span></h3>
          </div>

           <CategoryCards categories={categories} />
        </section>

      </div>

      {/* CSS overrides for dark theme injection into components that were light mode only */}
      <style dangerouslySetInnerHTML={{__html: `
        .dark-theme-wrapper {
          color: white;
        }
        .dark-theme-wrapper .bg-white {
          background-color: rgba(255,255,255,0.03) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .dark-theme-wrapper .text-stone-950,
        .dark-theme-wrapper .text-stone-900 {
          color: white !important;
        }
        .dark-theme-wrapper .text-stone-500,
        .dark-theme-wrapper .text-stone-600 {
          color: #9ca3af !important;
        }
        .dark-theme-wrapper .border-stone-200 {
          border-color: rgba(255,255,255,0.1) !important;
        }
        .bg-radial-gradient {
          background: radial-gradient(circle, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 70%);
        }
      `}} />
    </main>
  );
}
