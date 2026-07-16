import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Decks | TCGMaster',
  description: 'Build and manage your trading card decks on TCGMaster.',
};

export default function DecksPage() {
  return (
    <div className="min-h-screen bg-[#060c18] flex items-center justify-center pt-24 px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 text-center max-w-2xl mx-auto flex flex-col items-center">
        {/* Animated Icon / Element */}
        <div className="w-24 h-24 mb-8 relative flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-orange-500/30 rounded-xl transform rotate-12 transition-transform hover:rotate-45 duration-700" />
          <div className="absolute inset-0 border-2 border-orange-500/50 rounded-xl transform -rotate-6 transition-transform hover:-rotate-12 duration-500" />
          <span className="text-orange-500 font-black text-4xl italic tracking-tighter" style={{ fontFamily: 'Impact, sans-serif' }}>
            TM
          </span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-white uppercase tracking-tighter mb-6 drop-shadow-lg">
          Decks
        </h1>
        
        <div className="inline-block px-6 py-2 border border-orange-500/30 rounded-full bg-orange-500/10 backdrop-blur-md mb-8">
          <p className="text-orange-400 font-bold tracking-widest text-sm uppercase">
            Coming Soon
          </p>
        </div>
        
        <p className="text-zinc-400 text-lg md:text-xl max-w-lg leading-relaxed">
          We're building the ultimate deck builder and analyzer. Stay tuned for advanced deck management, synergy insights, and meta tracking.
        </p>
      </div>
    </div>
  );
}
