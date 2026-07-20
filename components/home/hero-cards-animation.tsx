'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

const CARDS = [
  { id: 1, src: 'https://www.onepiece-cardgame.com/images/cardlist/card/EB03-053_p2.png?260630', alt: 'Card 1', rot: -25, y: 34, x: -136 },
  { id: 2, src: 'https://www.onepiece-cardgame.com/images/cardlist/card/OP12-020_p3.png?260630', alt: 'Card 2', rot: -15, y: 13, x: -82 },
  { id: 3, src: 'https://www.onepiece-cardgame.com/images/cardlist/card/OP09-050_p3.png?260630', alt: 'Card 3', rot: -5, y: 0, x: -27 },
  { id: 4, src: 'https://www.onepiece-cardgame.com/images/cardlist/card/OP05-060_p4.png?260630', alt: 'Card 4', rot: 5, y: 0, x: 27 },
  { id: 5, src: 'https://www.onepiece-cardgame.com/images/cardlist/card/OP13-118_p3.png?260630', alt: 'Card 5', rot: 15, y: 13, x: 82 },
  { id: 6, src: 'https://www.onepiece-cardgame.com/images/cardlist/card/EB03-061_p2.png?260630', alt: 'Card 6', rot: 25, y: 34, x: 136 },
];

export function HeroCardsAnimation() {
  const [activeCard, setActiveCard] = useState<number | null>(null);
  const [scaleFactor, setScaleFactor] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      // Scale down card spread on smaller screens
      if (window.innerWidth < 400) {
        setScaleFactor(0.65);
      } else if (window.innerWidth < 640) {
        setScaleFactor(0.75);
      } else {
        setScaleFactor(1);
      }
    };
    
    // Initial check
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div 
      className="relative w-full max-w-3xl mx-auto h-[300px] sm:h-[400px] flex items-center justify-center mt-6 perspective-[1200px]"
    >
      {/* Glow effect behind cards */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-orange-500/20 blur-[100px] rounded-full pointer-events-none" />
      
      {CARDS.map((card, idx) => {
        const isActive = activeCard === card.id;

        return (
          <motion.div
            key={card.id}
            onMouseEnter={() => setActiveCard(card.id)}
            onMouseLeave={() => setActiveCard(null)}
            onTouchStart={() => setActiveCard(card.id)}
            onTouchEnd={() => setActiveCard(null)}
            initial={{ opacity: 0, y: 150, scale: 0.85, rotate: 0 }}
            animate={{ 
              opacity: 1, 
              y: (isActive ? card.y - 40 : card.y) * scaleFactor, 
              x: card.x * scaleFactor, 
              scale: isActive ? 1.08 : 1,
              rotate: isActive ? card.rot : card.rot,
              rotateX: isActive ? 0 : 10,
              boxShadow: isActive ? '0 45px 80px -20px rgba(249, 115, 22, 0.7)' : '0 10px 30px -10px rgba(0,0,0,0.5)',
              zIndex: 10 + idx,
            }}
            transition={{ 
              type: 'spring',
              stiffness: isActive ? 400 : 80,
              damping: 25,
              mass: isActive ? 0.5 : 1.2,
              delay: activeCard === null ? idx * 0.15 : 0
            }}
            className="absolute cursor-pointer w-[90px] h-[125px] sm:w-[170px] sm:h-[240px] rounded-xl sm:rounded-2xl border border-white/20 overflow-hidden shadow-2xl transition-shadow bg-black/40 origin-bottom"
          >
            <Image 
              src={card.src} 
              alt={card.alt} 
              fill
              unoptimized={false}
              sizes="(max-width: 640px) 90px, 170px"
              className="object-cover"
            />
            
            {/* Inner glow/shine effect */}
            <div className={`absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 transition-opacity duration-300 pointer-events-none ${isActive ? 'opacity-100' : 'opacity-0'}`} />
          </motion.div>
        );
      })}
    </div>
  );
}
