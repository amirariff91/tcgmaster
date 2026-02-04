'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { Tables } from '@/lib/supabase/database.types';

type Collection = Tables<'collections'>;
type CollectionItem = Tables<'collection_items'> & {
  cards?: {
    id: string;
    name: string;
    slug: string;
    number: string;
    rarity: string | null;
    image_url: string | null;
    local_image_url: string | null;
    sets?: {
      id: string;
      name: string;
      slug: string;
      games?: {
        id: string;
        name: string;
        slug: string;
      };
    };
  };
  grading_companies?: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

interface UseCollectionsReturn {
  collections: Collection[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createCollection: (data: { name: string; type?: string; description?: string; is_public?: boolean }) => Promise<Collection>;
  updateCollection: (id: string, data: Partial<Collection>) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
}

export function useCollections(): UseCollectionsReturn {
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchCollections = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/collections');
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch collections');
      }

      setCollections(json.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const createCollection = React.useCallback(async (data: { name: string; type?: string; description?: string; is_public?: boolean }) => {
    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || 'Failed to create collection');
    }

    // Optimistic update
    setCollections((prev) => [json.data, ...prev]);

    return json.data;
  }, []);

  const updateCollection = React.useCallback(async (id: string, data: Partial<Collection>) => {
    // Optimistic update
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data } : c))
    );

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await response.json();

      if (!response.ok) {
        // Rollback on error
        await fetchCollections();
        throw new Error(json.error || 'Failed to update collection');
      }

      return json.data;
    } catch (err) {
      // Rollback on error
      await fetchCollections();
      throw err;
    }
  }, [fetchCollections]);

  const deleteCollection = React.useCallback(async (id: string) => {
    // Optimistic update
    const previousCollections = collections;
    setCollections((prev) => prev.filter((c) => c.id !== id));

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const json = await response.json();
        // Rollback on error
        setCollections(previousCollections);
        throw new Error(json.error || 'Failed to delete collection');
      }
    } catch (err) {
      // Rollback on error
      setCollections(previousCollections);
      throw err;
    }
  }, [collections]);

  return {
    collections,
    isLoading,
    error,
    refetch: fetchCollections,
    createCollection,
    updateCollection,
    deleteCollection,
  };
}

interface UseCollectionReturn {
  collection: Collection | null;
  items: CollectionItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addItem: (data: AddItemData) => Promise<CollectionItem>;
  addItemFromCert: (certNumber: string, gradingCompany?: string) => Promise<{ item: CollectionItem; cert: CertData }>;
  removeItem: (itemId: string) => Promise<void>;
}

interface AddItemData {
  card_id: string;
  variant_id?: string;
  grade?: string;
  grading_company_id?: string;
  cert_number?: string;
  cost_basis?: number;
  acquisition_date?: string;
  acquisition_type?: string;
  notes?: string;
}

interface CertData {
  certNumber: string;
  grade: number;
  subgrades?: Record<string, number>;
  certDate?: string;
  holderGeneration?: string;
  isReholder?: boolean;
  cardDetails: { name?: string };
  matched: boolean;
}

export function useCollection(collectionId: string): UseCollectionReturn {
  const [collection, setCollection] = React.useState<Collection | null>(null);
  const [items, setItems] = React.useState<CollectionItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchCollection = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch collection');
      }

      setCollection(json.data);
      setItems(json.data.collection_items || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [collectionId]);

  React.useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  const addItem = React.useCallback(async (data: AddItemData) => {
    const response = await fetch(`/api/collections/${collectionId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || 'Failed to add item');
    }

    // Optimistic update
    setItems((prev) => [...prev, json.data]);

    return json.data;
  }, [collectionId]);

  const addItemFromCert = React.useCallback(async (certNumber: string, gradingCompany = 'psa') => {
    const response = await fetch(`/api/collections/${collectionId}/items/from-cert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cert_number: certNumber, grading_company: gradingCompany }),
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || 'Failed to add item from cert');
    }

    // Optimistic update
    setItems((prev) => [...prev, json.data.item]);

    return json.data;
  }, [collectionId]);

  const removeItem = React.useCallback(async (itemId: string) => {
    // Optimistic update
    const previousItems = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    try {
      const response = await fetch(`/api/collections/${collectionId}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      });

      if (!response.ok) {
        const json = await response.json();
        // Rollback on error
        setItems(previousItems);
        throw new Error(json.error || 'Failed to remove item');
      }
    } catch (err) {
      // Rollback on error
      setItems(previousItems);
      throw err;
    }
  }, [collectionId, items]);

  return {
    collection,
    items,
    isLoading,
    error,
    refetch: fetchCollection,
    addItem,
    addItemFromCert,
    removeItem,
  };
}
