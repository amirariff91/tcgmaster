import { dbQuery } from '../lib/db/client';
import { altClient, type AltItemDocument } from '../lib/price-engine/alt/client';

interface CardRow {
  id: string;
  name: string;
  number: string;
  slug: string;
  set_id: string;
  set_name: string;
  set_slug: string;
}

const GRADING_COMPANY_MAP: Record<string, string> = {
  PSA: '74c51627-cc4b-4a82-a1c0-52b3975b47b7',
  BGS: 'cda2045f-5d78-49e7-b1c8-de04dac9888d',
  CGC: 'dce6169f-8958-4229-861b-686a4644c984',
  SGC: '7a7b5849-788b-40f6-9f42-14f2f27f68b3',
  TAG: 'da09e2df-2464-40f2-ae0e-0296253d811f',
};

const FOREIGN_LANGUAGE_REGEX = /\b(japanese|german|spanish|french|korean|chinese|italian|deutsch|italiano)\b/i;

function cleanName(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isForeignListing(doc: AltItemDocument): boolean {
  const fullText = `${doc.name || ''} ${doc.itemName || ''} ${doc.rawName || ''} ${doc.brand || ''}`;
  return FOREIGN_LANGUAGE_REGEX.test(fullText);
}

function matchesCard(card: CardRow, doc: AltItemDocument): boolean {
  if (isForeignListing(doc)) return false;

  // Exact number comparison (strip leading zeros like 004 -> 4)
  const docNumClean = String(doc.cardNumber || '').trim().replace(/^0+/, '');
  const cardNumClean = String(card.number || '').trim().replace(/^0+/, '');
  if (docNumClean !== cardNumClean) return false;

  // Name check
  const cardNameClean = cleanName(card.name);
  const docNameClean = cleanName(`${doc.name || ''} ${doc.itemName || ''}`);
  
  const cardWords = cardNameClean.split(' ').filter(w => w.length > 2);
  const matchesWords = cardWords.every(w => docNameClean.includes(w));
  if (!matchesWords) return false;

  // Set / Brand check
  const setNameClean = cleanName(card.set_name || '');
  const fullDocText = cleanName(`${doc.brand || ''} ${doc.name || ''} ${doc.itemName || ''}`);

  if (setNameClean === 'base' || setNameClean === 'base set') {
    if (fullDocText.includes('base set 2') || fullDocText.includes('celebrations') || fullDocText.includes('legendary collection') || fullDocText.includes('evolutions')) {
      return false;
    }
  } else {
    const setWords = setNameClean.split(' ').filter(w => w.length > 3 && !['pokemon', 'scarlet', 'violet', 'sword', 'shield'].includes(w));
    if (setWords.length > 0) {
      const matchesSet = setWords.some(w => fullDocText.includes(w));
      if (!matchesSet) return false;
    }
  }

  return true;
}

export async function syncSingleSet(setSlug: string) {
  console.log(`\n========================================`);
  console.log(`[Sync] Starting Alt graded price sync for set: ${setSlug}`);
  console.log(`========================================`);

  const cards = await dbQuery<CardRow>(`
    SELECT c.id, c.name, c.number, c.slug, s.id as set_id, s.name as set_name, s.slug as set_slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug = $1
    ORDER BY CAST(NULLIF(regexp_replace(c.number, '[^0-9]', '', 'g'), '') AS integer) ASC NULLS LAST;
  `, [setSlug]);

  if (!cards.length) {
    console.log(`[Sync] No cards found for set ${setSlug}`);
    return { inserted: 0, mapped: 0 };
  }

  console.log(`[Sync] Fetched ${cards.length} cards in set "${cards[0].set_name}"`);

  let totalPricesInserted = 0;
  let totalMappingsCreated = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    process.stdout.write(`[${i + 1}/${cards.length}] #${card.number} ${card.name}... `);

    try {
      const searchResult = await altClient.searchPokemon({
        cardNumber: card.number,
        query: card.name,
        perPage: 30,
      });

      const matchingHits = searchResult.hits.filter(h => matchesCard(card, h.document));
      if (!matchingHits.length) {
        console.log(`0 hits.`);
        continue;
      }

      console.log(`${matchingHits.length} hits!`);

      for (const hit of matchingHits) {
        const doc = hit.document;
        const gradingCompanyId = doc.gradingCompany ? GRADING_COMPANY_MAP[doc.gradingCompany.toUpperCase()] || null : null;
        const grade = doc.grade ? String(doc.grade).trim() : (doc.gradeKey ? doc.gradeKey.split('-')[1] : null);
        
        // Reject active auctions that are only showing starting bids ($0.99, $5 etc.)
        if (doc.listingType === 'EXTERNAL_AUCTION' && (!doc.price || doc.price < 50) && !doc.latestExternalTransaction?.price) {
          // If Alt has a modeled value, use altValue; otherwise skip opening bids
          if (!doc.altValue || doc.altValue <= 0) continue;
        }

        // Determine authentic price: prioritize completed external transaction, then altValue, then fixed price
        const price = doc.latestExternalTransaction?.price || (doc.listingType === 'EXTERNAL_FIXED_PRICE' ? doc.price : null) || doc.altValue || null;
        if (!price || price <= 0) continue;

        const platform = doc.latestExternalTransaction?.platform || doc.auctionHouse || 'Alt';
        const saleType = doc.latestExternalTransaction ? 'SOLD_TRANSACTION' : (doc.listingType || 'MARKET');
        const recordedAt = doc.updatedAt ? new Date(doc.updatedAt * 1000).toISOString() : new Date().toISOString();
        const altUrl = doc.url || `https://alt.xyz/itm/${doc.id.replace('live_', '')}`;

        // 1. Insert into price_history
        await dbQuery(`
          INSERT INTO price_history (
            id, card_id, grading_company_id, grade, price, source, confidence,
            sale_type, is_notable, notable_reason, recorded_at, currency, price_native, price_kind
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, 'alt', 'high',
            $5, false, $6, $7, 'USD', $4, $8
          );
        `, [
          card.id,
          gradingCompanyId,
          grade,
          price,
          saleType,
          `Aggregated via Alt from ${platform} | ${doc.itemName || doc.name}`,
          recordedAt,
          doc.latestExternalTransaction ? 'sold_guide' : 'market',
        ]);
        totalPricesInserted++;

        // 2. Insert into card_source_mapping
        await dbQuery(`
          INSERT INTO card_source_mapping (
            id, card_id, source, external_id, external_url, external_title, external_set,
            confidence, matched_by, evidence, verified_at, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, 'alt', $2, $3, $4, $5,
            'derived', 'number-token', $6, NOW(), NOW(), NOW()
          )
          ON CONFLICT (card_id, source) DO UPDATE SET
            external_id = EXCLUDED.external_id,
            external_url = EXCLUDED.external_url,
            external_title = EXCLUDED.external_title,
            external_set = EXCLUDED.external_set,
            evidence = EXCLUDED.evidence,
            updated_at = NOW();
        `, [
          card.id,
          doc.id,
          altUrl,
          doc.itemName || doc.name,
          doc.brand,
          JSON.stringify({
            grade: doc.gradeKey,
            gradingCompany: doc.gradingCompany,
            platform,
            altValue: doc.altValue,
            price: doc.price,
          }),
        ]);
        totalMappingsCreated++;
      }
    } catch (err: any) {
      console.error(`Error card #${card.number}:`, err.message);
    }
  }

  console.log(`[Sync] Set ${setSlug} completed: ${totalPricesInserted} prices inserted, ${totalMappingsCreated} mapped.`);
  return { inserted: totalPricesInserted, mapped: totalMappingsCreated };
}

// Priority Chase Sets
const CHASE_SETS = [
  'pokemon-sv3pt5',     // 151
  'pokemon-swsh7',      // Evolving Skies
  'pokemon-cel25',      // Celebrations
  'pokemon-swsh12pt5',  // Crown Zenith
  'pokemon-sv2',        // Paldea Evolved
  'pokemon-swsh9',      // Brilliant Stars
  'pokemon-base3',      // Fossil
  'pokemon-base5',      // Team Rocket
  'pokemon-ex7',        // Team Rocket Returns
  'pokemon-neo1',       // Neo Genesis
  'pokemon-neo4',       // Neo Destiny
];

async function main() {
  const specificSet = process.argv[2];
  const queue = specificSet ? [specificSet] : CHASE_SETS;

  console.log(`Starting Alt graded sync across ${queue.length} prioritized chase sets...`);
  for (const setSlug of queue) {
    await syncSingleSet(setSlug);
    // Pause briefly between sets
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log('\nAll prioritized chase sets successfully synced!');
  process.exit(0);
}

if (import.meta.main) {
  main().catch(err => {
    console.error('Fatal batch sync error:', err);
    process.exit(1);
  });
}
