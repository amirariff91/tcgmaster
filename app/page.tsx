import Link from 'next/link';
import Image from 'next/image';
import { HeroCardsAnimation } from '@/components/home/hero-cards-animation';
import { MarketMovers, type MarketMover } from '@/components/home/market-movers';
import { CategoryCards, type Category } from '@/components/home/category-cards';
import { CardsMarquee } from '@/components/home/cards-marquee';
// Cookie-free anon client keeps this route statically renderable (see card page).
import { createPublicClient } from '@/lib/supabase/client';

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
  { name: 'One Piece', slug: 'one-piece', description: 'Romance Dawn, Pillars of Strength, Manga Rares', cardCount: '4,500+', change: '+12.4%', topMover: 'Manga Shanks PSA 10' },
  { name: 'Dragon Ball', slug: 'dragon-ball', description: 'Fusion World, Awakened Pulse, Super Rares', cardCount: '2,100+', change: '+5.7%', topMover: 'Goku SCR' }
];

// Without this the page has no dynamic API left after the cookie-free client swap, so
// Next bakes it once at build and freezes it until the next manual Coolify deploy —
// pinning the Math.random() shuffle below to one permanent set of 60 cards and hiding
// every newly ingested card. An hourly window keeps the marquee rotating.
export const revalidate = 3600;

export default async function HomePage() {
  const supabase = createPublicClient();
  
  // Database-level scan for all high-end hits across the entire table
  const { data: rawCards } = await supabase
    .from('cards')
    .select('id, name, image_url, local_image_url, slug, rarity')
    .not('image_url', 'is', null)
    .or('rarity.ilike.%sp%,rarity.ilike.%sec%,rarity.ilike.%scr%,name.ilike.%manga%,name.ilike.%tournament%,name.ilike.%wanted%')
    .limit(500);

  // In-memory filter to strictly enforce the OP and DBFW rules
  const filteredCards = (rawCards || []).filter((card: any) => {
    const slug = card.slug || '';
    const rarity = (card.rarity || '').toLowerCase();
    const name = (card.name || '').toLowerCase();
    
    const isOP = slug.startsWith('op-');
    const isDB = slug.startsWith('dbfw-');

    if (isOP) {
      // For One Piece: SP, Manga, Tournament, Wanted, SEC
      return rarity.includes('sp') || rarity.includes('sec') || name.includes('manga') || name.includes('tournament') || name.includes('wanted');
    }
    if (isDB) {
      // For Dragon Ball: SCR, SEC
      return rarity.includes('scr') || rarity.includes('sec');
    }
    return false;
  });

  // Perfectly shuffle OP and DBFW cards, then grab up to 60
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

        {/* Discover Action Button */}
        <div className="relative z-30 mt-[-60px] mb-12">
          <Link href="/search" className="group relative inline-flex items-center justify-center px-8 py-3 font-bold text-white transition-all duration-200 bg-gradient-to-r from-orange-600 to-amber-500 rounded-full hover:from-orange-500 hover:to-amber-400 hover:shadow-[0_0_40px_rgba(249,115,22,0.6)] hover:-translate-y-1">
            DISCOVER
            <svg className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
          </Link>
        </div>
      </section>

      {/* Streamlined Content Sections - Adapted for Dark Theme */}
      <div className="container mx-auto px-4 mt-24 relative z-30">
        
        {/* Market Movers */}
        <section className="mb-24">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-white tracking-tight">Market <span className="text-orange-500">Movers</span></h3>
            <p className="text-zinc-400 mt-2">Track the biggest gainers and losers in real-time.</p>
          </div>
          
          <div className="bg-[#0b1329]/80 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl">
             <MarketMovers gainers={marketMovers.gainers} losers={marketMovers.losers} />
          </div>
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
