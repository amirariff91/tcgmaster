/**
 * Dedicated Remediation for Pokemon Evolving Skies (SWSH07)
 *
 * 1. Safely quarantines contaminated price_history rows:
 *    - Collided legacy TCGPlayer rows (reason: 'evolving-skies-remediation')
 *    - Bogus Alt opening auction bid rows ($0.99, $1.16, etc.) (reason: 'alt-active-bid-quarantine')
 * 2. Remediates all collided and missing TCGPlayer IDs using official TCGPlayer Group 2848 catalog.
 * 3. Syncs genuine dual-engine sales and market prices for all updated cards.
 * 4. Syncs verified Fanatics Collect sales for top chase cards.
 */

import 'dotenv/config';
import { dbQuery } from '../lib/db/client';
import { syncDualEngineSales } from './sync-tcgplayer-dual-engine';
import { syncCardFanatics, type SyncCard } from './sync-fanatics-history';

interface TcgProduct {
  productId: number;
  name: string;
  extendedData?: { name: string; value: string }[];
}

interface CardRecord {
  id: string;
  name: string;
  number: string;
  slug: string;
  tcg_player_id: string | null;
  tcgplayer_url: string | null;
}

const EVOLVING_SKIES_SET_ID = '41fa694e-191c-439f-abe8-af5be80dbaca';
const TCGPLAYER_GROUP_ID = 2848; // SWSH07: Evolving Skies

