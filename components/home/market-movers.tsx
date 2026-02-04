'use client';

import * as React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardThumbnail } from '@/components/card/card-image';
import { formatPriceChange } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';

export interface MarketMover {
  id: string;
  name: string;
  set: string;
  grade: string;
  price: number;
  change: number;
  image: string | null;
  slug: string;
}

interface MarketMoversProps {
  gainers: MarketMover[];
  losers: MarketMover[];
}

export function MarketMovers({ gainers, losers }: MarketMoversProps) {
  return (
    <section className="container py-12 lg:py-16">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900">
          Market Movers
        </h2>
        <Link href="/market">
          <Button variant="ghost" size="sm">
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Mobile: horizontal scroll, Desktop: grid */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
        <div className="flex gap-4 sm:grid sm:grid-cols-2 sm:gap-8 min-w-max sm:min-w-0">
          <MoversList
            title="Top Gainers (24h)"
            icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
            items={gainers}
            isPositive
          />
          <MoversList
            title="Top Losers (24h)"
            icon={<TrendingDown className="h-5 w-5 text-red-500" />}
            items={losers}
            isPositive={false}
          />
        </div>
      </div>
    </section>
  );
}

interface MoversListProps {
  title: string;
  icon: React.ReactNode;
  items: MarketMover[];
  isPositive: boolean;
}

function MoversList({ title, icon, items, isPositive }: MoversListProps) {
  return (
    <Card className="w-80 sm:w-auto shrink-0 sm:shrink">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        {icon}
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((card, index) => (
          <MoverItem
            key={card.id}
            card={card}
            index={index}
            isPositive={isPositive}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface MoverItemProps {
  card: MarketMover;
  index: number;
  isPositive: boolean;
}

function MoverItem({ card, index, isPositive }: MoverItemProps) {
  const { format } = useCurrencyContext();
  const [isVisible, setIsVisible] = React.useState(false);
  const [hasLoadedImage, setHasLoadedImage] = React.useState(false);
  const itemRef = React.useRef<HTMLAnchorElement>(null);

  // Intersection Observer for lazy loading
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.1 }
    );

    const el = itemRef.current;
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, []);

  // Simulate image loading delay for demo
  React.useEffect(() => {
    if (isVisible && card.image) {
      const timer = setTimeout(() => setHasLoadedImage(true), 100 + index * 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, card.image, index]);

  return (
    <Link
      ref={itemRef}
      href={`/${card.slug}`}
      className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-zinc-50"
    >
      <span className="w-6 text-center text-sm font-medium text-zinc-400">
        {index + 1}
      </span>

      {/* Lazy-loaded thumbnail */}
      <CardThumbnail
        src={isVisible && hasLoadedImage ? card.image : null}
        alt={card.name}
        name={card.name}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-900">
          {card.name}
        </p>
        <p className="truncate text-sm text-zinc-500">
          {card.set} - {card.grade}
        </p>
      </div>

      <div className="text-right">
        <p className="font-bold text-zinc-900">
          {format(card.price)}
        </p>
        <p
          className={`text-sm font-medium ${
            isPositive ? 'text-emerald-500' : 'text-red-500'
          }`}
        >
          {formatPriceChange(card.change)}
        </p>
      </div>
    </Link>
  );
}

export default MarketMovers;
