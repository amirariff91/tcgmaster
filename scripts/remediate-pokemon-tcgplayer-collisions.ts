import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { syncDualEngineSales } from './sync-tcgplayer-dual-engine';

interface TcgProduct {
  productId: number;
  name: string;
  extendedData?: { name: string; value: string }[];
}

interface DuplicateGroup {
  set_id: string;
  set_name: string;
  set_slug: string;
  tcg_player_id: string;
  count: string;
  card_ids: string[];
  card_slugs: string[];
  card_numbers: string[];
  card_names: string[];
}

/**
 * Fetch products for a TCGPlayer category 3 group from tcgcsv
 */
async function fetchGroupProducts(groupId: number): Promise<TcgProduct[]> {
  try {
    const res = await fetch(`https://tcgcsv.com/tcgplayer/3/${groupId}/products`, {
      headers: { 'User-Agent': 'curl/8.4.0' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []) as TcgProduct[];
  } catch (err: any) {
    console.warn(`[fetchGroupProducts] Error fetching group ${groupId}:`, err.message);
    return [];
  }
}

async function runRemediation() {
  console.log('==================================================================');
  console.log('Starting Pokemon TCGPlayer Mapping Collision Remediation');
  console.log('==================================================================');

  // Step 1: Pre-fetch all TCGPlayer groups for category 3 (Pokemon)
  console.log('Fetching official Pokemon groups list from TCGcsv...');
  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/3/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  const groupsData = await groupsRes.json();
  const allGroups: { groupId: number; name: string }[] = groupsData.results || [];
  console.log(`Loaded ${allGroups.length} official Pokemon groups.`);

  function normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Step 2: Query all sets in DB that currently have cards sharing the same tcg_player_id
  const duplicateRows = await dbQuery<DuplicateGroup>(`
    SELECT 
      s.id as set_id,
      s.name as set_name,
      s.slug as set_slug,
      c.tcg_player_id,
      count(*) as count,
      array_agg(c.id::text) as card_ids,
      array_agg(c.slug) as card_slugs,
      array_agg(c.number) as card_numbers,
      array_agg(c.name) as card_names
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE c.tcg_player_id IS NOT NULL 
      AND c.tcg_player_id != ''
      AND s.slug LIKE 'pokemon-%'
      AND s.slug NOT LIKE '%-ja'
    GROUP BY s.id, s.name, s.slug, c.tcg_player_id
    HAVING count(*) > 1
    ORDER BY count(*) DESC;
  `);

  console.log(`Found ${duplicateRows.length} collided groups across English Pokemon sets.`);

  // Group collisions by set
  const setsMap = new Map<string, DuplicateGroup[]>();
  for (const row of duplicateRows) {
    if (!setsMap.has(row.set_id)) setsMap.set(row.set_id, []);
    setsMap.get(row.set_id)!.push(row);
  }
  console.log(`Affecting ${setsMap.size} distinct sets.`);

  const cachedProducts = new Map<number, TcgProduct[]>();

  let totalReassigned = 0;
  let totalQuarantined = 0;

  for (const [setId, dupGroups] of setsMap.entries()) {
    const setName = dupGroups[0].set_name;
    const setSlug = dupGroups[0].set_slug;
    const setNorm = normalize(setName);

    // Find best matching TCGPlayer group
    let matchedGroup = allGroups.find(g => normalize(g.name) === setNorm);
    if (!matchedGroup) {
      matchedGroup = allGroups.find(g => {
        const gNorm = normalize(g.name);
        return gNorm.includes(setNorm) || setNorm.includes(gNorm);
      });
    }

    if (!matchedGroup) {
      console.warn(`[SKIP] Could not match TCGPlayer group for set "${setName}" (${setSlug})`);
      continue;
    }

    console.log(`\n------------------------------------------------------------------`);
    console.log(`Remediating Set: "${setName}" -> TCGPlayer Group: "${matchedGroup.name}" (${matchedGroup.groupId})`);
    console.log(`------------------------------------------------------------------`);

    let products = cachedProducts.get(matchedGroup.groupId);
    if (!products) {
      products = await fetchGroupProducts(matchedGroup.groupId);
      cachedProducts.set(matchedGroup.groupId, products);
    }

    if (products.length === 0) {
      console.warn(`  ! No products found in group ${matchedGroup.groupId}`);
      continue;
    }

    // Build index by clean card number
    // e.g. "174/182" -> "174", "048/203" -> "48", "TG01/TG30" -> "tg01"
    const productByNumber = new Map<string, TcgProduct>();
    for (const p of products) {
      const numExt = p.extendedData?.find(d => d.name === 'Number')?.value;
      if (numExt) {
        const clean = numExt.split('/')[0].trim().replace(/^0+/, '').toLowerCase();
        if (clean && !productByNumber.has(clean)) {
          productByNumber.set(clean, p);
        }
      }
    }

    // Remediate each collision in this set
    for (const dup of dupGroups) {
      for (let i = 0; i < dup.card_ids.length; i++) {
        const cardId = dup.card_ids[i];
        const cardSlug = dup.card_slugs[i];
        const cardNum = dup.card_numbers[i].replace(/^0+/, '').trim().toLowerCase();
        const cardName = dup.card_names[i];

        const correctProduct = productByNumber.get(cardNum);
        if (correctProduct) {
          const newProductId = correctProduct.productId.toString();

          if (newProductId !== dup.tcg_player_id) {
            console.log(`  [FIX] ${cardSlug} (#${dup.card_numbers[i]} "${cardName}"): ${dup.tcg_player_id} -> ${newProductId} ("${correctProduct.name}")`);

            // 1. Move contaminated price_history to price_quarantine
            await dbQuery(`
              INSERT INTO price_quarantine (
                card_id, source, price, currency, grade, observed_at, price_kind, reason, evidence
              )
              SELECT 
                card_id, source, price, currency, grade, recorded_at, price_kind, 'manual-mapping-correction',
                json_build_object('card_slug', $2::text, 'reassigned_from', $3::text, 'reassigned_to', $4::text)::jsonb
              FROM price_history
              WHERE card_id = $1 AND source = 'tcgplayer';
            `, [cardId, cardSlug, dup.tcg_player_id, newProductId]);

            await dbQuery(`
              DELETE FROM price_history
              WHERE card_id = $1 AND source = 'tcgplayer';
            `, [cardId]);

            totalQuarantined++;

            // 2. Update card's tcg_player_id and tcgplayer_url
            await dbQuery(`
              UPDATE cards
              SET tcg_player_id = $1,
                  tcgplayer_url = $2
              WHERE id = $3;
            `, [
              newProductId,
              `https://www.tcgplayer.com/product/${newProductId}`,
              cardId
            ]);

            totalReassigned++;

            // 3. Dual-engine resync
            try {
              const syncRes = await syncDualEngineSales(cardId, newProductId);
              console.log(`    ✓ Resynced: Market $${syncRes.finalPrice ?? 'N/A'} (${syncRes.insertedHistoryCount} history pts)`);
            } catch (err: any) {
              console.warn(`    ! Resync err: ${err.message}`);
            }

            await new Promise(r => setTimeout(r, 120));
          } else {
            console.log(`  [OK] ${cardSlug} (#${dup.card_numbers[i]}) correctly holds Base ID ${dup.tcg_player_id}`);
          }
        } else {
          console.warn(`  [UNRESOLVED] No product matching number #${cardNum} in group ${matchedGroup.groupId} for ${cardSlug}`);
        }
      }
    }
  }

  console.log('\n==================================================================');
  console.log('Remediation Complete!');
  console.log(`- Total cards reassigned to correct unique product ID: ${totalReassigned}`);
  console.log(`- Total cards quarantined: ${totalQuarantined}`);
  console.log('==================================================================');
}

if (import.meta.main) {
  runRemediation()
    .catch(console.error)
    .finally(async () => {
      await pool.end();
    });
}
