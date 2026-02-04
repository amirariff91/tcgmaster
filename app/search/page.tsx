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

// Mock search results - image_url set to null since images don't exist
// CardPreview component has graceful fallback UI
const mockResults = [
  {
    id: '1',
    name: 'Charizard',
    slug: 'charizard-holo',
    number: '4',
    rarity: 'holo-rare' as const,
    image_url: null as string | null,
    set: { id: '1', name: 'Base Set', slug: 'base-set' },
    current_price: 42000,
    price_change_24h: 2.5,
  },
  {
    id: '2',
    name: 'Charizard',
    slug: 'charizard-holo',
    number: '4',
    rarity: 'holo-rare' as const,
    image_url: null as string | null,
    set: { id: '2', name: 'Base Set 2', slug: 'base-set-2' },
    current_price: 1200,
    price_change_24h: -1.2,
  },
  {
    id: '3',
    name: 'Charizard GX',
    slug: 'charizard-gx',
    number: '9',
    rarity: 'ultra-rare' as const,
    image_url: null as string | null,
    set: { id: '3', name: 'Burning Shadows', slug: 'burning-shadows' },
    current_price: 85,
    price_change_24h: 0,
  },
];

const sortOptions = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'name-asc', label: 'Name: A-Z' },
  { value: 'recent', label: 'Recently Updated' },
];

const gameFilters = [
  { value: 'all', label: 'All Games' },
  { value: 'pokemon', label: 'Pokemon' },
  { value: 'sports-basketball', label: 'Basketball' },
  { value: 'sports-baseball', label: 'Baseball' },
];

const gradeFilters = [
  { value: 'all', label: 'All Grades' },
  { value: 'raw', label: 'Raw Only' },
  { value: 'graded', label: 'Graded Only' },
  { value: 'psa-10', label: 'PSA 10' },
  { value: 'psa-9', label: 'PSA 9' },
  { value: 'bgs-10', label: 'BGS 10' },
];

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState(mockResults);
  const [sort, setSort] = React.useState('relevance');
  const [game, setGame] = React.useState('all');
  const [grade, setGrade] = React.useState('all');
  const [showFilters, setShowFilters] = React.useState(false);

  const activeFilters = React.useMemo(() => {
    const filters: string[] = [];
    if (game !== 'all') filters.push(gameFilters.find(g => g.value === game)?.label || game);
    if (grade !== 'all') filters.push(gradeFilters.find(g => g.value === grade)?.label || grade);
    return filters;
  }, [game, grade]);

  const clearFilters = () => {
    setGame('all');
    setGrade('all');
  };

  return (
    <>
      {/* Results Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {query ? `Results for "${query}"` : 'Search Results'}
          </h1>
          <p className="text-sm text-zinc-500">
            {results.length} results found
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="sm:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilters.length > 0 && (
              <Badge variant="default" className="ml-1 h-5 w-5 rounded-full p-0">
                {activeFilters.length}
              </Badge>
            )}
          </Button>

          <div className="hidden items-center gap-2 sm:flex">
            <Select
              options={gameFilters}
              value={game}
              onChange={setGame}
              className="w-40"
            />
            <Select
              options={gradeFilters}
              value={grade}
              onChange={setGrade}
              className="w-36"
            />
          </div>

          <Select
            options={sortOptions}
            value={sort}
            onChange={setSort}
            className="w-44"
          />
        </div>
      </div>

      {/* Mobile Filters */}
      {showFilters && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 sm:hidden">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Game
              </label>
              <Select options={gameFilters} value={game} onChange={setGame} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-700">
                Grade
              </label>
              <Select options={gradeFilters} value={grade} onChange={setGrade} />
            </div>
          </div>
        </div>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500">Active filters:</span>
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="secondary" className="gap-1">
              {filter}
              <button onClick={clearFilters}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[5/7] w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((card) => (
            <CardPreview
              key={card.id}
              card={card}
              gameSlug="pokemon"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-12 w-12 text-zinc-300" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">
            No results found
          </h2>
          <p className="mt-2 text-zinc-500">
            Try adjusting your search or filters to find what you&apos;re looking for.
          </p>
          {activeFilters.length > 0 && (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {results.length > 0 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <span className="px-4 text-sm text-zinc-500">Page 1 of 1</span>
          <Button variant="outline" size="sm" disabled>
            Next
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
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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
    <div className="min-h-screen">
      {/* Search Header */}
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="container mx-auto px-4 py-6">
          <div className="mx-auto max-w-2xl">
            <SearchBar size="md" placeholder="Search cards..." />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={<SearchResultsSkeleton />}>
          <SearchResults />
        </Suspense>
      </div>
    </div>
  );
}
