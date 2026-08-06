import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-server';
import { dbQuery } from '@/lib/db/client';

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

const OWNER_COLLECTION_QUERY = `
  SELECT
    col.id,
    col.user_id,
    col.name,
    col.type,
    col.description,
    col.is_public,
    col.anonymous_share,
    col.share_token,
    col.total_value::float8 AS total_value,
    col.total_cost_basis::float8 AS total_cost_basis,
    col.items_count,
    col.created_at,
    col.updated_at,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', ci.id,
        'card_id', ci.card_id,
        'variant_id', ci.variant_id,
        'grade', ci.grade,
        'grading_company_id', ci.grading_company_id,
        'cert_number', ci.cert_number,
        'cost_basis', ci.cost_basis::float8,
        'cost_basis_source', ci.cost_basis_source,
        'fees', ci.fees::float8,
        'acquisition_date', ci.acquisition_date,
        'acquisition_type', ci.acquisition_type,
        'acquisition_source', ci.acquisition_source,
        'notes', ci.notes,
        'current_value', ci.current_value::float8,
        'created_at', ci.created_at,
        'cards', CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'number', c.number,
          'rarity', c.rarity,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url,
          'sets', CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object(
            'id', s.id,
            'name', s.name,
            'slug', s.slug,
            'games', CASE WHEN g.id IS NULL THEN NULL ELSE json_build_object(
              'id', g.id,
              'name', g.name,
              'slug', g.slug
            ) END
          ) END
        ) END,
        'grading_companies', CASE WHEN gc.id IS NULL THEN NULL ELSE json_build_object(
          'id', gc.id,
          'name', gc.name,
          'slug', gc.slug
        ) END
      ) ORDER BY ci.created_at, ci.id)
      FROM collection_items ci
      LEFT JOIN cards c ON c.id = ci.card_id
      LEFT JOIN sets s ON s.id = c.set_id
      LEFT JOIN games g ON g.id = s.game_id
      LEFT JOIN grading_companies gc ON gc.id = ci.grading_company_id
      WHERE ci.collection_id = col.id
    ), '[]'::json) AS collection_items
  FROM collections col
  WHERE col.id = $1
    AND col.user_id = $2
  LIMIT 1
`;

const PUBLIC_COLLECTION_QUERY = `
  SELECT
    col.id,
    col.name,
    col.type,
    col.description,
    col.is_public,
    col.total_value::float8 AS total_value,
    col.items_count,
    col.created_at,
    col.updated_at,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', ci.id,
        'card_id', ci.card_id,
        'variant_id', ci.variant_id,
        'grade', ci.grade,
        'grading_company_id', ci.grading_company_id,
        'cert_number', ci.cert_number,
        'current_value', ci.current_value::float8,
        'created_at', ci.created_at,
        'cards', CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'number', c.number,
          'rarity', c.rarity,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url,
          'sets', CASE WHEN s.id IS NULL THEN NULL ELSE json_build_object(
            'id', s.id,
            'name', s.name,
            'slug', s.slug,
            'games', CASE WHEN g.id IS NULL THEN NULL ELSE json_build_object(
              'id', g.id,
              'name', g.name,
              'slug', g.slug
            ) END
          ) END
        ) END,
        'grading_companies', CASE WHEN gc.id IS NULL THEN NULL ELSE json_build_object(
          'id', gc.id,
          'name', gc.name,
          'slug', gc.slug
        ) END
      ) ORDER BY ci.created_at, ci.id)
      FROM collection_items ci
      LEFT JOIN cards c ON c.id = ci.card_id
      LEFT JOIN sets s ON s.id = c.set_id
      LEFT JOIN games g ON g.id = s.game_id
      LEFT JOIN grading_companies gc ON gc.id = ci.grading_company_id
      WHERE ci.collection_id = col.id
    ), '[]'::json) AS collection_items
  FROM collections col
  WHERE col.id = $1
    AND col.is_public = true
  LIMIT 1
`;

// GET /api/collections/[id] - Get a specific collection with items
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser();

  // An owner probe is enough to select the full private projection. Every
  // non-owner, including a signed-in public viewer, uses the safe public path.
  let isOwner = false;
  if (user) {
    try {
      const ownerRows = await dbQuery<{ id: string }>(`
        SELECT id
        FROM collections
        WHERE id = $1
          AND user_id = $2
        LIMIT 1
      `, [id, user.id]);
      isOwner = ownerRows.length > 0;
    } catch {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }
  }

  if (isOwner && user) {
    // Owners retain the full private projection, including cost-basis fields.
    let collection: CollectionWithItems | null = null;
    try {
      const rows = await dbQuery<CollectionWithItems>(OWNER_COLLECTION_QUERY, [id, user.id]);
      collection = rows[0] || null;
    } catch {
      collection = null;
    }

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: collection });
  }

  let publicCollection: PublicCollectionWithItems | null = null;
  try {
    const rows = await dbQuery<PublicCollectionWithItems>(PUBLIC_COLLECTION_QUERY, [id]);
    publicCollection = rows[0] || null;
  } catch {
    publicCollection = null;
  }

  if (!publicCollection) {
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
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  let existing: CollectionOwnerRow | null = null;
  try {
    const existingRows = await dbQuery<CollectionOwnerRow>(`
      SELECT user_id
      FROM collections
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `, [id, user.id]);
    existing = existingRows[0] || null;
  } catch {
    existing = null;
  }

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

  const updateFields = Object.keys(updates);
  const updateValues = updateFields.map((field) => updates[field]);
  const setClause = updateFields
    .map((field, index) => `${field} = $${index + 1}`)
    .join(', ');

  try {
    const rows = await dbQuery<CollectionWithItems>(`
      UPDATE collections
      SET ${setClause}
      WHERE id = $${updateValues.length + 1}
        AND user_id = $${updateValues.length + 2}
      RETURNING
        id,
        user_id,
        name,
        type,
        description,
        is_public,
        anonymous_share,
        share_token,
        total_value::float8 AS total_value,
        total_cost_basis::float8 AS total_cost_basis,
        items_count,
        created_at,
        updated_at
    `, [...updateValues, id, user.id]);
    const collection = rows[0];

    if (!collection) {
      throw new Error('Collection update returned no row');
    }

    return NextResponse.json({ data: collection });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update collection' },
      { status: 500 }
    );
  }
}

// DELETE /api/collections/[id] - Delete a collection
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  let existingDelete: CollectionOwnerRow | null = null;
  try {
    const existingDeleteRows = await dbQuery<CollectionOwnerRow>(`
      SELECT user_id
      FROM collections
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `, [id, user.id]);
    existingDelete = existingDeleteRows[0] || null;
  } catch {
    existingDelete = null;
  }

  if (!existingDelete || existingDelete.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Collection not found or access denied' },
      { status: 404 }
    );
  }

  // Delete collection (cascade will delete items)
  try {
    await dbQuery(
      `DELETE FROM collections WHERE id = $1 AND user_id = $2`,
      [id, user.id],
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
