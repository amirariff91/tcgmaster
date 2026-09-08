'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2, Sparkles, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cdnImageUrl } from '@/lib/images/cloudflare-loader';
import { useDebounce } from '@/hooks/use-debounce';
import type { SearchResult } from '@/types';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  autoFocus?: boolean;
}

const sizeClasses = {
  sm: 'h-10 text-sm',
  md: 'h-12 text-base',
  lg: 'h-14 text-lg',
};

const GAME_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pokemon: {
    label: 'Pokémon',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  'one-piece': {
    label: 'One Piece',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  dragon_ball: {
    label: 'Dragon Ball',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
};

export function SearchBar({
  className,
  placeholder = 'Search by card name, number (e.g. OP05-119, 232/172), or set...',
  size = 'md',
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams?.get('q') || '');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, 250);

  React.useEffect(() => {
    const urlQuery = searchParams?.get('q');
    if (urlQuery !== null && urlQuery !== undefined) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    async function fetchResults() {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([]);
        setSelectedIndex(-1);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&autocomplete=true&limit=8`);
        const data = await response.json();
        setResults(data.results || []);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchResults();
  }, [debouncedQuery]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      handleResultClick(results[selectedIndex]);
      return;
    }

    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    const path = result.type === 'card'
      ? `/${result.game}/${result.slug}`
      : result.type === 'set'
      ? `/${result.game}/${result.slug}`
      : `/${result.slug}`;
    router.push(path);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => {
        const next = prev < results.length - 1 ? prev + 1 : 0;
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : results.length - 1;
        scrollIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const scrollIntoView = (index: number) => {
    if (listRef.current) {
      const items = listRef.current.getElementsByTagName('li');
      if (items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-400 transition-colors z-10 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={cn(
              'w-full rounded-xl border border-white/10 bg-[#0b1329]/90 backdrop-blur-md pl-12 pr-12 shadow-inner transition-all text-white placeholder:text-zinc-500 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/30 hover:border-white/20',
              sizeClasses[size]
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setSelectedIndex(-1);
                inputRef.current?.focus();
                if (typeof window !== 'undefined' && window.location.pathname === '/search') {
                  router.push('/search');
                }
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-orange-400 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </form>

      {/* Enhanced Autocomplete Dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-white/15 bg-[#070e1e]/98 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 gap-3 text-zinc-400 text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
              <span>Searching card database...</span>
            </div>
          ) : results.length > 0 ? (
            <div>
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <span>Top Matches</span>
                <span className="text-zinc-500 text-[10px]">Use ↑↓ to navigate • ↵ to select</span>
              </div>

              <ul ref={listRef} className="max-h-[420px] overflow-auto divide-y divide-white/5 py-1">
                {results.map((result, idx) => {
                  const isSelected = idx === selectedIndex;
                  const gameBadge = GAME_BADGES[result.game] || GAME_BADGES.pokemon;

                  return (
                    <li key={`${result.type}-${result.id}`}>
                      <button
                        type="button"
                        onClick={() => handleResultClick(result)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          'flex w-full items-center gap-3.5 px-4 py-3 text-left transition-all',
                          isSelected ? 'bg-orange-500/20 text-white pl-5' : 'hover:bg-white/[0.04] text-zinc-200'
                        )}
                      >
                        {/* Thumbnail / Icon */}
                        {result.image_url ? (
                          <div className="relative shrink-0 w-11 h-15 rounded-md overflow-hidden bg-black/40 border border-white/10 shadow-sm">
                            <img
                              src={cdnImageUrl(result.image_url, 100) ?? undefined}
                              alt={result.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : result.type === 'set' ? (
                          <div className="shrink-0 w-11 h-11 flex items-center justify-center rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400">
                            <Layers className="h-5 w-5" />
                          </div>
                        ) : (
                          <div className="shrink-0 w-11 h-15 flex items-center justify-center rounded-md bg-white/5 border border-white/10 text-zinc-500">
                            <Search className="h-5 w-5" />
                          </div>
                        )}

                        {/* Card Info & Badges */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="font-semibold text-sm text-white truncate max-w-[280px]">
                              {result.name}
                            </span>
                            
                            {/* Game Pill */}
                            <span className={cn('text-[10px] px-1.5 py-0.2 rounded border font-medium uppercase', gameBadge.bg, gameBadge.text, gameBadge.border)}>
                              {gameBadge.label}
                            </span>

                            {/* Rarity / Variant Pill */}
                            {result.rarity && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 font-mono">
                                {result.rarity}
                              </span>
                            )}
                          </div>

                          {/* Subtitle / Number */}
                          {result.subtitle && (
                            <p className="truncate text-xs text-zinc-400">
                              {result.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Pricing Column */}
                        <div className="text-right shrink-0">
                          {result.price !== null && result.price > 0 ? (
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-bold text-orange-400">
                                ${result.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {result.psa10_price && result.psa10_price > 0 ? (
                                <span className="text-[11px] font-medium text-emerald-400">
                                  PSA 10: ${result.psa10_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-500">Market Raw</span>
                              )}
                            </div>
                          ) : result.type === 'card' ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 bg-white/5 px-2 py-1 rounded">
                              Tracking
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : query.length >= 2 ? (
            <div className="py-10 text-center text-zinc-400 flex flex-col items-center gap-2">
              <Search className="h-8 w-8 text-zinc-600 mb-1" />
              <p className="text-sm">No exact cards found matching &quot;{query}&quot;</p>
              <p className="text-xs text-zinc-500">Try searching by card name, character, or number like <span className="text-orange-400 font-mono">OP05-119</span> or <span className="text-orange-400 font-mono">#113</span></p>
            </div>
          ) : null}

          {query.length >= 2 && (
            <div className="border-t border-white/10 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="flex w-full items-center justify-center gap-2 py-3.5 text-xs font-semibold text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                View all search results for &quot;{query}&quot; →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
