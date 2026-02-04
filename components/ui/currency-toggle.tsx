'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SupportedCurrency, currencyInfo } from '@/lib/currency';
import { useCurrencyContext } from '@/lib/currency-context';
import { trackCurrencyChanged } from '@/lib/analytics';

const currencies: SupportedCurrency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

interface CurrencyToggleProps {
  className?: string;
}

export function CurrencyToggle({ className }: CurrencyToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use the global currency context
  const { currency, rates, isLoading, setCurrency } = useCurrencyContext();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (newCurrency: SupportedCurrency) => {
    const previousCurrency = currency;
    setCurrency(newCurrency);
    setIsOpen(false);

    // Track the change
    trackCurrencyChanged(previousCurrency, newCurrency);
  };

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-lg',
          'text-sm font-medium text-zinc-700',
          'bg-zinc-100 hover:bg-zinc-200',
          'transition-colors duration-150',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="font-semibold">{currency}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-zinc-500 transition-transform duration-150',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 z-50',
            'w-48 py-1 rounded-lg shadow-lg',
            'bg-white border border-zinc-200',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          role="listbox"
          aria-label="Select currency"
        >
          {currencies.map((curr) => {
            const currInfo = currencyInfo[curr];
            const isSelected = curr === currency;

            return (
              <button
                key={curr}
                type="button"
                onClick={() => handleSelect(curr)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2',
                  'text-sm text-left',
                  'hover:bg-zinc-50',
                  'transition-colors duration-150',
                  isSelected && 'bg-blue-50 text-blue-700'
                )}
                role="option"
                aria-selected={isSelected}
              >
                <span className="w-8 font-semibold text-zinc-500">
                  {currInfo.symbol}
                </span>
                <span className="flex-1">
                  <span className="font-medium">{curr}</span>
                  <span className="text-zinc-500 ml-1">- {currInfo.name}</span>
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </button>
            );
          })}

          {/* Status indicator */}
          {rates && (
            <div className="px-3 py-2 border-t border-zinc-100 mt-1">
              <p className="text-xs text-zinc-400">
                Rates updated: {rates.date}
              </p>
            </div>
          )}

          {!rates && !isLoading && (
            <div className="px-3 py-2 border-t border-zinc-100 mt-1">
              <p className="text-xs text-amber-600">
                Using approximate rates
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
