'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Plus,
  FolderOpen,
  Briefcase,
  Tag,
  Heart,
  MoreHorizontal,
  Search,
  Grid,
  List,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CardPreview } from '@/components/card/card-preview';
import { formatPrice, formatPriceChange } from '@/lib/utils';

// Mock collections
const mockCollections = [
  {
    id: '1',
    name: 'Personal Collection',
    type: 'personal',
    icon: FolderOpen,
    item_count: 47,
    total_value: 125000,
    change_30d: 8.5,
  },
  {
    id: '2',
    name: 'Investment Holdings',
    type: 'investment',
    icon: Briefcase,
    item_count: 12,
    total_value: 85000,
    change_30d: 12.3,
  },
  {
    id: '3',
    name: 'For Sale',
    type: 'for-sale',
    icon: Tag,
    item_count: 8,
    total_value: 15000,
    change_30d: -2.1,
  },
  {
    id: '4',
    name: 'Wishlist',
    type: 'wishlist',
    icon: Heart,
    item_count: 23,
    total_value: 250000,
    change_30d: 5.2,
  },
];

// Mock collection items
const mockItems = [
  {
    id: '1',
    card: {
      id: '1',
      name: 'Charizard',
      slug: 'charizard-holo',
      number: '4',
      rarity: 'holo-rare' as const,
      image_url: '/cards/charizard.png',
      set: { id: '1', name: 'Base Set', slug: 'base-set' },
    },
    grade: 'PSA 10',
    cert_number: '12345678',
    cost_basis: 35000,
    current_value: 42000,
    acquisition_date: '2023-06-15',
  },
  {
    id: '2',
    card: {
      id: '2',
      name: 'Blastoise',
      slug: 'blastoise-holo',
      number: '2',
      rarity: 'holo-rare' as const,
      image_url: '/cards/blastoise.png',
      set: { id: '1', name: 'Base Set', slug: 'base-set' },
    },
    grade: 'PSA 9',
    cert_number: '87654321',
    cost_basis: 2500,
    current_value: 2800,
    acquisition_date: '2023-08-20',
  },
  {
    id: '3',
    card: {
      id: '3',
      name: 'Venusaur',
      slug: 'venusaur-holo',
      number: '15',
      rarity: 'holo-rare' as const,
      image_url: '/cards/venusaur.png',
      set: { id: '1', name: 'Base Set', slug: 'base-set' },
    },
    grade: 'Raw',
    cert_number: null,
    cost_basis: 300,
    current_value: 450,
    acquisition_date: '2024-01-10',
  },
];

export default function CollectionPage() {
  const [activeCollection, setActiveCollection] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = React.useState('');

  const totalValue = mockCollections.reduce((sum, c) => sum + c.total_value, 0);
  const totalItems = mockCollections.reduce((sum, c) => sum + c.item_count, 0);

  return (
    <div className="min-h-screen pb-16">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-zinc-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900">
                My Collection
              </h1>
              <p className="mt-1 text-zinc-500">
                {totalItems} cards across {mockCollections.length} collections
              </p>
            </div>
            <Button>
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
                <p className="text-2xl font-bold text-zinc-900">
                  {totalItems}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-zinc-500">30 Day Change</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatPriceChange(8.5)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar - Collections List */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-2">
              <button
                onClick={() => setActiveCollection(null)}
                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                  activeCollection === null
                    ? 'bg-zinc-100'
                    : 'hover:bg-zinc-50'
                }`}
              >
                <FolderOpen className="h-5 w-5 text-zinc-500" />
                <div className="flex-1">
                  <p className="font-medium text-zinc-900">All Cards</p>
                  <p className="text-sm text-zinc-500">{totalItems} items</p>
                </div>
              </button>

              {mockCollections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => setActiveCollection(collection.id)}
                  className={`flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                    activeCollection === collection.id
                      ? 'bg-zinc-100'
                      : 'hover:bg-zinc-50'
                  }`}
                >
                  <collection.icon className="h-5 w-5 text-zinc-500" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-zinc-900">
                      {collection.name}
                    </p>
                    <p className="text-sm text-zinc-500">{collection.item_count} items</p>
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      collection.change_30d >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {formatPriceChange(collection.change_30d)}
                  </span>
                </button>
              ))}

              <Button variant="outline" className="w-full mt-4">
                <Plus className="h-4 w-4" />
                New Collection
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Toolbar */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
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
                    className={`p-2 ${
                      viewMode === 'grid'
                        ? 'bg-zinc-100'
                        : 'hover:bg-zinc-50'
                    }`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 ${
                      viewMode === 'list'
                        ? 'bg-zinc-100'
                        : 'hover:bg-zinc-50'
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

            {/* Collection Items */}
            {viewMode === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {mockItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="relative p-4">
                      <div className="mx-auto w-fit">
                        <div className="h-40 w-28 rounded-lg bg-zinc-100" />
                      </div>
                      <Badge variant="grade" className="absolute top-2 right-2">
                        {item.grade}
                      </Badge>
                    </div>
                    <CardContent className="border-t border-zinc-100">
                      <Link href={`/pokemon/${item.card.set.slug}/${item.card.slug}`}>
                        <h3 className="font-semibold text-zinc-900 hover:text-blue-600">
                          {item.card.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-zinc-500">
                        {item.card.set.name} - #{item.card.number}
                      </p>
                      <div className="mt-3 flex items-end justify-between">
                        <div>
                          <p className="text-xs text-zinc-500">Value</p>
                          <p className="font-bold text-zinc-900">
                            {formatPrice(item.current_value)}
                          </p>
                        </div>
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
                              ((item.current_value - item.cost_basis) / item.cost_basis) * 100
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {mockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <div className="h-16 w-12 rounded bg-zinc-100" />
                    <div className="flex-1 min-w-0">
                      <Link href={`/pokemon/${item.card.set.slug}/${item.card.slug}`}>
                        <h3 className="font-semibold text-zinc-900 hover:text-blue-600">
                          {item.card.name}
                        </h3>
                      </Link>
                      <p className="text-sm text-zinc-500">
                        {item.card.set.name} - {item.grade}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-zinc-900">
                        {formatPrice(item.current_value)}
                      </p>
                      <p
                        className={`text-sm font-medium ${
                          item.current_value >= item.cost_basis
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {formatPriceChange(
                          ((item.current_value - item.cost_basis) / item.cost_basis) * 100
                        )}
                      </p>
                    </div>
                    <button className="text-zinc-400 hover:text-zinc-600">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {mockItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="h-12 w-12 text-zinc-300" />
                <h2 className="mt-4 text-xl font-semibold text-zinc-900">
                  No cards yet
                </h2>
                <p className="mt-2 text-zinc-500">
                  Start building your collection by adding your first card.
                </p>
                <Button className="mt-4">
                  <Plus className="h-4 w-4" />
                  Add Your First Card
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
