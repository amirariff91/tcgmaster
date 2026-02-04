import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/collections - Get all collections for the current user
export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { data: collections, error } = await supabase
    .from('collections')
    .select(`
      id,
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
      updated_at
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: collections });
}

// POST /api/collections - Create a new collection
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: collection, error } = await (supabase.from('collections') as any)
    .insert({
      user_id: user.id,
      name: name.trim(),
      type,
      description: description?.trim() || null,
      is_public,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: collection }, { status: 201 });
}
