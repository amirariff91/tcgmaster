import 'dotenv/config';
import { pool } from '../lib/db/client';

const CATEGORY_ID = 68; // One Piece Category on TCGPlayer

interface TcgProduct {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string;
  groupId: number;
  url: string;
  extendedData?: { name: string; value: string }[];
}

async function fetchAllTcgGroups(): Promise<{ groupId: number; name: string; abbreviation: string }[]> {
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/groups`, {
    headers: { 'User-Agent': 'TCGMaster-Auditor/1.0' },
  });
  if (!res.ok) throw new Error(`Failed to fetch groups: ${res.statusText}`);
  const data = await res.json();
  return data.results || [];
}

async function fetchProductsForGroup(groupId: number): Promise<TcgProduct[]> {
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${groupId}/products`, {
    headers: { 'User-Agent': 'TCGMaster-Auditor/1.0' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

async function audit() {
  console.log('--- Starting TCGPlayer English One Piece Mapping Audit ---');

  // 1. Fetch all mapped English One Piece cards from Postgres
  const dbCardsQuery = await pool.query(`
    SELECT c.id, c.slug, c.name, c.number, c.rarity, c.set_id,
           csm.external_id, csm.external_title, cpc.headline_cents
    FROM cards c
    JOIN card_source_mapping csm ON c.id = csm.card_id AND csm.source = 'tcgplayer'
    LEFT JOIN card_price_current cpc ON c.id = cpc.card_id
    WHERE c.slug ILIKE 'op-%' AND c.slug NOT ILIKE '%-ja'
    ORDER BY c.number ASC, c.slug ASC;
  `);

  console.log(`Found ${dbCardsQuery.rows.length} mapped English One Piece cards in database.`);

  // 2. Fetch TCGCSV Groups
  console.log('Fetching all One Piece groups from TCGCSV...');
  const groups = await fetchAllTcgGroups();
  console.log(`Fetched ${groups.length} groups.`);

  // We filter groups to standard booster and starter sets (OP, ST, EB, PRB, Promo)
  const relevantGroups = groups.filter(g => {
    const name = g.name.toLowerCase();
    return !name.includes('japanese') && !name.includes('asia');
  });

  console.log(`Identified ${relevantGroups.length} relevant English groups.`);

  // Cache products by card number
  const productsByNumber = new Map<string, TcgProduct[]>();

  for (const group of relevantGroups) {
    const products = await fetchProductsForGroup(group.groupId);
    for (const prod of products) {
      const numExt = prod.extendedData?.find(d => d.name === 'Number')?.value?.trim();
      if (numExt) {
        const cleanNum = numExt.toUpperCase();
        if (!productsByNumber.has(cleanNum)) {
          productsByNumber.set(cleanNum, []);
        }
        productsByNumber.get(cleanNum)!.push(prod);
      }
    }
  }

  console.log(`Loaded ${productsByNumber.size} distinct card numbers from TCGPlayer.\n`);

  const mismatches: Array<{
    cardId: string;
    slug: string;
    dbName: string;
    cardNumber: string;
    currentId: string;
    currentTitle: string;
    headlinePrice: string;
    issueType: string;
    recommendedProduct?: TcgProduct;
  }> = [];

  for (const row of dbCardsQuery.rows) {
    const baseNumber = (row.number || '').split('_')[0].trim().toUpperCase();
    const isManga = row.name.toLowerCase().includes('manga') || row.slug.toLowerCase().includes('manga');
    const isVariant = row.slug.includes('_p') || row.slug.includes('_r') || row.name.toLowerCase().includes('alternate art');
    const currentTitle = (row.external_title || '').toLowerCase();
    const currentId = String(row.external_id);

    const candidateProducts = productsByNumber.get(baseNumber) || [];

    // Check Class A: True Manga Mapped to Non-Manga
    if (isManga && !currentTitle.includes('manga')) {
      const realMangaProd = candidateProducts.find(p => p.name.toLowerCase().includes('manga'));
      mismatches.push({
        cardId: row.id,
        slug: row.slug,
        dbName: row.name,
        cardNumber: row.number,
        currentId,
        currentTitle: row.external_title,
        headlinePrice: `$${((row.headline_cents || 0) / 100).toFixed(2)}`,
        issueType: 'CLASS_A_MANGA_COLLAPSE',
        recommendedProduct: realMangaProd,
      });
      continue;
    }

    // Check Class B: Base Card Mapped to Variant / Manga
    if (!isVariant && (currentTitle.includes('alternate art') || currentTitle.includes('parallel') || currentTitle.includes('manga') || currentTitle.includes('special card'))) {
      const baseProd = candidateProducts.find(p => {
        const n = p.name.toLowerCase();
        return !n.includes('alternate art') && !n.includes('parallel') && !n.includes('manga') && !n.includes('special card');
      });
      mismatches.push({
        cardId: row.id,
        slug: row.slug,
        dbName: row.name,
        cardNumber: row.number,
        currentId,
        currentTitle: row.external_title,
        headlinePrice: `$${((row.headline_cents || 0) / 100).toFixed(2)}`,
        issueType: 'CLASS_B_BASE_BLEED_INTO_VARIANT',
        recommendedProduct: baseProd,
      });
      continue;
    }

    // Check Class C: High Variant (e.g. SP / Special / Wanted) Mapped to Base
    if (isVariant && !currentTitle.includes('alternate art') && !currentTitle.includes('parallel') && !currentTitle.includes('manga') && !currentTitle.includes('special') && !currentTitle.includes('wanted')) {
      // Find candidate variant
      const variantProd = candidateProducts.find(p => {
        const n = p.name.toLowerCase();
        return n.includes('alternate art') || n.includes('parallel') || n.includes('special') || n.includes('wanted');
      });
      mismatches.push({
        cardId: row.id,
        slug: row.slug,
        dbName: row.name,
        cardNumber: row.number,
        currentId,
        currentTitle: row.external_title,
        headlinePrice: `$${((row.headline_cents || 0) / 100).toFixed(2)}`,
        issueType: 'CLASS_C_VARIANT_COLLAPSED_TO_BASE',
        recommendedProduct: variantProd,
      });
      continue;
    }
  }

  console.log(`\n=== AUDIT RESULTS: Found ${mismatches.length} Mismatches ===\n`);
  for (const m of mismatches) {
    console.log(`[${m.issueType}] ${m.slug} (${m.cardNumber})`);
    console.log(`  Local DB Name: "${m.dbName}" | Headline: ${m.headlinePrice}`);
    console.log(`  Current Mapped: [${m.currentId}] "${m.currentTitle}"`);
    if (m.recommendedProduct) {
      console.log(`  -> RECOMMENDED FIX: [${m.recommendedProduct.productId}] "${m.recommendedProduct.name}"`);
    } else {
      console.log(`  -> NO EXACT AUTOMATIC MATCH FOUND IN CANDIDATES`);
    }
    console.log('');
  }

  // Save audit report to JSON for processing in Phase 2
  const fs = await import('fs/promises');
  await fs.writeFile(
    'scripts/audit-english-op-report.json',
    JSON.stringify(mismatches, null, 2)
  );
  console.log('Saved audit report to scripts/audit-english-op-report.json');
  process.exit(0);
}

audit().catch(e => {
  console.error('Audit failed:', e);
  process.exit(1);
});
