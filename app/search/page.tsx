'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { CardPreview } from '@/components/card/card-preview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatSetName, cn } from '@/lib/utils';

type SearchCardResult = {
  id: string;
  name: string;
  slug: string;
  gameSlug: string;
  number: string;
  rarity?: 'holo-rare' | 'ultra-rare' | 'common' | 'uncommon' | 'rare' | 'secret-rare' | 'promo';
  image_url: string | null;
  set: { id: string; name: string; slug: string };
  current_price?: number;
  price_change_24h?: number;
};


const sortOptions = [
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'name-asc', label: 'Name: A-Z' },
  { value: 'recent', label: 'Recently Updated' },
];



function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [sort, setSort] = React.useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('search_sort') || 'price-desc' : 'price-desc');
  const [game, setGame] = React.useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('search_game') || 'all' : 'all');
  const [cardSet, setCardSet] = React.useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('search_set') || 'all' : 'all');
  const [lang, setLang] = React.useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('search_lang') || 'all' : 'all');
  const [showFilters, setShowFilters] = React.useState(false);

  const currentFiltersKey = JSON.stringify({ query, game, cardSet, lang, sort });

  const [results, setResults] = React.useState<SearchCardResult[]>(() => {
    if (typeof window !== 'undefined') {
      const savedFilters = sessionStorage.getItem('search_filters_key');
      if (savedFilters === currentFiltersKey) {
        const cached = sessionStorage.getItem('search_results');
        if (cached) {
          try { return JSON.parse(cached); } catch (e) {}
        }
      }
    }
    return [];
  });
  
  const [isLoading, setIsLoading] = React.useState(() => results.length === 0);

  const [page, setPage] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const savedFilters = sessionStorage.getItem('search_filters_key');
      if (savedFilters === currentFiltersKey) {
        return parseInt(sessionStorage.getItem('search_page') || '1', 10);
      }
    }
    return 1;
  });

  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('search_sort', sort);
      sessionStorage.setItem('search_game', game);
      sessionStorage.setItem('search_set', cardSet);
      sessionStorage.setItem('search_lang', lang);

      // If filters changed AFTER initial mount, reset page to 1
      if (!isInitialMount.current) {
        const savedFilters = sessionStorage.getItem('search_filters_key');
        if (savedFilters !== currentFiltersKey) {
          setPage(1);
          setResults([]);
          sessionStorage.removeItem('search_results');
        }
      }
      
      sessionStorage.setItem('search_filters_key', currentFiltersKey);
      sessionStorage.setItem('search_page', page.toString());
    }
  }, [query, game, cardSet, lang, sort, page, currentFiltersKey]);

  const [hasMore, setHasMore] = React.useState(false);
  const [totalCount, setTotalCount] = React.useState(0);
  const [gameFilters, setGameFilters] = React.useState([{ value: 'all', label: 'TCGs' }]);
  const [setFilters, setSetFilters] = React.useState([{ value: 'all', label: 'Sets' }]);

  React.useEffect(() => {
    fetch('/api/games')
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          const gameNameMapping: Record<string, string> = {
            'dbfw': 'Dragon Ball : Fusion World',
            'one-piece': 'One Piece',
            'pokemon': 'Pokémon'
          };
          setGameFilters([
            { value: 'all', label: 'TCGs' },
            ...json.data.filter((g: any) => g.slug !== 'pokemon').map((g: any) => ({ 
              value: g.slug, 
              label: gameNameMapping[g.slug] || g.display_name || g.name 
            }))
          ]);
        }
      })
      .catch(console.error);
  }, []);

  React.useEffect(() => {
    if (game === 'all') {
      setSetFilters([{ value: 'all', label: 'Sets' }]);
      setCardSet('all');
      return;
    }

    const langParam = lang !== 'all' ? `&lang=${lang}` : '';
    fetch(`/api/sets?game=${game}${langParam}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setSetFilters([
            { value: 'all', label: 'Sets' },
            ...json.data.map((s: any) => ({ value: s.slug, label: s.name }))
          ]);
        }
      })
      .catch(console.error);
  }, [game, lang]);

  // Filter changes are now handled in the main useEffect with isInitialMount

  React.useEffect(() => {
    setIsLoading(true);
    
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    
    let fetchPage = page;
    let fetchPageSize = 30;

    // If initial mount and page > 1, and we don't have results, fetch all items up to the current page
    if (isInitialMount.current && page > 1 && results.length === 0) {
      fetchPage = 1;
      fetchPageSize = page * 30;
    }

    // If we have cached results on initial mount, we don't need to refetch unless we want fresh data
    if (isInitialMount.current && results.length > 0) {
      setIsLoading(false);
      isInitialMount.current = false;
      return;
    }

    params.set('page', fetchPage.toString());
    params.set('pageSize', fetchPageSize.toString());
    if (game !== 'all') params.set('game', game);
    if (cardSet !== 'all') params.set('set', cardSet);
    if (lang !== 'all' && game !== 'all') params.set('lang', lang);
    if (sort !== 'relevance') params.set('sort', sort);

    fetch(`/api/search?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        const cards = json?.data?.results ?? [];
        setHasMore(json?.data?.pagination?.hasMore ?? false);
        setTotalCount(json?.data?.pagination?.totalCount ?? 0);
        
        const mappedCards = cards.map((c: any) => {
          const [gameSlugPart, setSlugPart, cardSlugPart] = (c.slug || '').split('/');
          const gameSlug = c.game || gameSlugPart || 'pokemon';
          const setSlug = setSlugPart || '';
          const cardSlug = cardSlugPart || c.slug;
          return {
            id: c.id,
            name: c.name,
            slug: cardSlug,
            gameSlug,
            number: c.subtitle?.split(' - #')[1] || '',
            rarity: (c.rarity as 'holo-rare' | 'ultra-rare' | 'common' | 'uncommon' | 'rare' | 'secret-rare' | 'promo') || 'common',
            image_url: c.image_url,
            set: { id: setSlug, name: formatSetName(c.subtitle?.split(' - ')[0] || ''), slug: setSlug },
            current_price: c.price ?? undefined,
          };
        });

        if (fetchPage === 1) {
          setResults(mappedCards);
          sessionStorage.setItem('search_results', JSON.stringify(mappedCards));
        } else {
          setResults(prev => {
            const updated = [...prev, ...mappedCards];
            sessionStorage.setItem('search_results', JSON.stringify(updated));
            return updated;
          });
        }
      })
      .catch(() => {
        if (fetchPage === 1) setResults([]);
      })
      .finally(() => {
        setIsLoading(false);
        isInitialMount.current = false;
      });
  }, [query, game, cardSet, lang, sort, page]);

  const activeFilters = React.useMemo(() => {
    const filters: string[] = [];
    if (game !== 'all') filters.push(gameFilters.find(g => g.value === game)?.label || game);
    if (cardSet !== 'all') filters.push(setFilters.find(s => s.value === cardSet)?.label || cardSet);
    if (lang !== 'all' && game !== 'all') filters.push(lang === 'ja' ? 'Japanese' : 'English');
    return filters;
  }, [game, cardSet, lang, gameFilters, setFilters]);

  const clearFilters = () => {
    setGame('all');
    setCardSet('all');
    setLang('all');
  };

  return (
    <>
      {/* ========================================= */}
      {/* DESKTOP LAYOUT (Hidden on mobile)         */}
      {/* ========================================= */}
      <div className="hidden sm:block">
        {/* Results Header */}
        <div className="mb-3 flex flex-row items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {query ? `Results for "${query}"` : 'Market Overview'}
            </h1>
            <p className="text-sm text-zinc-400">
              {totalCount || results.length} results found
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Select options={gameFilters} value={game} onChange={setGame} className="w-64" />
              <Select 
                options={game === 'all' ? [{ value: 'all', label: 'Language' }] : [{ value: 'all', label: 'All Languages' }, { value: 'en', label: 'English' }, { value: 'ja', label: 'Japanese' }]}
                value={game === 'all' ? 'all' : lang}
                onChange={game === 'all' ? () => {} : setLang}
                className="w-40"
                disabled={game === 'all'}
              />
              <Select 
                options={game === 'all' ? [{ value: 'all', label: 'Sets' }] : setFilters}
                value={game === 'all' ? 'all' : cardSet}
                onChange={game === 'all' ? () => {} : setCardSet}
                className="w-48"
                disabled={game === 'all'}
              />
            </div>
            <Select options={sortOptions} value={sort} onChange={setSort} className="w-44" />
          </div>
        </div>

        {/* Active Filters & Search */}
        <div className="mb-6 flex flex-row items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 min-h-[32px]">
            {activeFilters.length > 0 && (
              <>
                <span className="text-sm text-zinc-400">Active filters:</span>
                {activeFilters.map((filter) => (
                  <Badge key={filter} variant="secondary" className="gap-1 bg-white/10 text-white hover:bg-white/20 border-transparent">
                    {filter}
                    <button onClick={clearFilters}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
                <button onClick={clearFilters} className="text-sm text-orange-400 hover:text-orange-300 hover:underline">
                  Clear all
                </button>
              </>
            )}
          </div>
          <div className="w-80 shrink-0">
            <SearchBar size="sm" placeholder="Search any card..." />
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* MOBILE LAYOUT (Hidden on desktop)         */}
      {/* ========================================= */}
      <div className="flex flex-col sm:hidden gap-4 mb-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {query ? `Results for "${query}"` : 'Market Overview'}
          </h1>
          <p className="text-sm text-zinc-400">
            {totalCount || results.length} results found
          </p>
        </div>

        {/* Search Bar */}
        <div className="w-full shrink-0">
          <SearchBar size="sm" placeholder="Search any card..." />
        </div>

        {/* Controls: Filter Icon & Sort Dropdown */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex h-10 items-center justify-center rounded-lg border border-white/10 bg-[#0b1329]/80 backdrop-blur-sm px-3 text-sm ring-offset-[#060c18] transition-all hover:bg-white/5 hover:border-orange-500/30 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
              showFilters && "ring-2 ring-orange-500 ring-offset-2 border-orange-500/50"
            )}
          >
            <SlidersHorizontal className={cn("h-4 w-4 transition-colors", showFilters ? "text-orange-400" : "text-zinc-400")} />
            {activeFilters.length > 0 && (
              <Badge variant="default" className="ml-1.5 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                {activeFilters.length}
              </Badge>
            )}
          </button>

          <Select options={sortOptions} value={sort} onChange={setSort} className="w-52" />
        </div>

        {/* Expansion Panel (Mobile Filters) */}
        {showFilters && (
          <div className="rounded-lg border border-white/10 bg-[#0b1329]/80 backdrop-blur-sm p-4">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Game</label>
                <Select options={gameFilters} value={game} onChange={setGame} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Language</label>
                <Select 
                  options={game === 'all' ? [{ value: 'all', label: 'Language' }] : [{ value: 'all', label: 'All Languages' }, { value: 'en', label: 'English' }, { value: 'ja', label: 'Japanese' }]} 
                  value={game === 'all' ? 'all' : lang} 
                  onChange={game === 'all' ? () => {} : setLang} 
                  disabled={game === 'all'}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-300">Set</label>
                <Select 
                  options={game === 'all' ? [{ value: 'all', label: 'Sets' }] : setFilters} 
                  value={game === 'all' ? 'all' : cardSet} 
                  onChange={game === 'all' ? () => {} : setCardSet} 
                  disabled={game === 'all'}
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((filter) => (
              <Badge key={filter} variant="secondary" className="gap-1 bg-white/10 text-white hover:bg-white/20 border-transparent">
                {filter}
                <button onClick={clearFilters}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            <button onClick={clearFilters} className="text-sm text-orange-400 hover:text-orange-300 hover:underline">
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading && results.length === 0 ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[5/7] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {results.map((card) => (
              <CardPreview
                key={`${card.id}-${card.slug}`}
                card={card}
                gameSlug={card.gameSlug}
              />
            ))}
          </div>
          {isLoading && page > 1 && (
            <div className="mt-8 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[5/7] w-full rounded-lg" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">
            No results found
          </h2>
          <p className="mt-2 text-zinc-400">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
          {activeFilters.length > 0 && (
            <Button variant="outline" className="mt-4 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {results.length > 0 && hasMore && (
        <div className="mt-12 flex items-center justify-center">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={() => setPage(p => p + 1)}
            disabled={isLoading}
            className="w-full max-w-sm rounded-full bg-gradient-to-r from-orange-600 to-amber-500 border-none text-white hover:from-orange-500 hover:to-amber-400 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] transition-all font-bold"
          >
            {isLoading ? 'Loading...' : 'Load More Cards'}
          </Button>
        </div>
      )}
    </>
  );
}

function SearchResultsSkeleton() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[5/7] w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-[#060c18] text-zinc-100 font-sans pt-28 pb-20">
      <div className="container mx-auto px-4 dark-theme-wrapper">
        <Suspense fallback={<SearchResultsSkeleton />}>
          <SearchResults />
        </Suspense>
      </div>
      
      {/* CSS overrides for dark theme injection into components that were light mode only */}
      <style dangerouslySetInnerHTML={{__html: `
        .dark-theme-wrapper {
          color: white;
        }
        .dark-theme-wrapper .bg-white {
          background-color: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .dark-theme-wrapper .text-stone-950,
        .dark-theme-wrapper .text-stone-900 {
          color: white !important;
        }
        .dark-theme-wrapper .text-stone-500,
        .dark-theme-wrapper .text-stone-600 {
          color: #9ca3af !important; 
        }
        .dark-theme-wrapper .border-stone-200 {
          border-color: rgba(255,255,255,0.1) !important;
        }
      `}} />
    </main>
  );
}
