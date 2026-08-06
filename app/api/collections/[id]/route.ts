import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth-server';

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
  acquisition_source: string | null;
  notes: string | null;
  current_value: number | null;
  created_at: string;
  cards: CardData | null;
  grading_companies: GradingCompanyData | null;
}

interface PublicCollectionItemData {
  id: string;
  card_id: string | null;
  variant_id: string | null;
  grade: string;
  grading_company_id: string | null;
  cert_number: string | null;
  current_value: number | null;
  created_at: string;
  cards: CardData | null;
  grading_companies: GradingCompanyData | null;
}

interface PublicCollectionWithItems {
  id: string;
  name: string;
  type: string;
  description: string | null;
  is_public: boolean;
  total_value: number | null;
  items_count: number;
  created_at: string;
  updated_at: string;
  collection_items: PublicCollectionItemData[];
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

const OWNER_COLLECTION_SELECT = `
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
    acquisition_source,
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
`;

const PUBLIC_COLLECTION_SELECT = `
  id,
  name,
  type,
  description,
  is_public,
  total_value,
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
`;

// GET /api/collections/[id] - Get a specific collection with items
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  // An owner probe is enough to select the full private projection. Every
  // non-owner, including a signed-in public viewer, uses the safe public path.
  let isOwner = false;
  if (user) {
    const { data: ownerData, error: ownerError } = await supabase
      .from('collections')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (ownerError) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    isOwner = Boolean(ownerData);
  }

  if (isOwner && user) {
    // Owners retain the full private projection, including cost-basis fields.
    const { data: collectionData, error } = await supabase
      .from('collections')
      .select(OWNER_COLLECTION_SELECT)
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    const collection = collectionData as CollectionWithItems | null;

    if (error || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: collection });
  }

  // Option (a): use the server-only service-role client for the public path,
  // with an explicit safe projection. The service role is never exposed to the
  // browser, and the migration also limits direct anon Data API reads.
  const { createServerClient } = await import('@/lib/supabase/client');
  const publicSupabase = createServerClient();
  const { data: publicCollectionData, error: publicError } = await publicSupabase
    .from('collections')
    .select(PUBLIC_COLLECTION_SELECT)
    .eq('id', id)
    .eq('is_public', true)
    .single();

  const publicCollection = publicCollectionData as PublicCollectionWithItems | null;

  if (publicError || !publicCollection) {
    return NextResponse.json(
      { error: 'Collection not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: publicCollection });
}

// PATCH /api/collections/[id] - Update a collection
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  if (!user) {
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
    .eq('user_id', user.id)
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
    .eq('user_id', user.id)
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
  const user = await getAuthUser();

  if (!user) {
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
    .eq('user_id', user.id)
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
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
