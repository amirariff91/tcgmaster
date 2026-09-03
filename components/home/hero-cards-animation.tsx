'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

const CARDS = [
  { id: 1, src: 'https://images.tcgmaster.com/one-piece/op-op05-119_p2-ja.png', alt: 'One Piece Manga Shanks', rot: -25, y: 34, x: -140 },
  { id: 2, src: 'https://images.pokemontcg.io/base1/4_hires.png', alt: 'Pokemon Charizard Holo', rot: -15, y: 13, x: -84 },
  { id: 3, src: '/images/cards/boboiboy/boboiboy-pek-versus-049-boboiboy-frostfire.jpg', alt: 'Monsta Galaxy BoBoiBoy FrostFire', rot: -5, y: 0, x: -28 },
  { id: 4, src: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/1cea41a2b9c3de59a1c95ceacc59950be1d01907-744x1039.png?accountingTag=RB', alt: 'Riftbound Evelynn Entrancing', rot: 5, y: 0, x: 28 },
  { id: 5, src: 'https://images.tcgmaster.com/dbfw/promotion/FB01-096-p2.webp', alt: 'Dragon Ball Son Goku SCR', rot: 15, y: 13, x: 84 },
  { id: 6, src: 'https://images.tcgmaster.com/one-piece/op-op13-118_p3-ja.png', alt: 'One Piece Wanted Gold', rot: 25, y: 34, x: 140 },
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
              unoptimized={true}
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
