import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-server';
import { dbQuery } from '@/lib/db/client';
import { lookupPSACert, PSACertData } from '@/lib/scrapers/psa';
import { lookupBGSCert, BGSCertData } from '@/lib/scrapers/bgs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface CollectionRow {
  user_id: string;
}

interface GradingCompanyRow {
  id: string;
}

interface CardRow {
  id: string;
  name: string;
  slug: string;
}

interface PriceHistoryRow {
  price: number;
}

interface CurrentPriceRow {
  graded_prices: Record<string, { average?: number }>;
}

// Helper to extract common cert data properties
function extractCertInfo(certData: PSACertData | BGSCertData) {
  const isPSA = 'holderGeneration' in certData;
  return {
    certNumber: certData.certNumber,
    grade: certData.grade,
    cardDescription: certData.cardDescription,
    certDate: certData.certDate,
    isReholder: certData.isReholder,
    // PSA has holderGeneration, BGS has holderType
    holderGeneration: isPSA ? (certData as PSACertData).holderGeneration : null,
    holderType: !isPSA ? (certData as BGSCertData).holderType : null,
    // BGS has subgrades, PSA doesn't
    subgrades: !isPSA ? (certData as BGSCertData).subgrades : null,
  };
}

// POST /api/collections/[id]/items/from-cert - Add item by cert number
// This is the "magic" feature - enter cert number, auto-populate everything
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
  const { cert_number, grading_company = 'psa' } = body;

  if (!cert_number) {
    return NextResponse.json(
      { error: 'cert_number is required' },
      { status: 400 }
    );
  }

  // Look up the cert
  let certData: PSACertData | BGSCertData | null = null;
  let gradingCompanyId: string | null = null;

  if (grading_company === 'psa') {
    certData = await lookupPSACert(cert_number);
    // Get PSA grading company ID
    const gcRows = await dbQuery<GradingCompanyRow>(`
      SELECT id
      FROM grading_companies
      WHERE slug = $1
      LIMIT 1
    `, ['psa']);
    const gc = gcRows[0] || null;
    gradingCompanyId = gc?.id || null;
  } else if (grading_company === 'bgs') {
    certData = await lookupBGSCert(cert_number);
    // Get BGS grading company ID
    const gcRows = await dbQuery<GradingCompanyRow>(`
      SELECT id
      FROM grading_companies
      WHERE slug = $1
      LIMIT 1
    `, ['bgs']);
    const gc = gcRows[0] || null;
    gradingCompanyId = gc?.id || null;
  } else {
    return NextResponse.json(
      { error: 'Unsupported grading company' },
      { status: 400 }
    );
  }

  if (!certData || !certData.isValid) {
    return NextResponse.json(
      { error: certData?.error || 'Certificate not found or could not be verified' },
      { status: 404 }
    );
  }

  // Extract common cert info
  const certInfo = extractCertInfo(certData);

  // Try to match the cert to a card in our database
  let cardId: string | null = null;

  // Search for the card by name (fuzzy match)
  const cardName = certInfo.cardDescription;
  if (cardName) {
    const matchedCards = await dbQuery<CardRow>(`
      SELECT id, name, slug
      FROM cards
      WHERE name ILIKE $1
      LIMIT 5
    `, [`%${cardName}%`]);

    if (matchedCards && matchedCards.length > 0) {
      // Take the best match (first result)
      cardId = matchedCards[0].id;
    }
  }

  // collection_items requires a card_id, so this endpoint cannot add a
  // verified certificate that is not represented in the card catalog.
  if (!cardId) {
    return NextResponse.json(
      { error: 'Certificate verified, but the card was not found in the catalog' },
      { status: 422 }
    );
  }

  // Store cert data in cert_history. cert_history is a shared catalog table, not
  // user-owned, so end users hold no write grant on it — the authenticated route
  // writes it directly through the PostgreSQL connection.
  const verifiedAt = new Date().toISOString();
  await dbQuery(`
    INSERT INTO cert_history (
      cert_number,
      grading_company_id,
      card_id,
      grade,
      subgrades,
      cert_date,
      holder_generation,
      is_reholder,
      grade_history,
      is_verified,
      last_verified_at,
      scraped_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
    ON CONFLICT (cert_number, grading_company_id) DO UPDATE SET
      card_id = EXCLUDED.card_id,
      grade = EXCLUDED.grade,
      subgrades = EXCLUDED.subgrades,
      cert_date = EXCLUDED.cert_date,
      holder_generation = EXCLUDED.holder_generation,
      is_reholder = EXCLUDED.is_reholder,
      grade_history = EXCLUDED.grade_history,
      is_verified = EXCLUDED.is_verified,
      last_verified_at = EXCLUDED.last_verified_at,
      scraped_at = EXCLUDED.scraped_at
  `, [
    cert_number,
    gradingCompanyId,
    cardId,
    certInfo.grade,
    certInfo.subgrades ? JSON.stringify(certInfo.subgrades) : null,
    certInfo.certDate || null,
    certInfo.holderGeneration || certInfo.holderType || null,
    certInfo.isReholder || false,
    JSON.stringify([]),
    certData.isValid,
    verifiedAt,
  ]);

  // Get historical price at cert date for cost basis
  let costBasis: number | null = null;
  let costBasisSource = 'user_entered';

  if (cardId && certInfo.certDate) {
    const historicalPriceRows = await dbQuery<PriceHistoryRow>(`
      SELECT price::float8 AS price
      FROM price_history
      WHERE card_id = $1
        AND grade = $2
        AND recorded_at <= $3
      ORDER BY recorded_at DESC
      LIMIT 1
    `, [cardId, certInfo.grade.toString(), certInfo.certDate]);
    const historicalPrice = historicalPriceRows[0] || null;

    if (historicalPrice) {
      costBasis = historicalPrice.price;
      costBasisSource = 'cert_date_historical';
    }
  }

  // If no historical price, try current price
  if (costBasis === null && cardId) {
    const currentPriceRows = await dbQuery<CurrentPriceRow>(`
      SELECT graded_prices
      FROM card_price_current
      WHERE card_id = $1
      LIMIT 1
    `, [cardId]);
    const currentPrice = currentPriceRows[0] || null;

    if (currentPrice) {
      const gradedPrices = currentPrice.graded_prices;
      const gradeKey = `psa${certInfo.grade}`;
      costBasis = gradedPrices?.[gradeKey]?.average || null;
      if (costBasis !== null) {
        costBasisSource = 'current_price_auto';
      }
    }
  }

  // Create collection item
  let item: Record<string, unknown> | undefined;
  try {
    const itemRows = await dbQuery<Record<string, unknown>>(`
      WITH inserted AS (
        INSERT INTO collection_items (
          collection_id,
          card_id,
          grade,
          grading_company_id,
          cert_number,
          cost_basis,
          cost_basis_source,
          acquisition_date,
          acquisition_type,
          current_value
        )
        SELECT $1, $3, $4, $5, $6, $7, $8, $9, $10, $7
        WHERE EXISTS (
          SELECT 1
          FROM collections
          WHERE id = $1
            AND user_id = $2
        )
        RETURNING
          id,
          card_id,
          grade,
          grading_company_id,
          cert_number,
          cost_basis::float8 AS cost_basis,
          cost_basis_source,
          acquisition_date,
          current_value::float8 AS current_value,
          created_at
      )
      SELECT
        ci.id,
        ci.card_id,
        ci.grade,
        ci.grading_company_id,
        ci.cert_number,
        ci.cost_basis,
        ci.cost_basis_source,
        ci.acquisition_date,
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
      cardId,
      certInfo.grade.toString(),
      gradingCompanyId,
      cert_number,
      costBasis,
      costBasisSource,
      certInfo.certDate,
      'purchase',
    ]);
    item = itemRows[0];

    if (!item) {
      throw new Error('Collection item insert returned no row');
    }
  } catch (error) {
    console.error('Failed to add item from cert:', error);
    return NextResponse.json(
      { error: 'Failed to add item to collection' },
      { status: 500 }
    );
  }

  // Return both the item and cert data for the UI
  return NextResponse.json({
    data: {
      item,
      cert: {
        certNumber: certInfo.certNumber,
        grade: certInfo.grade,
        subgrades: certInfo.subgrades,
        certDate: certInfo.certDate,
        holderGeneration: certInfo.holderGeneration || certInfo.holderType,
        isReholder: certInfo.isReholder,
        cardDetails: { name: certInfo.cardDescription },
        matched: cardId !== null,
      },
    },
  }, { status: 201 });
}
