import { pool } from '../lib/db/client';
import * as fs from 'fs';

// Map local DB set slug -> TCGPlayer Group ID
const SET_SLUG_TO_TCG_GROUP_ID: Record<string, number> = {
  'op-op-01': 3188,    // Romance Dawn
  'op-op-02': 17698,   // Paramount War
  'op-op-03': 22890,   // Pillars of Strength
  'op-op-04': 23024,   // Kingdoms of Intrigue
  'op-op-05': 23213,   // Awakening of the New Era
  'op-op-06': 23272,   // Wings of the Captain
  'op-op-07': 23387,   // 500 Years in the Future
  'op-op-08': 23462,   // Two Legends
  'op-op-09': 23589,   // Emperors in the New World
  'op-op-10': 23766,   // Royal Blood
  'op-op-11': 24241,   // A Fist of Divine Speed
  'op-op-12': 24302,   // Legacy of the Master
  'op-op-13': 24303,   // Carrying On His Will
  'op-op14-eb04': 24537, // The Azure Sea's Seven
  'op-op15-eb04': 24637, // Adventure on Kami's Island
  'op-op-16': 24664,   // The Time of Battle
  'op-eb-01': 23333,   // Memorial Collection
  'op-eb-02': 23834,   // Anime 25th Collection
  'op-eb-03': 24545,   // One Piece Heroines Edition
  'op-prb-01': 23496,  // Premium Booster -The Best-
  'op-prb-02': 24305,  // Premium Booster -The Best- Vol. 2
  'op-st-01': 3189,    // Straw Hat Crew
  'op-st-02': 3191,    // Worst Generation
  'op-st-03': 3192,    // The Seven Warlords of The Sea
  'op-st-04': 3190,    // Animal Kingdom Pirates
  'op-st-05': 17687,   // Film Edition
  'op-st-06': 17699,   // Absolute Justice
  'op-st-07': 22930,   // Big Mom Pirates
  'op-st-08': 22956,   // Monkey.D.Luffy
  'op-st-09': 22957,   // Yamato
  'op-st-10': 23243,   // The Three Captains
  'op-st-11': 23250,   // Uta
  'op-st-12': 23348,   // Zoro and Sanji
  'op-st-13': 23349,   // The Three Brothers
  'op-st-14': 23489,   // 3D2Y
  'op-st-15': 23490,   // Red Edward.Newgate
  'op-st-16': 23491,   // Green Uta
  'op-st-17': 23492,   // Blue Donquixote Doflamingo
  'op-st-18': 23493,   // Purple Monkey.D.Luffy
  'op-st-19': 23494,   // Black Smoker
  'op-st-20': 23495,   // Yellow Charlotte Katakuri
  'op-st-21': 23991,   // Starter Deck EX: Gear 5
  'op-st-22': 24304,   // Ace & Newgate
  'op-st-23': 24282,   // Red Shanks
  'op-st-24': 24283,   // Green Jewelry Bonney
  'op-st-25': 24284,   // Blue Buggy
  'op-st-26': 24285,   // Purple/Black Monkey.D.Luffy
  'op-st-27': 24286,   // Black Marshall.D.Teach
  'op-st-28': 24287,   // Green/Yellow Yamato
  'op-st-29': 24575,   // Egghead
  'op-st-30': 24678,   // Luffy & Ace
  'op-569901': 17675,  // One Piece Promotion Cards
  'op-569801': 23304,  // Collection Sets
};

interface TcgProduct {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string;
  groupId: number;
  url: string;
  extendedData?: { name: string; value: string }[];
}

const CATEGORY_ID = 68;

