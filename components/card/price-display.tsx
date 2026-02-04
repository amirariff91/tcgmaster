'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatPriceChange, getConfidenceColor } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import type { PriceConfidence } from '@/types';

interface PriceDisplayProps {
  price: number;
  previousPrice?: number;
  change24h?: number | null;
  change7d?: number | null;
  change30d?: number | null;
  confidence?: PriceConfidence;
  lastSaleDate?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showConfidence?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export function PriceDisplay({
  price,
  change24h,
  change7d,
  change30d,
  confidence = 'medium',
  lastSaleDate,
  size = 'md',
  showConfidence = true,
  className,
}: PriceDisplayProps) {
  const { format } = useCurrencyContext();
  const change = change24h ?? change7d ?? change30d ?? 0;
  const changeLabel = change24h !== null ? '24h' : change7d !== null ? '7d' : '30d';

  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const trendColor = change > 0 ? 'text-emerald-500' : change < 0 ? 'text-red-500' : 'text-zinc-400';

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline gap-2">
        <span className={cn('font-bold text-zinc-900 ', sizeClasses[size])}>
          {format(price)}
        </span>
        {change !== 0 && (
          <span className={cn('flex items-center gap-1 text-sm font-medium', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            {formatPriceChange(change)}
            <span className="text-zinc-400">({changeLabel})</span>
          </span>
        )}
      </div>

      {showConfidence && (
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('flex items-center gap-1', getConfidenceColor(confidence))}>
            <AlertCircle className="h-3 w-3" />
            {confidence.charAt(0).toUpperCase() + confidence.slice(1)} confidence
          </span>
          {lastSaleDate && (
            <span className="text-zinc-400">
              Last sale: {new Date(lastSaleDate).toLocaleDateString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface PriceChangeIndicatorProps {
  change: number;
  period?: string;
  className?: string;
}

export function PriceChangeIndicator({ change, period = '24h', className }: PriceChangeIndicatorProps) {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm font-medium',
        isPositive && 'text-emerald-500',
        isNegative && 'text-red-500',
        !isPositive && !isNegative && 'text-zinc-400',
        className
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-4 w-4" />
      ) : isNegative ? (
        <TrendingDown className="h-4 w-4" />
      ) : (
        <Minus className="h-4 w-4" />
      )}
      {formatPriceChange(change)}
      <span className="text-zinc-400">({period})</span>
    </span>
  );
}
