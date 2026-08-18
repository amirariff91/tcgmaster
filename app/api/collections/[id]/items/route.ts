import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-server';
import { dbQuery } from '@/lib/db/client';
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
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  let collection: CollectionRow | null = null;
  try {
    const collectionRows = await dbQuery<CollectionRow>(`
      SELECT user_id
      FROM collections
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `, [collectionId, user.id]);
    collection = collectionRows[0] || null;
  } catch {
    collection = null;
  }

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
    const historicalPriceRows = await dbQuery<PriceHistoryRow>(`
      SELECT price::float8 AS price
      FROM price_history
      WHERE card_id = $1
        AND grade = ANY($2::text[])
        AND recorded_at <= $3
      ORDER BY recorded_at DESC
      LIMIT 1
    `, [card_id, gradeKeyCandidates(g), acquisition_date]);
    const historicalPrice = historicalPriceRows[0] || null;
    if (historicalPrice) {
      finalCostBasis = historicalPrice.price;
      costBasisSource = 'historical_auto';
    }
  }

  // If still no cost basis, try to get current price
  if (finalCostBasis === null) {
    const currentPriceRows = await dbQuery<CurrentPriceRow>(`
      SELECT headline_cents, graded_prices
      FROM card_price_current
      WHERE card_id = $1
      LIMIT 1
    `, [card_id]);
    const currentPrice = currentPriceRows[0] || null;
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

  let item: Record<string, unknown> | undefined;
  try {
    const itemRows = await dbQuery<Record<string, unknown>>(`
      WITH inserted AS (
        INSERT INTO collection_items (
          collection_id,
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
          current_value
        )
        SELECT $1, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $8
        WHERE EXISTS (
          SELECT 1
          FROM collections
          WHERE id = $1
            AND user_id = $2
        )
        RETURNING
          id,
          card_id,
          variant_id,
          grade,
          grading_company_id,
          cert_number,
          cost_basis::float8 AS cost_basis,
          cost_basis_source,
          acquisition_date,
          acquisition_type,
          notes,
          current_value::float8 AS current_value,
          created_at
      )
      SELECT
        ci.id,
        ci.card_id,
        ci.variant_id,
        ci.grade,
        ci.grading_company_id,
        ci.cert_number,
        ci.cost_basis,
        ci.cost_basis_source,
        ci.acquisition_date,
        ci.acquisition_type,
        ci.notes,
        ci.current_value,
        ci.created_at,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'number', c.number,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url,
          'sets', json_build_object(
            'id', s.id,
            'name', s.name,
            'slug', s.slug
          )
        ) AS cards
      FROM inserted ci
      JOIN cards c ON c.id = ci.card_id
      JOIN sets s ON s.id = c.set_id
      LIMIT 1
    `, [
      collectionId,
      user.id,
      card_id,
      variant_id,
      g,
      grading_company_id,
      cert_number,
      finalCostBasis,
      costBasisSource,
      acquisition_date,
      acquisition_type,
      notes,
    ]);
    item = itemRows[0];

    if (!item) {
      throw new Error('Collection item insert returned no row');
    }
  } catch (error) {
    console.error('Failed to add item:', error);
    return NextResponse.json(
      { error: 'Failed to add item to collection' },
      { status: 500 }
    );
  }

  // Update collection totals (will be handled by triggers in production)
  await updateCollectionTotals(collectionId, user.id);

  return NextResponse.json({ data: item }, { status: 201 });
}

// DELETE /api/collections/[id]/items - Remove item from collection (by item_id in body)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: collectionId } = await params;
  const user = await getAuthUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Verify ownership
  let collectionDelete: CollectionRow | null = null;
  try {
    const collectionDeleteRows = await dbQuery<CollectionRow>(`
      SELECT user_id
      FROM collections
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `, [collectionId, user.id]);
    collectionDelete = collectionDeleteRows[0] || null;
  } catch {
    collectionDelete = null;
  }

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
  const itemRows = await dbQuery<{ id: string }>(`
    SELECT ci.id
    FROM collection_items ci
    JOIN collections c ON c.id = ci.collection_id
    WHERE ci.id = $1
      AND ci.collection_id = $2
      AND c.user_id = $3
    LIMIT 1
  `, [item_id, collectionId, user.id]);
  const item = itemRows[0] || null;

  if (!item) {
    return NextResponse.json(
      { error: 'Item not found in this collection' },
      { status: 404 }
    );
  }

  try {
    await dbQuery(
      `
        DELETE FROM collection_items ci
        WHERE ci.id = $1
          AND ci.collection_id = $2
          AND EXISTS (
            SELECT 1
            FROM collections c
            WHERE c.id = ci.collection_id
              AND c.user_id = $3
          )
      `,
      [item_id, collectionId, user.id],
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to remove item' },
      { status: 500 }
    );
  }

  // Update collection totals
  await updateCollectionTotals(collectionId, user.id);

  return NextResponse.json({ success: true });
}

// Helper function to update collection totals
async function updateCollectionTotals(
  collectionId: string,
  userId: string,
) {
  try {
    const items = await dbQuery<CollectionItemRow>(`
      SELECT ci.cost_basis::float8 AS cost_basis, ci.current_value::float8 AS current_value
      FROM collection_items ci
      JOIN collections c ON c.id = ci.collection_id
      WHERE ci.collection_id = $1
        AND c.user_id = $2
    `, [collectionId, userId]);

    const totalCostBasis = items.reduce((sum, item) => sum + (item.cost_basis || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + (item.current_value || item.cost_basis || 0), 0);

    await dbQuery(
      `
        UPDATE collections
        SET total_cost_basis = $1,
            total_value = $2,
            items_count = $3
        WHERE id = $4
          AND user_id = $5
      `,
      [totalCostBasis, totalValue, items.length, collectionId, userId],
    );
  } catch (error) {
    console.error('Failed to update collection totals:', error);
  }
}