async function run() {
  console.log('==================================================================');
  console.log('🚀 Starting Surgical Remediation for Pokémon Evolving Skies');
  console.log('==================================================================');

  // -------------------------------------------------------------------------
  // STEP 1: Quarantine Bogus Alt Opening Bids from price_history
  // -------------------------------------------------------------------------
  console.log('\n[Step 1] Quarantining bogus Alt active auction bids (sub-$50 on chase cards)...');

  const quarantinedAlt = await dbQuery<{ count: string }>(`
    WITH moved_rows AS (
      INSERT INTO price_quarantine (
        card_id, source, price, currency, grade, observed_at, price_kind, reason, evidence
      )
      SELECT 
        ph.card_id, ph.source, ph.price, ph.currency, ph.grade, ph.recorded_at, ph.price_kind,
        'manual-mapping-correction',
        json_build_object(
          'card_name', c.name,
          'card_number', c.number,
          'card_slug', c.slug,
          'sale_type', ph.sale_type,
          'notable_reason', ph.notable_reason,
          'sub_reason', 'alt-active-auction-bid-contamination'
        )::jsonb
      FROM price_history ph
      JOIN cards c ON c.id = ph.card_id
      WHERE c.set_id = $1
        AND ph.source = 'alt'
        AND ph.sale_type = 'EXTERNAL_AUCTION'
        AND ph.price < 50
        AND c.number IN ('215', '218', '212', '205', '209', '189', '194', '192', '184', '167', '175')
      RETURNING 1
    )
    SELECT count(*)::text as count FROM moved_rows;
  `, [EVOLVING_SKIES_SET_ID]);

  await dbQuery(`
    DELETE FROM price_history ph
    USING cards c
    WHERE c.id = ph.card_id
      AND c.set_id = $1
      AND ph.source = 'alt'
      AND ph.sale_type = 'EXTERNAL_AUCTION'
      AND ph.price < 50
      AND c.number IN ('215', '218', '212', '205', '209', '189', '194', '192', '184', '167', '175');
  `, [EVOLVING_SKIES_SET_ID]);

  console.log(`  ✓ Quarantined and scrubbed ${quarantinedAlt[0]?.count || 0} contaminated Alt auction bid records.`);

  // -------------------------------------------------------------------------
  // STEP 2: Fetch Official Evolving Skies Catalog from TCGcsv
  // -------------------------------------------------------------------------
  console.log('\n[Step 2] Fetching official TCGPlayer Evolving Skies catalog (Group 2848)...');
  const catalogRes = await fetch(`https://tcgcsv.com/tcgplayer/3/${TCGPLAYER_GROUP_ID}/products`, {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  if (!catalogRes.ok) {
    throw new Error(`Failed to fetch TCGPlayer catalog: ${catalogRes.status}`);
  }
  const catalogData = await catalogRes.json();
  const products: TcgProduct[] = catalogData.results || [];
  console.log(`  ✓ Loaded ${products.length} official products.`);

  // Index catalog by clean card number (e.g. "215/203" -> "215")
  const productByNumber = new Map<string, TcgProduct>();
  for (const p of products) {
    const numExt = p.extendedData?.find(d => d.name === 'Number')?.value;
    if (numExt) {
      const cleanNum = numExt.split('/')[0].trim().replace(/^0+/, '');
      if (cleanNum && !productByNumber.has(cleanNum)) {
        productByNumber.set(cleanNum, p);
      }
    }
  }

  // -------------------------------------------------------------------------
  // STEP 3: Audit & Remediate Evolving Skies Cards in Database
  // -------------------------------------------------------------------------
  console.log('\n[Step 3] Auditing and remediating cards in Evolving Skies...');
  const cards = await dbQuery<CardRecord>(`
    SELECT id, name, number, slug, tcg_player_id, tcgplayer_url
    FROM cards
    WHERE set_id = $1
    ORDER BY CAST(NULLIF(regexp_replace(number, '[^0-9]', '', 'g'), '') AS integer) ASC NULLS LAST;
  `, [EVOLVING_SKIES_SET_ID]);

  let fixedCount = 0;
  const cardsToResync: { id: string; tcgId: string; name: string; number: string; slug: string }[] = [];

  for (const card of cards) {
    const cleanNum = card.number.replace(/^0+/, '');
    const correctProduct = productByNumber.get(cleanNum);

    if (!correctProduct) {
      continue;
    }

    const correctId = correctProduct.productId.toString();

    if (card.tcg_player_id !== correctId) {
      console.log(`  [REMAP] #${card.number} ${card.name} [${card.slug}]`);
      console.log(`          Old ID: ${card.tcg_player_id ?? 'NULL'} -> Correct ID: ${correctId} ("${correctProduct.name}")`);

      // 1. Move old contaminated TCGPlayer history to price_quarantine
      if (card.tcg_player_id) {
        await dbQuery(`
          INSERT INTO price_quarantine (
            card_id, source, price, currency, grade, observed_at, price_kind, reason, evidence
          )
          SELECT 
            card_id, source, price, currency, grade, recorded_at, price_kind,
            'manual-mapping-correction',
            json_build_object(
              'card_slug', $2::text,
              'reassigned_from', $3::text,
              'reassigned_to', $4::text,
              'correct_product_name', $5::text,
              'sub_reason', 'evolving-skies-remediation'
            )::jsonb
          FROM price_history
          WHERE card_id = $1 AND source = 'tcgplayer';
        `, [card.id, card.slug, card.tcg_player_id, correctId, correctProduct.name]);

        await dbQuery(`
          DELETE FROM price_history
          WHERE card_id = $1 AND source = 'tcgplayer';
        `, [card.id]);
      }

      // 2. Update card mapping
      await dbQuery(`
        UPDATE cards
        SET tcg_player_id = $1,
            tcgplayer_url = $2
        WHERE id = $3;
      `, [
        correctId,
        `https://www.tcgplayer.com/product/${correctId}`,
        card.id,
      ]);

      fixedCount++;
      cardsToResync.push({
        id: card.id,
        tcgId: correctId,
        name: card.name,
        number: card.number,
        slug: card.slug,
      });
    }
  }

  console.log(`\n  ✓ Successfully remapped ${fixedCount} cards in Evolving Skies.`);

  // -------------------------------------------------------------------------
  // STEP 4: Dual-Engine Resync for Remapped Cards
  // -------------------------------------------------------------------------
  console.log('\n[Step 4] Resyncing dual-engine sales and market prices for remapped cards...');

  for (let i = 0; i < cardsToResync.length; i++) {
    const item = cardsToResync[i];
    process.stdout.write(`  [${i + 1}/${cardsToResync.length}] Syncing #${item.number} ${item.name} (TCGPlayer ${item.tcgId})... `);
    try {
      const syncRes = await syncDualEngineSales(item.id, item.tcgId);
      console.log(`Market: $${syncRes.finalPrice ?? 'N/A'} (${syncRes.insertedHistoryCount} history pts, ${syncRes.salesCount} recent sales)`);
    } catch (err: any) {
      console.warn(`Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  // -------------------------------------------------------------------------
  // STEP 5: Sync Verified Fanatics Collect Data for Top Chase Cards
  // -------------------------------------------------------------------------
  console.log('\n[Step 5] Syncing Fanatics Collect historical sales and Buy It Now listings for top chase cards...');

  const topChaseCards = await dbQuery<SyncCard>(`
    SELECT c.id, c.name, c.number, s.name as set_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE c.set_id = $1
      AND c.number IN ('215', '218', '212', '205', '209', '189', '194', '192', '184', '167', '175')
    ORDER BY CAST(NULLIF(regexp_replace(c.number, '[^0-9]', '', 'g'), '') AS integer) DESC;
  `, [EVOLVING_SKIES_SET_ID]);

  for (const chase of topChaseCards) {
    try {
      await syncCardFanatics(chase);
    } catch (err: any) {
      console.warn(`  Fanatics sync error on #${chase.number}: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  // -------------------------------------------------------------------------
  // STEP 6: Final Verification & Headline Summary
  // -------------------------------------------------------------------------
  console.log('\n==================================================================');
  console.log('📊 Verification Summary: Evolving Skies Top Chase Cards');
  console.log('==================================================================');

  const finalCards = await dbQuery<any>(`
    SELECT c.name, c.number, c.slug, c.tcg_player_id, c.tcgplayer_url,
           cpc.headline_cents, cpc.headline_source, cpc.source_prices
    FROM cards c
    LEFT JOIN card_price_current cpc ON cpc.card_id = c.id
    WHERE c.set_id = $1
      AND c.number IN ('215', '218', '212', '205', '209', '189', '194', '192', '184', '167', '175')
    ORDER BY cpc.headline_cents DESC NULLS LAST;
  `, [EVOLVING_SKIES_SET_ID]);

  for (const fc of finalCards) {
    const sources = fc.source_prices || {};
    const spKeys = Object.keys(sources).map(k => `${k}: $${sources[k]?.usd ?? sources[k]?.price ?? '?'}`).join(', ');
    console.log(`\n- #${fc.number} ${fc.name} [${fc.slug}]`);
    console.log(`  Headline: $${(fc.headline_cents || 0)/100} (${fc.headline_source})`);
    console.log(`  TCGPlayer ID: ${fc.tcg_player_id} -> ${fc.tcgplayer_url}`);
    console.log(`  Sources: [${spKeys}]`);
  }

  console.log('\n🎉 Evolving Skies surgical remediation fully complete!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal remediation error:', err);
  process.exit(1);
});