async function executeSetScopedFix() {
  console.log('=== Step 1: Pre-caching all products for relevant TCGPlayer Groups ===');
  const groupProducts = new Map<number, TcgProduct[]>();

  for (const [slug, groupId] of Object.entries(SET_SLUG_TO_TCG_GROUP_ID)) {
    if (groupProducts.has(groupId)) continue;
    const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${groupId}/products`, {
      headers: { 'User-Agent': 'curl/8.4.0' }
    });
    if (res.ok) {
      const prods: TcgProduct[] = (await res.json()).results || [];
      groupProducts.set(groupId, prods);
    }
  }
  console.log(`Pre-cached products for ${groupProducts.size} official TCGPlayer groups.`);

  console.log('\n=== Step 2: Querying all English One Piece cards from Database ===');
  const dbCards = await pool.query(`
    SELECT c.id, c.slug, c.name, c.number, c.rarity, c.set_id, s.slug as set_slug, s.name as set_name,
           csm.external_id, csm.external_title, cpc.headline_cents
    FROM cards c
    JOIN sets s ON c.set_id = s.id
    LEFT JOIN card_source_mapping csm ON c.id = csm.card_id AND csm.source = 'tcgplayer'
    LEFT JOIN card_price_current cpc ON c.id = cpc.card_id
    WHERE c.slug LIKE 'op-%' AND c.slug NOT LIKE '%-ja'
    ORDER BY c.slug;
  `);
  console.log(`Loaded ${dbCards.rows.length} English One Piece cards.`);

  const dictPath = 'lib/price-engine/mapping-dictionary.json';
  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

  let fixedCount = 0;
  let quarantinedCount = 0;
  let unmappedCount = 0;

  for (const card of dbCards.rows) {
    const setSlug = card.set_slug;
    const groupId = SET_SLUG_TO_TCG_GROUP_ID[setSlug];
    if (!groupId) continue;

    const products = groupProducts.get(groupId) || [];
    const baseNumber = (card.number || '').split('_')[0].trim().toUpperCase();

    // Filter candidate products strictly within this card's set group that match the card number
    const groupMatches = products.filter(p => {
      const num = p.extendedData?.find(d => d.name === 'Number')?.value?.trim().toUpperCase();
      return num === baseNumber;
    });

    if (groupMatches.length === 0) continue;

    const slug: string = card.slug;
    const isBase = !slug.includes('_p') && !slug.includes('_r');
    const isP1 = slug.includes('_p1');
    const isP2 = slug.includes('_p2');
    const isP3 = slug.includes('_p3');
    const isP4 = slug.includes('_p4');
    const isP5Plus = slug.includes('_p5') || slug.includes('_p6') || slug.includes('_p7') || slug.includes('_p8');
    const isReprint = slug.includes('_r');

    let matchedProd: TcgProduct | null = null;

    if (isBase) {
      matchedProd = groupMatches.find(p => {
        const n = p.name.toLowerCase();
        return !n.includes('alternate art') && !n.includes('parallel') && !n.includes('manga') &&
               !n.includes('super') && !n.includes('wanted') && !n.includes('special') && !n.includes('sp') &&
               !n.includes('reprint') && !n.includes('foil') && !n.includes('full art');
      }) || groupMatches[0];
    } else if (isP1) {
      // Standard Alternate Art / Parallel. EXCLUDE "Super", "Red Super", "Manga", "Gold"
      matchedProd = groupMatches.find(p => {
        const n = p.name.toLowerCase();
        return (n.includes('alternate art') || n.includes('parallel')) &&
               !n.includes('super') && !n.includes('manga') && !n.includes('gold') &&
               !n.includes('wanted') && !n.includes('special') && !n.includes('sp');
      }) || null;
    } else if (isP2) {
      // Manga / Super Alternate Art / Second Alt Art
      matchedProd = groupMatches.find(p => {
        const n = p.name.toLowerCase();
        return n.includes('manga') || n.includes('super alternate art') || (n.includes('alternate art') && n.includes('parallel'));
      }) || null;
    } else if (isP3 || isP4) {
      // SP / Wanted / Special Card
      matchedProd = groupMatches.find(p => {
        const n = p.name.toLowerCase();
        return n.includes('wanted') || n.includes('sp') || n.includes('special') || n.includes('alternate art');
      }) || null;
    } else if (isReprint) {
      // Reprint
      matchedProd = groupMatches.find(p => {
        const n = p.name.toLowerCase();
        return n.includes('reprint') || n.includes('full art') || n.includes('foil');
      }) || groupMatches.find(p => !p.name.toLowerCase().includes('alternate art')) || null;
    }

    // Specific targeted overrides for high-profile cards
    if (slug === 'op-op13-120_p1') {
      matchedProd = groupMatches.find(p => p.productId === 657413) || matchedProd; // Sabo Parallel
    } else if (slug === 'op-op06-118_r2') {
      matchedProd = groupMatches.find(p => p.productId === 656164) || matchedProd; // Zoro Reprint in PRB-02
    } else if (slug === 'op-op02-096_p3') {
      matchedProd = groupMatches.find(p => p.productId === 586720) || matchedProd; // Kuzan Alt Art in PRB-01
    } else if (slug === 'op-op09-051_p3') {
      matchedProd = groupMatches.find(p => p.productId === 596984 || p.productId === 596986) || matchedProd; // Buggy Manga/Wanted in OP-09
    } else if (slug === 'op-op05-060_p4') {
      matchedProd = groupMatches.find(p => p.productId === 629171) || matchedProd; // Luffy SP in EB-02
    }

    const currentExtId = card.external_id ? String(card.external_id) : null;

    if (matchedProd && String(matchedProd.productId) !== currentExtId) {
      console.log(`[FIX] ${slug} -> From [${currentExtId}] "${card.external_title}" to [${matchedProd.productId}] "${matchedProd.name}"`);

      // 1. Update mapping
      await pool.query(`
        INSERT INTO card_source_mapping (card_id, source, external_id, external_title, external_url, confidence, matched_by, updated_at)
        VALUES ($1, 'tcgplayer', $2, $3, 'https://www.tcgplayer.com/product/' || $2, 'confirmed', 'manual', NOW())
        ON CONFLICT (card_id, source)
        DO UPDATE SET external_id = EXCLUDED.external_id,
                      external_title = EXCLUDED.external_title,
                      external_url = EXCLUDED.external_url,
                      confidence = 'confirmed',
                      matched_by = 'manual',
                      updated_at = NOW()
      `, [card.id, String(matchedProd.productId), matchedProd.name]);

      // 2. Update cards table
      await pool.query(`
        UPDATE cards
        SET tcg_player_id = $1::text,
            tcgplayer_url = 'https://www.tcgplayer.com/product/' || $1::text
        WHERE id = $2
      `, [String(matchedProd.productId), card.id]);

      // 3. Quarantine old contaminated history
      const hist = await pool.query(
        "SELECT id FROM price_history WHERE card_id = $1 AND source = 'tcgplayer'",
        [card.id]
      );
      if (hist.rows.length > 0) {
        const ids = hist.rows.map(r => `'${r.id}'`).join(',');
        await pool.query(`
          INSERT INTO price_quarantine (
            card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
          )
          SELECT card_id, source, grade, price, price_native, currency, price_kind,
                 'manual-mapping-correction',
                 jsonb_build_object('note', 'Set-scoped TCGPlayer mapping correction', 'old_product_id', $1::text),
                 recorded_at
          FROM price_history WHERE id IN (${ids})
        `, [currentExtId]);

        await pool.query(`DELETE FROM price_history WHERE id IN (${ids})`);
        quarantinedCount += hist.rows.length;
      }

      dict[slug] = matchedProd.productId;
      fixedCount++;
    } else if (!matchedProd && !isBase && currentExtId) {
      // If variant has no distinct product in this set on TCGPlayer, unmap it so it doesn't show base price
      console.log(`[UNMAP] ${slug} has no distinct TCGPlayer product in set ${setSlug}. Unmapping from [${currentExtId}].`);
      await pool.query("DELETE FROM card_source_mapping WHERE card_id = $1 AND source = 'tcgplayer'", [card.id]);
      await pool.query("UPDATE cards SET tcg_player_id = NULL, tcgplayer_url = NULL WHERE id = $1", [card.id]);
      delete dict[slug];
      unmappedCount++;
    }
  }

  fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2) + '\n');
  console.log(`\n=== Remediation Completed ===`);
  console.log(`Corrected and remapped: ${fixedCount} cards.`);
  console.log(`Unmapped ambiguous variants: ${unmappedCount} cards.`);
  console.log(`Quarantined contaminated historical rows: ${quarantinedCount} rows.`);

  process.exit(0);
}

executeSetScopedFix().catch(e => {
  console.error(e);
  process.exit(1);
});
