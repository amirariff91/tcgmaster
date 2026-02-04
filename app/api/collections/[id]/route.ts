import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CollectionOwnerRow {
  user_id: string;
}

interface CollectionWithItems {
  id: string;
  user_id: string;
  name: string;
  type: string;
  description: string | null;
  is_public: boolean;
  anonymous_share: boolean;
  share_token: string | null;
  total_value: number | null;
  total_cost_basis: number | null;
  items_count: number;
  created_at: string;
  updated_at: string;
  collection_items: CollectionItemData[];
}

interface CollectionItemData {
  id: string;
  card_id: string | null;
  variant_id: string | null;
  grade: string;
  grading_company_id: string | null;
  cert_number: string | null;
  cost_basis: number | null;
  cost_basis_source: string;
  fees: number | null;
  acquisition_date: string | null;
  acquisition_type: string;
  notes: string | null;
  current_value: number | null;
  created_at: string;
  cards: CardData | null;
  grading_companies: GradingCompanyData | null;
}

interface CardData {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity: string | null;
  image_url: string | null;
  local_image_url: string | null;
  sets: SetData | null;
}

interface SetData {
  id: string;
  name: string;
  slug: string;
  games: GameData | null;
}

interface GameData {
  id: string;
  name: string;
  slug: string;
}

interface GradingCompanyData {
  id: string;
  name: string;
  slug: string;
}

// GET /api/collections/[id] - Get a specific collection with items
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch the collection
  const { data: collectionData, error } = await supabase
    .from('collections')
    .select(`
      id,
      user_id,
      name,
      type,
      description,
      is_public,
      anonymous_share,
      share_token,
      total_value,
      total_cost_basis,
      items_count,
      created_at,
      updated_at,
      collection_items (
        id,
        card_id,
        variant_id,
        grade,
        grading_company_id,
        cert_number,
        cost_basis,
        cost_basis_source,
        fees,
        acquisition_date,
        acquisition_type,
        notes,
        current_value,
        created_at,
        cards (
          id,
          name,
          slug,
          number,
          rarity,
          image_url,
          local_image_url,
          sets (
            id,
            name,
            slug,
            games (
              id,
              name,
              slug
            )
          )
        ),
        grading_companies (
          id,
          name,
          slug
        )
      )
    `)
    .eq('id', id)
    .single();

  const collection = collectionData as CollectionWithItems | null;

  if (error || !collection) {
    return NextResponse.json(
      { error: 'Collection not found' },
      { status: 404 }
    );
  }

  // Check access - must be owner or collection must be public
  if (collection.user_id !== user?.id && !collection.is_public) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // Hide user_id if anonymous share
  if (collection.anonymous_share && collection.user_id !== user?.id) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id, ...publicCollection } = collection;
    return NextResponse.json({ data: publicCollection });
  }

  return NextResponse.json({ data: collection });
}

// PATCH /api/collections/[id] - Update a collection
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  const { data: existingData } = await supabase
    .from('collections')
    .select('user_id')
    .eq('id', id)
    .single();

  const existing = existingData as CollectionOwnerRow | null;

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Collection not found or access denied' },
      { status: 404 }
    );
  }

  const body = await request.json();
  const allowedFields = ['name', 'type', 'description', 'is_public', 'anonymous_share'];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collection, error } = await (supabase.from('collections') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: collection });
}

// DELETE /api/collections/[id] - Delete a collection
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  const { data: existingDeleteData } = await supabase
    .from('collections')
    .select('user_id')
    .eq('id', id)
    .single();

  const existingDelete = existingDeleteData as CollectionOwnerRow | null;

  if (!existingDelete || existingDelete.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Collection not found or access denied' },
      { status: 404 }
    );
  }

  // Delete collection (cascade will delete items)
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
