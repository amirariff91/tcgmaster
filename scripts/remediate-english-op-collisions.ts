import { pool } from '../lib/db/client';
import * as fs from 'fs';

interface TcgProduct {
  productId: number;
  name: string;
  cleanName: string;
  imageUrl: string;
  groupId: number;
  url: string;
  extendedData?: { name: string; value: string }[];
}

interface TcgGroup {
  groupId: number;
  name: string;
  abbreviation?: string;
}

const CATEGORY_ID = 68; // One Piece

async function auditAndFixCollisions() {
  console.log('=== Step 1: Fetching all TCGCSV One Piece Groups & Products ===');
  const groupsRes = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/groups`, {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  const groups: TcgGroup[] = (await groupsRes.json()).results || [];

  // Exclude non-English groups
  const relevantGroups = groups.filter(g => {
    const name = g.name.toLowerCase();
    return !name.includes('japanese') && !name.includes('asia');
  });
  console.log(`Loaded ${relevantGroups.length} English groups.`);

  // Map products by clean card number (e.g. "OP01-016", "ST01-006")
  const productsByNumber = new Map<string, TcgProduct[]>();

  for (const group of relevantGroups) {
    const prodRes = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${group.groupId}/products`, {
      headers: { 'User-Agent': 'curl/8.4.0' },
    });
    const products: TcgProduct[] = (await prodRes.json()).results || [];
    for (const p of products) {
      const num = p.extendedData?.find(d => d.name === 'Number')?.value?.trim().toUpperCase();
      if (num) {
        if (!productsByNumber.has(num)) {
          productsByNumber.set(num, []);
        }
        productsByNumber.get(num)!.push(p);
      }
    }
  }
  console.log(`Indexed ${productsByNumber.size} distinct card numbers across TCGPlayer.`);

  console.log('\n=== Step 2: Fetching All Collided Card Families in Database ===');
  const collisionsRes = await pool.query(`
    SELECT csm.external_id, csm.external_title, 
           json_agg(json_build_object('id', c.id, 'slug', c.slug, 'name', c.name, 'number', c.number, 'rarity', c.rarity)) as cards
    FROM card_source_mapping csm
    JOIN cards c ON csm.card_id = c.id
    WHERE csm.source = 'tcgplayer' AND c.slug LIKE 'op-%' AND c.slug NOT LIKE '%-ja'
    GROUP BY csm.external_id, csm.external_title
    HAVING count(*) > 1
    ORDER BY count(*) DESC;
  `);

  console.log(`Found ${collisionsRes.rows.length} collision groups to disambiguate.`);

  const corrections: Array<{
    cardId: string;
    slug: string;
    oldId: string;
    newId: number | null;
    newTitle: string | null;
    action: 'REMAP' | 'UNMAP_AMBIGUOUS_PROMO';
  }> = [];

  for (const group of collisionsRes.rows) {
    const cards = group.cards;
    const baseNumber = (cards[0].number || '').split('_')[0].trim().toUpperCase();
    const candidateProducts = productsByNumber.get(baseNumber) || [];

    for (const card of cards) {
      const slug: string = card.slug;
      const isBase = !slug.includes('_p') && !slug.includes('_r');
      const isReprint = slug.includes('_r');
      const isAltArt = slug.includes('_p1') || slug.includes('_p2');
      const isHighVariant = slug.includes('_p3') || slug.includes('_p4') || slug.includes('_p5') || slug.includes('_p6') || slug.includes('_p7') || slug.includes('_p8');

      let targetProduct: TcgProduct | null = null;

      if (isBase) {
        // Base card must match product without variant markers
        targetProduct = candidateProducts.find(p => {
          const n = p.name.toLowerCase();
          return !n.includes('alternate art') && !n.includes('parallel') && !n.includes('manga') &&
                 !n.includes('special') && !n.includes('sp') && !n.includes('wanted') && !n.includes('reprint') &&
                 !n.includes('winner') && !n.includes('cup') && !n.includes('finalist') && !n.includes('foil');
        }) || null;
      } else if (isReprint) {
        // Must match reprint / PRB / The Best
        targetProduct = candidateProducts.find(p => {
          const n = p.name.toLowerCase();
          return n.includes('reprint') || n.includes('the best') || n.includes('foil') || n.includes('full art');
        }) || null;
      } else if (isAltArt) {
        // Match standard alternate art / parallel
        targetProduct = candidateProducts.find(p => {
          const n = p.name.toLowerCase();
          return (n.includes('alternate art') || n.includes('parallel')) &&
                 !n.includes('manga') && !n.includes('special') && !n.includes('sp');
        }) || null;
      } else if (isHighVariant) {
        // SP, Wanted, or specific promotional prize
        targetProduct = candidateProducts.find(p => {
          const n = p.name.toLowerCase();
          return n.includes('sp') || n.includes('special') || n.includes('wanted') || n.includes('winner') || n.includes('finalist');
        }) || null;
      }

      if (targetProduct && String(targetProduct.productId) !== String(group.external_id)) {
        corrections.push({
          cardId: card.id,
          slug,
          oldId: group.external_id,
          newId: targetProduct.productId,
          newTitle: targetProduct.name,
          action: 'REMAP',
        });
      } else if (!targetProduct && !isBase) {
        // If a high variant doesn't have a distinct product on TCGPlayer and is currently mapped
        // to a cheap base card, we UNMAP it so it doesn't display a false base price!
        corrections.push({
          cardId: card.id,
          slug,
          oldId: group.external_id,
          newId: null,
          newTitle: null,
          action: 'UNMAP_AMBIGUOUS_PROMO',
        });
      }
    }
  }

  console.log(`\nIdentified ${corrections.length} necessary corrections across the collided families.`);

  // Write report to JSON
  fs.writeFileSync('scripts/collision-remediation-report.json', JSON.stringify(corrections, null, 2));
  console.log('Saved collision remediation report to scripts/collision-remediation-report.json');

  console.log('\n=== Step 3: Executing Database Updates & Quarantine Migration ===');
  const dictPath = 'lib/price-engine/mapping-dictionary.json';
  const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

  let remappedCount = 0;
  let unmappedCount = 0;

  for (const c of corrections) {
    if (c.action === 'REMAP' && c.newId) {
      // 1. Update card_source_mapping
      await pool.query(`
        UPDATE card_source_mapping
        SET external_id = $1::text,
            external_title = $2::text,
            external_url = 'https://www.tcgplayer.com/product/' || $1::text,
            confidence = 'confirmed',
            matched_by = 'dictionary',
            updated_at = NOW()
        WHERE card_id = $3 AND source = 'tcgplayer'
      `, [String(c.newId), c.newTitle, c.cardId]);

      // 2. Update cards table
      await pool.query(`
        UPDATE cards
        SET tcg_player_id = $1::text,
            tcgplayer_url = 'https://www.tcgplayer.com/product/' || $1::text
        WHERE id = $2
      `, [String(c.newId), c.cardId]);

      // 3. Update dictionary
      dict[c.slug] = c.newId;
      remappedCount++;
    } else if (c.action === 'UNMAP_AMBIGUOUS_PROMO') {
      // Unmap so it doesn't display incorrect base price
      await pool.query(`
        DELETE FROM card_source_mapping
        WHERE card_id = $1 AND source = 'tcgplayer'
      `, [c.cardId]);

      await pool.query(`
        UPDATE cards
        SET tcg_player_id = NULL,
            tcgplayer_url = NULL
        WHERE id = $1
      `, [c.cardId]);

      delete dict[c.slug];
      unmappedCount++;
    }

    // 4. Quarantine previous contaminated price history records for this card
    const hist = await pool.query(
      "SELECT id FROM price_history WHERE card_id = $1 AND source = 'tcgplayer'",
      [c.cardId]
    );

    if (hist.rows.length > 0) {
      const ids = hist.rows.map(r => `'${r.id}'`).join(',');
      await pool.query(`
        INSERT INTO price_quarantine (
          card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at
        )
        SELECT card_id, source, grade, price, price_native, currency, price_kind,
               'manual-mapping-correction',
               jsonb_build_object('note', 'Collided variant remapped or unmapped', 'old_product_id', $1::text),
               recorded_at
        FROM price_history WHERE id IN (${ids})
      `, [c.oldId]);

      await pool.query(`DELETE FROM price_history WHERE id IN (${ids})`);
    }
  }

  // Save dictionary
  fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2) + '\n');
  console.log(`Remapped ${remappedCount} variants to distinct products.`);
  console.log(`Unmapped ${unmappedCount} ambiguous variants without matching TCGPlayer products.`);
  console.log('Updated lib/price-engine/mapping-dictionary.json');

  console.log('\n=== Collision Remediation Complete! ===');
  process.exit(0);
}

auditAndFixCollisions().catch(e => {
  console.error(e);
  process.exit(1);
});
