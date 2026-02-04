'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Category {
  name: string;
  slug: string;
  description: string;
  cardCount: string;
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
  // Iconic card images for mosaic background
  iconicCards?: Array<{
    name: string;
    imageUrl: string;
  }>;
}

interface CategoryCardsProps {
  categories: Category[];
}

// Default iconic cards for each category - empty arrays since images don't exist
// Components have graceful fallback UI
const DEFAULT_ICONIC_CARDS: Record<string, string[]> = {
  pokemon: [],
  'sports-basketball': [],
  'sports-baseball': [],
};

export function CategoryCards({ categories }: CategoryCardsProps) {
  return (
    <section className="container py-12 lg:py-16">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard key={category.slug} category={category} />
        ))}
      </div>
    </section>
  );
}

interface CategoryCardProps {
  category: Category;
}

function CategoryCard({ category }: CategoryCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const iconicCards = category.iconicCards?.map((c) => c.imageUrl) ||
    DEFAULT_ICONIC_CARDS[category.slug] ||
    [];

  const Icon = category.icon;

  return (
    <Link
      href={`/${category.slug}`}
      className="group relative overflow-hidden rounded-2xl p-6 transition-all hover:scale-[1.02] hover:shadow-xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-90 transition-opacity',
          category.gradient,
          isHovered && 'opacity-95'
        )}
      />

      {/* Card mosaic background */}
      {iconicCards.length > 0 && (
        <CardMosaic images={iconicCards} isHovered={isHovered} />
      )}

      {/* Content */}
      <div className="relative text-white">
        <Icon className="mb-4 h-8 w-8" />
        <h2 className="text-2xl font-bold">{category.name}</h2>
        <p className="mt-1 text-white/80">{category.description}</p>
        <p className="mt-4 text-sm font-medium">{category.cardCount} cards</p>
        <ArrowRight className="mt-4 h-5 w-5 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

interface CardMosaicProps {
  images: string[];
  isHovered: boolean;
}

function CardMosaic({ images, isHovered }: CardMosaicProps) {
  // Fill to 6 images for consistent grid
  const displayImages = [...images.slice(0, 6)];
  while (displayImages.length < 6) {
    displayImages.push(images[displayImages.length % images.length] || '');
  }

  return (
    <div
      className={cn(
        'absolute inset-0 grid grid-cols-3 grid-rows-2 gap-1 opacity-20 transition-opacity duration-300',
        isHovered && 'opacity-30'
      )}
    >
      {displayImages.map((imageUrl, index) => (
        <MosaicImage key={`${imageUrl}-${index}`} src={imageUrl} index={index} />
      ))}
    </div>
  );
}

interface MosaicImageProps {
  src: string;
  index: number;
}

function MosaicImage({ src, index }: MosaicImageProps) {
  const [hasError, setHasError] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // Stagger animation based on index
  const animationDelay = `${index * 100}ms`;

  if (!src || hasError) {
    return (
      <div className="h-full w-full bg-white/10" />
    );
  }

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden transition-opacity duration-500',
        isLoaded ? 'opacity-100' : 'opacity-0'
      )}
      style={{ animationDelay }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 33vw, 20vw"
        className="object-cover"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}

export default CategoryCards;
