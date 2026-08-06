import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth-server';
import { gradeKeyCandidates, lookupGraded, normalizeGrade } from '@/lib/pricing/grades';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CollectionRow {
  user_id: string;
}

interface PriceHistoryRow {
  price: number;
}

interface CurrentPriceRow {
  headline_cents: number | null;
  graded_prices: Record<string, { average?: number | null }>;
}

interface CollectionItemRow {
  cost_basis: number | null;
  current_value: number | null;
}

// POST /api/collections/[id]/items - Add item to collection
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: collectionId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  const { data: collectionData } = await supabase
    .from('collections')
    .select('user_id')
    .eq('id', collectionId)
    .eq('user_id', user.id)
    .single();

  const collection = collectionData as CollectionRow | null;

  if (!collection || collection.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Collection not found or access denied' },
      { status: 404 }
    );
  }

  const body = await request.json();
  const {
    card_id,
    variant_id = null,
    grade = 'raw',
    grading_company_id = null,
    cert_number = null,
    cost_basis = null,
    acquisition_date = null,
    acquisition_type = 'purchase',
    notes = null,
  } = body;
  const g = normalizeGrade(grade);

  if (!card_id) {
    return NextResponse.json(
      { error: 'card_id is required' },
      { status: 400 }
    );
  }

  // Auto-fill cost basis from historical price if not provided
  let finalCostBasis = cost_basis;
  let costBasisSource = 'user_entered';

  if (cost_basis === null && acquisition_date) {
    // Try to get historical price for this card/grade on acquisition date
    const { data: historicalPriceData } = await supabase
      .from('price_history')
      .select('price')
      .eq('card_id', card_id)
      .in('grade', gradeKeyCandidates(g))
      .lte('recorded_at', acquisition_date)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    const historicalPrice = historicalPriceData as PriceHistoryRow | null;
    if (historicalPrice) {
      finalCostBasis = historicalPrice.price;
      costBasisSource = 'historical_auto';
    }
  }

  // If still no cost basis, try to get current price
  if (finalCostBasis === null) {
    const { data: currentPriceData } = await supabase
      .from('card_price_current')
      .select('headline_cents, graded_prices')
      .eq('card_id', card_id)
      .maybeSingle();

    const currentPrice = currentPriceData as CurrentPriceRow | null;
    if (currentPrice) {
      const rawValue = currentPrice.headline_cents === null
        ? null
        : currentPrice.headline_cents / 100;
      if (g === 'raw') {
        finalCostBasis = rawValue;
      } else {
        finalCostBasis = lookupGraded(currentPrice.graded_prices, g)?.average || null;
      }
      if (finalCostBasis !== null) {
        costBasisSource = 'current_price_auto';
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase.from('collection_items') as any)
    .insert({
      collection_id: collectionId,
      card_id,
      variant_id,
      grade: g,
      grading_company_id,
      cert_number,
      cost_basis: finalCostBasis,
      cost_basis_source: costBasisSource,
      acquisition_date,
      acquisition_type,
      notes,
      current_value: finalCostBasis, // Start with cost basis as current value
    })
    .select(`
      id,
      card_id,
      variant_id,
      grade,
      grading_company_id,
      cert_number,
      cost_basis,
      cost_basis_source,
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
        image_url,
        local_image_url,
        sets (
          id,
          name,
          slug
        )
      )
    `)
    .single();

  if (error) {
    console.error('Failed to add item:', error);
    return NextResponse.json(
      { error: 'Failed to add item to collection' },
      { status: 500 }
    );
  }

  // Update collection totals (will be handled by triggers in production)
  await updateCollectionTotals(supabase, collectionId, user.id);

  return NextResponse.json({ data: item }, { status: 201 });
}

// DELETE /api/collections/[id]/items - Remove item from collection (by item_id in body)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: collectionId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  const { data: collectionDeleteData } = await supabase
    .from('collections')
    .select('user_id')
    .eq('id', collectionId)
    .eq('user_id', user.id)
    .single();

  const collectionDelete = collectionDeleteData as CollectionRow | null;

  if (!collectionDelete || collectionDelete.user_id !== user.id) {
    return NextResponse.json(
      { error: 'Collection not found or access denied' },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { item_id } = body;

  if (!item_id) {
    return NextResponse.json(
      { error: 'item_id is required' },
      { status: 400 }
    );
  }

  // Verify item belongs to this collection
  const { data: item } = await supabase
    .from('collection_items')
    .select('id')
    .eq('id', item_id)
    .eq('collection_id', collectionId)
    .single();

  if (!item) {
    return NextResponse.json(
      { error: 'Item not found in this collection' },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('id', item_id)
    .eq('collection_id', collectionId);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to remove item' },
      { status: 500 }
    );
  }

  // Update collection totals
  await updateCollectionTotals(supabase, collectionId, user.id);

  return NextResponse.json({ success: true });
}

// Helper function to update collection totals
async function updateCollectionTotals(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  collectionId: string,
  userId: string,
) {
  const { data: itemsData } = await supabase
    .from('collection_items')
    .select('cost_basis, current_value')
    .eq('collection_id', collectionId);

  const items = itemsData as CollectionItemRow[] | null;

  if (items) {
    const totalCostBasis = items.reduce((sum, item) => sum + (item.cost_basis || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + (item.current_value || item.cost_basis || 0), 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('collections') as any)
      .update({
        total_cost_basis: totalCostBasis,
        total_value: totalValue,
        items_count: items.length,
      })
      .eq('id', collectionId)
      .eq('user_id', userId);
  }
}
