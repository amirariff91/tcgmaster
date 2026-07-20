'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type SupportedCurrency, currencyInfo } from '@/lib/currency';
import { useCurrencyContext } from '@/lib/currency-context';
import { trackCurrencyChanged } from '@/lib/analytics';

const currencies: SupportedCurrency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'MYR'];

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
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
          'text-xs font-bold tracking-widest uppercase text-white',
          'bg-white/10 hover:bg-white/20 border border-white/10',
          'transition-all duration-300'
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{currency}</span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-zinc-400 transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-3 z-50',
            'w-48 p-2 rounded-2xl shadow-2xl backdrop-blur-md',
            'border border-white/10 bg-[#0b1329]/95',
            'animate-in fade-in zoom-in-95 duration-200'
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
                  'w-full flex items-center gap-3 rounded-xl px-3 py-2',
                  'text-sm font-medium transition-colors',
                  isSelected 
                    ? 'bg-orange-500/10 text-orange-400' 
                    : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                )}
                role="option"
                aria-selected={isSelected}
              >
                <span className={cn("w-6 font-bold", isSelected ? "text-orange-500" : "text-zinc-500")}>
                  {currInfo.symbol}
                </span>
                <span className="flex-1 text-left">
                  <span className="tracking-wider">{curr}</span>
                </span>
                {isSelected && (
                  <Check className="h-4 w-4 text-orange-500" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
