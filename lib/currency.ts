// Currency conversion utilities with exchangerate.host API integration

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD';

export interface ExchangeRates {
  base: string;
  date: string;
  rates: Record<SupportedCurrency, number>;
}

export interface ConvertedPrice {
  amount: number;
  formatted: string;
  isApproximate: boolean;
  currency: SupportedCurrency;
}

// Currency metadata for display
export const currencyInfo: Record<SupportedCurrency, { symbol: string; name: string; locale: string }> = {
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
};

// Static fallback rates (approximate, updated periodically)
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.53,
};

const CACHE_KEY = 'tcgmaster_exchange_rates';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Fetch rates from exchangerate.host (free, no API key required)
export async function fetchExchangeRates(): Promise<ExchangeRates | null> {
  try {
    // Try to get from cache first
    const cached = getCachedRates();
    if (cached) {
      return cached;
    }

    // Fetch fresh rates
    const response = await fetch(
      'https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP,JPY,CAD,AUD',
      { next: { revalidate: 3600 } } // Cache for 1 hour on server
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.rates) {
      throw new Error('Invalid response from exchange rate API');
    }

    const rates: ExchangeRates = {
      base: 'USD',
      date: data.date || new Date().toISOString().split('T')[0],
      rates: {
        USD: 1,
        EUR: data.rates?.EUR ?? FALLBACK_RATES.EUR,
        GBP: data.rates?.GBP ?? FALLBACK_RATES.GBP,
        JPY: data.rates?.JPY ?? FALLBACK_RATES.JPY,
        CAD: data.rates?.CAD ?? FALLBACK_RATES.CAD,
        AUD: data.rates?.AUD ?? FALLBACK_RATES.AUD,
      },
    };

    // Cache the rates
    cacheRates(rates);

    return rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    return null;
  }
}

// Get cached rates from localStorage
function getCachedRates(): ExchangeRates | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { rates, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid
    if (now - timestamp < CACHE_DURATION) {
      return rates;
    }

    return null;
  } catch {
    return null;
  }
}

// Cache rates to localStorage
function cacheRates(rates: ExchangeRates): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        rates,
        timestamp: Date.now(),
      })
    );
  } catch {
    // Ignore localStorage errors
  }
}

// Get static fallback rate
export function getStaticFallbackRate(currency: SupportedCurrency): number {
  return FALLBACK_RATES[currency] || 1;
}

// Convert price from USD to another currency
export function convertPrice(
  usdAmount: number | null,
  toCurrency: SupportedCurrency,
  rates: ExchangeRates | null
): ConvertedPrice {
  // Handle null amounts
  if (usdAmount === null) {
    return {
      amount: 0,
      formatted: 'N/A',
      isApproximate: false,
      currency: toCurrency,
    };
  }

  // If already USD, just format
  if (toCurrency === 'USD') {
    return {
      amount: usdAmount,
      formatted: formatCurrency(usdAmount, 'USD'),
      isApproximate: false,
      currency: 'USD',
    };
  }

  // Use live rates if available, otherwise fallback
  const rate = rates?.rates[toCurrency] ?? getStaticFallbackRate(toCurrency);
  const isApproximate = !rates;
  const convertedAmount = usdAmount * rate;

  return {
    amount: convertedAmount,
    formatted: formatCurrency(convertedAmount, toCurrency),
    isApproximate,
    currency: toCurrency,
  };
}

// Format currency with proper locale and symbol
export function formatCurrency(amount: number, currency: SupportedCurrency): string {
  const info = currencyInfo[currency];

  // For JPY, don't show decimals
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  };

  try {
    return new Intl.NumberFormat(info.locale, options).format(amount);
  } catch {
    // Fallback formatting
    const formatted = currency === 'JPY'
      ? Math.round(amount).toLocaleString()
      : amount.toFixed(2);
    return `${info.symbol}${formatted}`;
  }
}

// Format compact currency (for large numbers)
export function formatCompactCurrency(amount: number, currency: SupportedCurrency): string {
  const info = currencyInfo[currency];

  if (amount >= 1000000) {
    return `${info.symbol}${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${info.symbol}${(amount / 1000).toFixed(1)}K`;
  }

  return formatCurrency(amount, currency);
}

// Currency preference storage
const CURRENCY_PREF_KEY = 'tcgmaster_currency';

export function getSavedCurrency(): SupportedCurrency {
  if (typeof window === 'undefined') return 'USD';

  try {
    const saved = localStorage.getItem(CURRENCY_PREF_KEY);
    if (saved && Object.keys(currencyInfo).includes(saved)) {
      return saved as SupportedCurrency;
    }
  } catch {
    // Ignore localStorage errors
  }

  return 'USD';
}

export function saveCurrency(currency: SupportedCurrency): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CURRENCY_PREF_KEY, currency);
  } catch {
    // Ignore localStorage errors
  }
}

// React hook for currency context
export function createCurrencyStore() {
  let currency: SupportedCurrency = 'USD';
  let rates: ExchangeRates | null = null;
  const listeners = new Set<() => void>();

  return {
    getCurrency: () => currency,
    getRates: () => rates,
    setCurrency: (newCurrency: SupportedCurrency) => {
      currency = newCurrency;
      saveCurrency(newCurrency);
      listeners.forEach(listener => listener());
    },
    setRates: (newRates: ExchangeRates | null) => {
      rates = newRates;
      listeners.forEach(listener => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
