"use client";

import React, { useRef, useState, MouseEvent } from 'react';
import Image from 'next/image';

interface Card {
  id: string;
  name: string;
  image_url: string;
  local_image_url?: string | null;
}

interface CardsMarqueeProps {
  cards: Card[];
}

function InteractiveTiltCard({ card }: { card: Card }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    
    // Calculate mouse position relative to the center of the card
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // The tilt amount (15 degrees max)
    const rotateX = ((y - centerY) / centerY) * -15;
    const rotateY = ((x - centerX) / centerX) * 15;

    // Glare position
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.15, 1.15, 1.15)`,
      transition: 'transform 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Very fast fluid follow
      zIndex: 30,
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(255, 120, 0, 0.3)'
    });

    setGlareStyle({
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.4), transparent 60%)`,
      opacity: 1,
      transition: 'opacity 0.2s ease-in'
    });
  };

  const handleMouseLeave = () => {
    setStyle({
      transform: `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`,
      transition: 'transform 0.5s ease-out, box-shadow 0.5s ease-out', // Smooth snap back
      zIndex: 1,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
    });
    setGlareStyle({
      opacity: 0,
      transition: 'opacity 0.5s ease-out'
    });
  };

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-[130px] h-[180px] sm:w-[170px] sm:h-[235px] shrink-0 rounded-xl overflow-hidden shadow-xl bg-[#0b1329] border border-white/10 group cursor-pointer"
      style={style}
    >
      <Image 
        src={card.local_image_url || card.image_url} 
        alt={card.name || 'TCG Card'} 
        fill 
        sizes="(max-width: 640px) 130px, 170px"
        className="object-cover" 
        unoptimized
      />
      {/* Dynamic Glare effect */}
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={glareStyle} 
      />
      {/* Subtle border reflection */}
      <div className="absolute inset-0 border border-white/20 rounded-xl pointer-events-none mix-blend-overlay" />
    </div>
  );
}

export function CardsMarquee({ cards }: CardsMarqueeProps) {
  // If we don't have enough cards, duplicate them to ensure smooth infinite loop
  if (!cards || cards.length === 0) return null;
  
  // Split available unique cards into 3 exclusive chunks
  const chunkSize = Math.max(1, Math.floor(cards.length / 3));
  const chunk1 = cards.slice(0, chunkSize);
  const chunk2 = cards.slice(chunkSize, chunkSize * 2);
  const chunk3 = cards.slice(chunkSize * 2, cards.length);

  // Pad each chunk until it reaches 20 cards to guarantee screen fill without blank gaps
  const fillRow = (c: Card[]) => {
    if (!c || c.length === 0) return [];
    const res = [...c];
    while (res.length < 20) res.push(...c);
    return res.slice(0, 20);
  };

  const row1Cards = fillRow(chunk1);
  const row2Cards = fillRow(chunk2);
  const row3Cards = fillRow(chunk3);

  const renderRow = (rowCards: Card[], directionClass: string) => {
    return (
      <div className="flex w-full mb-4 md:mb-6 overflow-visible">
        {/* We use w-max on the animating container so it fits exactly 2 sets of cards. */}
        <div className={`flex w-max gap-4 md:gap-6 pr-4 md:pr-6 ${directionClass}`}>
          
          {/* Set 1 */}
          <div className="flex gap-4 md:gap-6">
            {rowCards.map((card, idx) => (
              <InteractiveTiltCard key={`${card.id}-1-${idx}`} card={card} />
            ))}
          </div>

          {/* Set 2 (Identical to Set 1) */}
          <div className="flex gap-4 md:gap-6">
            {rowCards.map((card, idx) => (
              <InteractiveTiltCard key={`${card.id}-2-${idx}`} card={card} />
            ))}
          </div>

        </div>
      </div>
    );
  };

  return (
    <div className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden py-32 sm:py-48 bg-[#060c18] pointer-events-auto min-h-[600px] sm:min-h-[800px] flex items-center justify-center">
      {/* Dark fade edges to seamlessly blend into background */}
      <div className="absolute top-0 left-0 w-[15vw] h-full bg-gradient-to-r from-[#060c18] via-[#060c18]/80 to-transparent z-20 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[15vw] h-full bg-gradient-to-l from-[#060c18] via-[#060c18]/80 to-transparent z-20 pointer-events-none" />
      
      {/* Tilted container - scaled up to cover corners when rotated */}
      <div className="relative w-full flex flex-col items-center justify-center -rotate-[8deg] scale-[1.2] sm:scale-[1.15]">
        {renderRow(row1Cards, 'animate-marquee-left')}
        {renderRow(row2Cards, 'animate-marquee-right')}
        {renderRow(row3Cards, 'animate-marquee-left')}
      </div>
    </div>
  );
}
