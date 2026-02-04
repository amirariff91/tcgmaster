import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

interface PriceCacheRow {
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
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
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
    .single();

  const collection = collectionData as CollectionRow | null;

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
  let certData;
  let gradingCompanyId: string | null = null;

  if (grading_company === 'psa') {
    certData = await lookupPSACert(cert_number);
    // Get PSA grading company ID
    const { data: gcData } = await supabase
      .from('grading_companies')
      .select('id')
      .eq('slug', 'psa')
      .single();
    const gc = gcData as GradingCompanyRow | null;
    gradingCompanyId = gc?.id || null;
  } else if (grading_company === 'bgs') {
    certData = await lookupBGSCert(cert_number);
    // Get BGS grading company ID
    const { data: gcData } = await supabase
      .from('grading_companies')
      .select('id')
      .eq('slug', 'bgs')
      .single();
    const gc = gcData as GradingCompanyRow | null;
    gradingCompanyId = gc?.id || null;
  } else {
    return NextResponse.json(
      { error: 'Unsupported grading company' },
      { status: 400 }
    );
  }

  if (!certData) {
    return NextResponse.json(
      { error: 'Certificate not found or could not be verified' },
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
    const { data: matchedCardsData } = await supabase
      .from('cards')
      .select('id, name, slug')
      .ilike('name', `%${cardName}%`)
      .limit(5);

    const matchedCards = matchedCardsData as CardRow[] | null;

    if (matchedCards && matchedCards.length > 0) {
      // Take the best match (first result)
      cardId = matchedCards[0].id;
    }
  }

  // Store cert data in cert_history
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('cert_history') as any).upsert({
    cert_number,
    grading_company_id: gradingCompanyId!,
    card_id: cardId,
    grade: certInfo.grade,
    subgrades: certInfo.subgrades || null,
    cert_date: certInfo.certDate || null,
    holder_generation: certInfo.holderGeneration || certInfo.holderType || null,
    is_reholder: certInfo.isReholder || false,
    grade_history: [],
    is_verified: true,
    last_verified_at: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
  }, {
    onConflict: 'cert_number,grading_company_id',
  });

  // Get historical price at cert date for cost basis
  let costBasis: number | null = null;
  let costBasisSource = 'user_entered';

  if (cardId && certInfo.certDate) {
    const { data: historicalPriceData } = await supabase
      .from('price_history')
      .select('price')
      .eq('card_id', cardId)
      .eq('grade', certInfo.grade.toString())
      .lte('recorded_at', certInfo.certDate)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    const historicalPrice = historicalPriceData as PriceHistoryRow | null;

    if (historicalPrice) {
      costBasis = historicalPrice.price;
      costBasisSource = 'cert_date_historical';
    }
  }

  // If no historical price, try current price
  if (costBasis === null && cardId) {
    const { data: priceCacheData } = await supabase
      .from('price_cache')
      .select('graded_prices')
      .eq('card_id', cardId)
      .single();

    const priceCache = priceCacheData as PriceCacheRow | null;

    if (priceCache) {
      const gradedPrices = priceCache.graded_prices;
      const gradeKey = `psa${certInfo.grade}`;
      costBasis = gradedPrices?.[gradeKey]?.average || null;
      if (costBasis !== null) {
        costBasisSource = 'current_price_auto';
      }
    }
  }

  // Create collection item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase.from('collection_items') as any)
    .insert({
      collection_id: collectionId,
      card_id: cardId,
      grade: certInfo.grade.toString(),
      grading_company_id: gradingCompanyId,
      cert_number,
      cost_basis: costBasis,
      cost_basis_source: costBasisSource,
      acquisition_date: certInfo.certDate,
      acquisition_type: 'purchase',
      current_value: costBasis,
    })
    .select(`
      id,
      card_id,
      grade,
      grading_company_id,
      cert_number,
      cost_basis,
      cost_basis_source,
      acquisition_date,
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
