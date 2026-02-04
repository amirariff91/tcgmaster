'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  type SupportedCurrency,
  type ExchangeRates,
  type ConvertedPrice,
  getSavedCurrency,
  saveCurrency,
  fetchExchangeRates,
  convertPrice,
  formatCompactCurrency,
} from './currency';

interface CurrencyContextValue {
  currency: SupportedCurrency;
  rates: ExchangeRates | null;
  isLoading: boolean;
  setCurrency: (currency: SupportedCurrency) => void;
  convert: (usdAmount: number | null) => ConvertedPrice;
  format: (usdAmount: number | null) => string;
  formatCompact: (usdAmount: number | null) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

interface CurrencyProviderProps {
  children: ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>('USD');
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage (client-side only)
  // This is a legitimate initialization pattern that only runs once on mount
  useEffect(() => {
    const saved = getSavedCurrency();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrencyState(saved);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsInitialized(true);
  }, []);

  // Fetch exchange rates once on mount
  useEffect(() => {
    let mounted = true;

    fetchExchangeRates()
      .then((fetchedRates) => {
        if (mounted) {
          setRates(fetchedRates);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for cross-tab currency changes via localStorage
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key === 'tcgmaster_currency' && e.newValue) {
        const newCurrency = e.newValue as SupportedCurrency;
        setCurrencyState(newCurrency);
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setCurrency = useCallback((newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency);
    saveCurrency(newCurrency);
  }, []);

  const convert = useCallback(
    (usdAmount: number | null): ConvertedPrice => {
      return convertPrice(usdAmount, currency, rates);
    },
    [currency, rates]
  );

  const format = useCallback(
    (usdAmount: number | null): string => {
      if (usdAmount === null) return 'N/A';
      const converted = convertPrice(usdAmount, currency, rates);
      return converted.formatted;
    },
    [currency, rates]
  );

  const formatCompact = useCallback(
    (usdAmount: number | null): string => {
      if (usdAmount === null) return 'N/A';
      const converted = convertPrice(usdAmount, currency, rates);
      return formatCompactCurrency(converted.amount, currency);
    },
    [currency, rates]
  );

  // Prevent hydration mismatch by not rendering children until initialized
  // Only affects client-side rendering, server always uses USD
  const value: CurrencyContextValue = {
    currency: isInitialized ? currency : 'USD',
    rates,
    isLoading,
    setCurrency,
    convert,
    format,
    formatCompact,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrencyContext must be used within a CurrencyProvider');
  }
  return context;
}

// Convenience hook for just formatting prices
export function useFormatPrice() {
  const { format } = useCurrencyContext();
  return format;
}
