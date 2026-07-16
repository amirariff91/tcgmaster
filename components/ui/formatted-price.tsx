'use client';

import * as React from 'react';
import { useCurrencyContext } from '@/lib/currency-context';

export interface FormattedPriceProps {
  price: number | null | undefined;
  className?: string;
  fallback?: string;
}

export function FormattedPrice({ price, className, fallback = 'N/A' }: FormattedPriceProps) {
  const { format } = useCurrencyContext();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (price === null || price === undefined || !Number.isFinite(price)) {
    return <span className={className}>{fallback}</span>;
  }

  if (!mounted) {
    return <span className={className}>${price.toFixed(price < 10 ? 2 : 0)}</span>;
  }

  return (
    <span className={className}>
      {format(price)}
    </span>
  );
}
