'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  Search,
  Calendar,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type MockSet } from '@/lib/mock-data';
import { CardGridItem, CardGridItemSkeleton } from '@/components/cards/card-grid-item';
import { NoCards } from '@/components/empty-states/no-cards';
import { BackToTop } from '@/components/ui/back-to-top';
import { trackSetViewed, trackSearchPerformed, trackInfiniteScroll } from '@/lib/analytics';

const CARDS_PER_BATCH = 12;
const SEARCH_DEBOUNCE_MS = 300;

interface SetPageClientProps {
  setData: MockSet;
  relatedSets: MockSet[];
  gameSlug: string;
  initialQuery?: string;
  initialSort?: string;
}

// Helper to get initial sort from localStorage or props
function getInitialSort(initialSort?: string, setSlug?: string): 'number' | 'price' | 'name' {
  if (initialSort === 'price' || initialSort === 'name' || initialSort === 'number') {
    return initialSort;
  }
  if (typeof window !== 'undefined' && setSlug) {
    const saved = localStorage.getItem(`tcgmaster_set_${setSlug}_sort`);
    if (saved === 'price' || saved === 'name' || saved === 'number') {
      return saved;
    }
  }
  return 'number';
}

export function SetPageClient({
  setData,
  relatedSets,
  gameSlug,
  initialQuery,
  initialSort,
}: SetPageClientProps) {
  const router = useRouter();

  // State with lazy initialization for sort
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || '');
  const [sortBy, setSortBy] = useState<'number' | 'price' | 'name'>(() =>
    getInitialSort(initialSort, setData.slug)
  );
  const [visibleCards, setVisibleCards] = useState(CARDS_PER_BATCH);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Mock logged-in state - replace with actual auth
  const isLoggedIn = false;
  const ownedCardIds = new Set<string>(); // Would come from user's collection

  // Refs
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef(1);

  // Track page view on mount
  useEffect(() => {
    trackSetViewed(gameSlug, setData.slug, setData.name);
  }, [gameSlug, setData.slug, setData.name]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update URL when search/sort changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (sortBy !== 'number') params.set('sort', sortBy);

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;

    // Only update if changed
    if (window.location.search !== (queryString ? `?${queryString}` : '')) {
      router.replace(newUrl, { scroll: false });
    }

    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem(`tcgmaster_set_${setData.slug}_sort`, sortBy);
    }
  }, [debouncedQuery, sortBy, router, setData.slug]);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let cards = [...setData.cards];

    // Filter by search query
    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase();
      cards = cards.filter(
        (card) =>
          card.name.toLowerCase().includes(query) ||
          card.number.toLowerCase().includes(query)
      );

      // Track search
      trackSearchPerformed(debouncedQuery, 'set', cards.length);
    }

    // Sort cards
    switch (sortBy) {
      case 'price':
        cards.sort((a, b) => (b.prices.raw ?? 0) - (a.prices.raw ?? 0));
        break;
      case 'name':
        cards.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'number':
      default:
        // Sort by card number (collector order)
        cards.sort((a, b) => {
          const numA = parseInt(a.number.split('/')[0]) || 0;
          const numB = parseInt(b.number.split('/')[0]) || 0;
          return numA - numB;
        });
    }

    return cards;
  }, [setData.cards, debouncedQuery, sortBy]);

  // Cards to display (with infinite scroll)
  const displayedCards = filteredCards.slice(0, visibleCards);
  const hasMoreCards = visibleCards < filteredCards.length;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreCards && !isLoadingMore) {
          setIsLoadingMore(true);

          // Simulate loading delay for better UX
          setTimeout(() => {
            setVisibleCards((prev) => prev + CARDS_PER_BATCH);
            batchRef.current += 1;
            trackInfiniteScroll('set', batchRef.current);
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMoreCards, isLoadingMore]);

  // Reset visible cards when filter/sort changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCards(CARDS_PER_BATCH);
    batchRef.current = 1;
  }, [debouncedQuery, sortBy]);

  // Calculate collection stats
  const ownedCount = setData.cards.filter((card) => ownedCardIds.has(card.id)).length;
  const totalCount = setData.cards.length;

  // Quick add handler
  const handleQuickAdd = useCallback(async (cardId: string, grade: string) => {
    // This would call an API to add to collection
    console.log('Adding card:', cardId, 'grade:', grade);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
  }, []);

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-zinc-200">
        <div className="container py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link href={`/${gameSlug}`} className="text-zinc-500 hover:text-zinc-900">
              {setData.game}
            </Link>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
            <span className="text-zinc-900 font-medium">{setData.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white border-b border-zinc-200">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">{setData.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(setData.release_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
                <span className="flex items-center gap-1">
                  <LayoutGrid className="h-4 w-4" />
                  {setData.card_count} cards
                </span>
              </div>
              <p className="mt-3 text-zinc-600 max-w-2xl">{setData.description}</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 rounded-lg',
                  'bg-zinc-100 border border-transparent',
                  'text-zinc-900 placeholder:text-zinc-500',
                  'focus:outline-none focus:border-blue-500 focus:bg-white',
                  'transition-colors duration-150'
                )}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Card Grid */}
          <div className="flex-1 min-w-0">
            {/* Sort Controls */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-zinc-500">
                {filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'}
                {debouncedQuery && ` matching "${debouncedQuery}"`}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'number' | 'price' | 'name')}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm',
                    'bg-white border border-zinc-200',
                    'text-zinc-900',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500'
                  )}
                >
                  <option value="number">Card Number</option>
                  <option value="price">Price (High to Low)</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Cards Grid or Empty State */}
            {displayedCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedCards.map((card) => (
                  <CardGridItem
                    key={card.id}
                    card={card}
                    gameSlug={gameSlug}
                    setSlug={setData.slug}
                    isOwned={ownedCardIds.has(card.id)}
                    isLoggedIn={isLoggedIn}
                    onQuickAdd={handleQuickAdd}
                  />
                ))}

                {/* Loading skeletons */}
                {isLoadingMore &&
                  Array.from({ length: CARDS_PER_BATCH }).map((_, i) => (
                    <CardGridItemSkeleton key={`skeleton-${i}`} />
                  ))}
              </div>
            ) : (
              <NoCards searchQuery={debouncedQuery} onClearSearch={clearSearch} />
            )}

            {/* Infinite scroll trigger */}
            {hasMoreCards && <div ref={loadMoreRef} className="h-10" />}
          </div>

          {/* Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            {/* Mobile Accordion Toggle */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                'lg:hidden w-full flex items-center justify-between',
                'px-4 py-3 rounded-lg',
                'bg-white border border-zinc-200',
                'text-zinc-900 font-medium'
              )}
            >
              Set Info & Related Sets
              {isSidebarOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            <div
              className={cn(
                'lg:block space-y-6 mt-4 lg:mt-0',
                !isSidebarOpen && 'hidden'
              )}
            >
              {/* Collection Progress (if logged in) */}
              {isLoggedIn && (
                <div className="bg-white rounded-lg border border-zinc-200 p-4">
                  <h3 className="font-semibold text-zinc-900 mb-3">Your Collection</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Cards Owned</span>
                      <span className="font-medium text-zinc-900">
                        {ownedCount} / {totalCount}
                      </span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${(ownedCount / totalCount) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500">
                      {Math.round((ownedCount / totalCount) * 100)}% complete
                    </p>
                  </div>
                </div>
              )}

              {/* Set Stats */}
              <div className="bg-white rounded-lg border border-zinc-200 p-4">
                <h3 className="font-semibold text-zinc-900 mb-3">Set Stats</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Total Cards</dt>
                    <dd className="font-medium text-zinc-900">{setData.card_count}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Release Date</dt>
                    <dd className="font-medium text-zinc-900">
                      {new Date(setData.release_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                      })}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Avg. Raw Price</dt>
                    <dd className="font-medium text-zinc-900">
                      ${setData.avg_price.toFixed(0)}
                    </dd>
                  </div>
                  {setData.trending && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Status</dt>
                      <dd className="font-medium text-emerald-600">Trending</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Related Sets */}
              {relatedSets.length > 0 && (
                <div className="bg-white rounded-lg border border-zinc-200 p-4">
                  <h3 className="font-semibold text-zinc-900 mb-3">Related Sets</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {relatedSets.map((related) => (
                      <Link
                        key={related.id}
                        href={`/${related.gameSlug}/${related.slug}`}
                        className={cn(
                          'block px-3 py-2 rounded-lg',
                          'hover:bg-zinc-50',
                          'transition-colors duration-150'
                        )}
                      >
                        <p className="font-medium text-zinc-900 text-sm">{related.name}</p>
                        <p className="text-xs text-zinc-500">
                          {related.card_count} cards &middot;{' '}
                          {new Date(related.release_date).getFullYear()}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Back to Top */}
      <BackToTop showAfterScreens={2} />
    </div>
  );
}
