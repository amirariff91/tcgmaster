import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-server';
import { dbQuery } from '@/lib/db/client';

interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  description: string | null;
  is_public: boolean | null;
  anonymous_share: boolean | null;
  share_token: string | null;
  total_value: number | null;
  total_cost_basis: number | null;
  items_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

type CollectionListRow = Omit<CollectionRow, 'user_id'>;

// GET /api/collections - Get all collections for the current user
export async function GET() {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const collections = await dbQuery<CollectionListRow>(`
      SELECT
        id,
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
      FROM collections
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [user.id]);

    return NextResponse.json({ data: collections });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}

// POST /api/collections - Create a new collection
export async function POST(request: NextRequest) {
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { name, type = 'personal', description, is_public = false } = body;

  if (!name || name.trim().length === 0) {
    return NextResponse.json(
      { error: 'Collection name is required' },
      { status: 400 }
    );
  }

  const validTypes = ['personal', 'investment', 'for-sale', 'wishlist', 'custom'];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: 'Invalid collection type' },
      { status: 400 }
    );
  }

  try {
    const rows = await dbQuery<CollectionRow>(`
      INSERT INTO collections (user_id, name, type, description, is_public)
      VALUES ($1, $2, $3, $4, $5)
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
    `, [user.id, name.trim(), type, description?.trim() || null, is_public]);
    const collection = rows[0];

    if (!collection) {
      throw new Error('Collection insert returned no row');
    }

    return NextResponse.json({ data: collection }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }
}
