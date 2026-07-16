'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function SearchBar({
  className,
  placeholder = 'Search cards, sets, or enter cert number...',
  size = 'md',
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams?.get('q') || '');
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);

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
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&autocomplete=true`);
        const data = await response.json();
        setResults(data.results || []);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchResults();
  }, [debouncedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400 z-10 pointer-events-none" />
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
              'w-full rounded-lg border border-white/10 bg-[#0b1329]/80 backdrop-blur-sm pl-12 pr-12 shadow-sm transition-all text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 hover:bg-white/5 hover:border-orange-500/30',
              sizeClasses[size]
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                inputRef.current?.focus();
                if (window.location.pathname === '/search') {
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

      {/* Autocomplete dropdown */}
      {isOpen && (query.length >= 2 || results.length > 0) && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/10 bg-[#060c18]/95 backdrop-blur-md shadow-xl shadow-black/50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-96 overflow-auto py-2">
              {results.map((result) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => handleResultClick(result)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-orange-500/20 transition-colors"
                  >
                    {result.image_url ? (
                      <img
                        src={result.image_url}
                        alt={result.name}
                        className="h-12 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-10 items-center justify-center rounded bg-white/5 border border-white/10">
                        <Search className="h-4 w-4 text-zinc-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-white">
                        {result.name}
                      </p>
                      {result.subtitle && (
                        <p className="truncate text-sm text-zinc-400">
                          {result.subtitle}
                        </p>
                      )}
                    </div>
                    {result.price !== null && (
                      <span className="text-sm font-semibold text-orange-400">
                        ${result.price.toLocaleString()}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : query.length >= 2 ? (
            <div className="py-8 text-center text-zinc-500">
              No results found for &quot;{query}&quot;
            </div>
          ) : null}

          {query.length >= 2 && (
            <div className="border-t border-white/10">
              <button
                type="button"
                onClick={handleSubmit}
                className="flex w-full items-center justify-center gap-2 py-3 text-sm text-zinc-300 hover:bg-orange-500/20 hover:text-white transition-colors"
              >
                <Search className="h-4 w-4" />
                Search for &quot;{query}&quot;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
