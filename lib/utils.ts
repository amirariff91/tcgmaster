import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: price < 10 ? 2 : 0,
  }).format(price);
}

export function formatPriceChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  return formatDate(date);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

export function getGradeColor(grade: string): string {
  const numGrade = parseFloat(grade);
  if (isNaN(numGrade)) return 'text-gray-500'; // raw
  if (numGrade === 10) return 'text-emerald-500';
  if (numGrade >= 9) return 'text-green-500';
  if (numGrade >= 8) return 'text-lime-500';
  if (numGrade >= 7) return 'text-yellow-500';
  if (numGrade >= 6) return 'text-orange-500';
  return 'text-red-500';
}

export function getConfidenceColor(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':
      return 'text-green-500';
    case 'medium':
      return 'text-yellow-500';
    case 'low':
      return 'text-red-500';
  }
}

export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function getGradingCompanyDisplay(slug: string): string {
  const displays: Record<string, string> = {
    psa: 'PSA',
    bgs: 'BGS',
    cgc: 'CGC',
    sgc: 'SGC',
  };
  return displays[slug] || slug.toUpperCase();
}

export function getRarityDisplay(rarity: string): string {
  const displays: Record<string, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    'holo-rare': 'Holo Rare',
    'ultra-rare': 'Ultra Rare',
    'secret-rare': 'Secret Rare',
    promo: 'Promo',
  };
  return displays[rarity] || rarity;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function generateShareUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export function isValidCertNumber(certNumber: string, company: string): boolean {
  // Basic validation for cert numbers
  const cleaned = certNumber.replace(/\D/g, '');
  switch (company) {
    case 'psa':
      return cleaned.length >= 7 && cleaned.length <= 10;
    case 'bgs':
      return cleaned.length >= 7 && cleaned.length <= 10;
    case 'cgc':
      return cleaned.length >= 7 && cleaned.length <= 12;
    case 'sgc':
      return cleaned.length >= 6 && cleaned.length <= 10;
    default:
      return cleaned.length >= 6;
  }
}
