'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PriceData {
  source: string;
  price: number;
  currency: string;
  recorded_at: string;
  url?: string;
}

interface PriceComparisonProps {
  prices: PriceData[];
}

const SOURCE_LABELS: Record<string, string> = {
  tcgplayer: 'TCGPlayer (EN)',
  snkrdunk: 'SnkrDunk (JP)',
  yuyutei: 'Yuyutei (JP)',
  cardrush: 'CardRush (JP)',
};

export function PriceComparison({ prices }: PriceComparisonProps) {
  if (!prices || prices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Prices</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No price data available for this card yet.</p>
        </CardContent>
      </Card>
    );
  }

  // Get the most recent price for each source
  const latestPricesMap = prices.reduce((acc, current) => {
    const existing = acc.get(current.source);
    if (!existing || new Date(current.recorded_at) > new Date(existing.recorded_at)) {
      acc.set(current.source, current);
    }
    return acc;
  }, new Map<string, PriceData>());

  const latestPrices = Array.from(latestPricesMap.values());

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Market Prices</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {latestPrices.map((price) => (
            <div key={price.source} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {SOURCE_LABELS[price.source] || price.source}
                </span>
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(price.recorded_at).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg">
                  {formatPrice(price.price, price.currency)}
                </span>
                
                {price.url && (
                  <a 
                    href={price.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
