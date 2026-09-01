'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cdnImageUrl } from '@/lib/images/cloudflare-loader';
import {
  Plus,
  FolderOpen,
  Briefcase,
  Tag,
  Heart,
  Trash2,
  Search,
  Grid,
  List,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatPriceChange } from '@/lib/utils';
import { useCollections, useCollection } from '@/hooks/use-collections';
import { authClient } from '@/lib/auth-client';

// Map collection type to icon
function getCollectionIcon(type: string) {
  switch (type) {
    case 'investment':
      return Briefcase;
    case 'for-sale':
      return Tag;
    case 'wishlist':
      return Heart;
    default:
      return FolderOpen;
  }
}

// ─── New Collection Modal ────────────────────────────────────────────────────

interface NewCollectionModalProps {
  onClose: () => void;
  createCollection: (data: {
    name: string;
    type?: string;
    description?: string;
  }) => Promise<unknown>;
}

function NewCollectionModal({
  onClose,
  createCollection,
}: NewCollectionModalProps) {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('personal');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const firstInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createCollection({ name: name.trim(), type });
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create collection',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-collection-title"
        className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 dark:text-zinc-100 p-6 shadow-xl"
      >
        <h2 id="new-collection-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-100">New Collection</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="collection-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
            <Input
              id="collection-name"
              ref={firstInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Collection"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="collection-type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</label>
            <select
              id="collection-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-200 bg-white dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              <option value="personal">Personal</option>
              <option value="investment">Investment</option>
              <option value="for-sale">For Sale</option>
              <option value="wishlist">Wishlist</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex-1"
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</>
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Collection Items View ───────────────────────────────────────────────────

function CollectionItemsView({
  collectionId,
  viewMode,
  searchQuery,
}: {
  collectionId: string;
  viewMode: 'grid' | 'list';
  searchQuery: string;
}) {
  const { items, isLoading, error, removeItem } = useCollection(collectionId);

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = item.cards?.name?.toLowerCase() ?? '';
    const setName = item.cards?.sets?.name?.toLowerCase() ?? '';
    const grade = (item.grade ?? '').toLowerCase();
    return name.includes(q) || setName.includes(q) || grade.includes(q);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="font-medium text-red-600">Your collection didn&apos;t load</p>
        <p className="text-sm text-zinc-500 mt-1">We couldn&apos;t reach the server. Try refreshing the page.</p>
        <button onClick={() => window.location.reload()} className="mt-4 text-sm text-zinc-600 underline">
          Refresh
        </button>
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FolderOpen className="h-12 w-12 text-zinc-300" />
        <h2 className="mt-4 text-xl font-semibold text-zinc-900">
          {searchQuery ? 'No cards match your search' : 'No cards yet'}
        </h2>
        <p className="mt-2 text-zinc-500">
          {searchQuery
            ? 'Try adjusting your search query.'
            : 'Start building your collection by adding your first card.'}
        </p>
        {!searchQuery && (
          <Button className="mt-4">
            <Plus className="h-4 w-4" />
            Add Your First Card
          </Button>
        )}
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <div className="relative p-4">
              <div className="mx-auto w-fit">
                {item.cards?.image_url || item.cards?.local_image_url ? (
                  <img
                    src={cdnImageUrl(
                      item.cards.local_image_url ??
                      item.cards.image_url ??
                      undefined,
                      224,
                    ) ?? undefined}
                    alt={item.cards.name}
                    className="h-40 w-28 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-40 w-28 rounded-lg bg-zinc-100" />
                )}
              </div>
              {item.grade && (
                <Badge variant="grade" className="absolute top-2 right-2">
                  {item.grade}
                </Badge>
              )}
            </div>
            <CardContent className="border-t border-zinc-100">
              {item.cards ? (
                <Link
                  href={`/pokemon/${item.cards.sets?.slug ?? ''}/${item.cards.slug}`}
                >
                  <h3 className="font-semibold text-zinc-900 hover:text-blue-600">
                    {item.cards.name}
                  </h3>
                </Link>
              ) : (
                <h3 className="font-semibold text-zinc-900">Unknown Card</h3>
              )}
              <p className="text-sm text-zinc-500">
                {item.cards?.sets?.name} - #{item.cards?.number}
              </p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Value</p>
                  <p className="font-bold text-zinc-900">
                    {item.current_value != null
                      ? formatPrice(item.current_value)
                      : '—'}
                  </p>
                </div>
                {item.current_value != null &&
                  item.cost_basis != null &&
                  item.cost_basis > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Gain/Loss</p>
                      <p
                        className={`font-medium ${
                          item.current_value >= item.cost_basis
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatPriceChange(
                          ((item.current_value - item.cost_basis) /
                            item.cost_basis) *
                            100,
                        )}
                      </p>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-4"
        >
          <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-zinc-100">
            {(item.cards?.local_image_url || item.cards?.image_url) && (
              <img
                src={cdnImageUrl(
                  item.cards.local_image_url ??
                  item.cards.image_url ??
                  undefined,
                  96,
                ) ?? undefined}
                alt={item.cards?.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {item.cards ? (
              <Link
                href={`/pokemon/${item.cards.sets?.slug ?? ''}/${item.cards.slug}`}
              >
                <h3 className="font-semibold text-zinc-900 hover:text-blue-600">
                  {item.cards.name}
                </h3>
              </Link>
            ) : (
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Unknown Card</h3>
            )}
            <p className="text-sm text-zinc-500">
              {item.cards?.sets?.name} - {item.grade}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-zinc-900 dark:text-zinc-100">
              {item.current_value != null
                ? formatPrice(item.current_value)
                : '—'}
            </p>
            {item.current_value != null &&
              item.cost_basis != null &&
              item.cost_basis > 0 && (
                <p
                  className={`text-sm font-medium ${
                    item.current_value >= item.cost_basis
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }`}
                >
                  {formatPriceChange(
                    ((item.current_value - item.cost_basis) / item.cost_basis) *
                      100,
                  )}
                </p>
              )}
          </div>
          <button
            className="text-zinc-400 hover:text-red-600"
            onClick={() => {
              if (window.confirm('Remove this card from your collection?')) {
                removeItem(item.id);
              }
            }}
            aria-label="Remove item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const router = useRouter();
  const [activeCollection, setActiveCollection] = React.useState<string | null>(
    null,
  );
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showNewCollectionModal, setShowNewCollectionModal] =
    React.useState(false);
  const [isAuthChecked, setIsAuthChecked] = React.useState(false);

  const { collections, isLoading: collectionsLoading, createCollection } =
    useCollections();

  // Auth check — redirect to /login if not signed in
  React.useEffect(() => {
    authClient.getSession().then(({ data }: { data: { user?: unknown } | null }) => {
      if (!data?.user) {
        router.replace('/login');
      } else {
        setIsAuthChecked(true);
      }
    });
  }, [router]);

  const totalValue = collections.reduce(
    (sum, c) => sum + (c.total_value ?? 0),
    0,
  );
  const totalItems = collections.reduce(
    (sum, c) => sum + (c.items_count ?? 0),
    0,
  );

  if (!isAuthChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16">
      {showNewCollectionModal && (
        <NewCollectionModal
          onClose={() => setShowNewCollectionModal(false)}
          createCollection={createCollection}
        />
      )}

      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                My Collection
              </h1>
              <p className="mt-1 text-zinc-500">
                {totalItems} cards across {collections.length} collections
              </p>
            </div>
            <Button onClick={() => setShowNewCollectionModal(true)}>
              <Plus className="h-4 w-4" />
              New Collection
            </Button>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-500">Total Value</p>
                <p className="text-2xl font-bold text-zinc-900">
                  {formatPrice(totalValue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-500">Total Cards</p>
                <p className="text-2xl font-bold text-zinc-900">{totalItems}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-500">Collections</p>
                <p className="text-2xl font-bold text-zinc-900">
                  {collections.length}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar — Collections List */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-2">
              <button
                onClick={() => setActiveCollection(null)}
                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                  activeCollection === null ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                }`}
              >
                <FolderOpen className="h-5 w-5 text-zinc-500" />
                <div className="flex-1">
                  <p className="font-medium text-zinc-900">All Cards</p>
                  <p className="text-sm text-zinc-500">{totalItems} items</p>
                </div>
              </button>

              {collectionsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                </div>
              ) : (
                collections.map((collection) => {
                  const Icon = getCollectionIcon(collection.type);
                  const totalCostBasis = collection.total_cost_basis ?? 0;
                  const collectionTotalValue = collection.total_value ?? 0;
                  const pctChange =
                    totalCostBasis > 0
                      ? ((collectionTotalValue - totalCostBasis) /
                          totalCostBasis) *
                        100
                      : 0;
                  return (
                    <button
                      key={collection.id}
                      onClick={() => setActiveCollection(collection.id)}
                      className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                        activeCollection === collection.id
                          ? 'bg-zinc-100'
                          : 'hover:bg-zinc-50'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-zinc-900">
                          {collection.name}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {collection.items_count} items
                        </p>
                      </div>
                      {totalCostBasis > 0 && (
                        <span
                          className={`text-sm font-medium ${
                            pctChange >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatPriceChange(pctChange)}
                        </span>
                      )}
                    </button>
                  );
                })
              )}

              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setShowNewCollectionModal(true)}
              >
                <Plus className="h-4 w-4" />
                New Collection
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Toolbar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search your collection..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-zinc-200">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-zinc-400 ${
                      viewMode === 'grid' ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-zinc-400 ${
                      viewMode === 'list' ? 'bg-zinc-100' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
                <Button>
                  <Plus className="h-4 w-4" />
                  Add Card
                </Button>
              </div>
            </div>

            {/* Content area */}
            {activeCollection === null ? (
              collections.length === 0 && !collectionsLoading ? (
                /* No collections at all */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="h-12 w-12 text-zinc-300" />
                  <h2 className="mt-4 text-xl font-semibold text-zinc-900">
                    No collections yet
                  </h2>
                  <p className="mt-2 text-zinc-500">
                    Create your first collection to start tracking your cards.
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => setShowNewCollectionModal(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Create Collection
                  </Button>
                </div>
              ) : (
                /* Prompt user to pick a collection */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="h-12 w-12 text-zinc-300" />
                  <h2 className="mt-4 text-xl font-semibold text-zinc-900">
                    Select a collection
                  </h2>
                  <p className="mt-2 text-zinc-500">
                    Choose a collection from the sidebar to view its cards.
                  </p>
                </div>
              )
            ) : (
              <CollectionItemsView
                collectionId={activeCollection}
                viewMode={viewMode}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
