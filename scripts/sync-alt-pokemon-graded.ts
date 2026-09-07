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
  // 1. Language check: must NOT be foreign
  if (isForeignListing(doc)) return false;

  // 2. Card number check: exact match
  if (String(doc.cardNumber).trim() !== String(card.number).trim()) return false;

  // 3. Card name check: card subject/name should match
  const cardNameClean = cleanName(card.name);
  const docNameClean = cleanName(`${doc.name || ''} ${doc.itemName || ''}`);
  
  // Every major word in the card name must exist in the listing
  const cardWords = cardNameClean.split(' ').filter(w => w.length > 2);
  const matchesWords = cardWords.every(w => docNameClean.includes(w));
  if (!matchesWords) return false;

  // 4. Set / Brand check: prevent matching same card number from different sets (e.g. Base Set vs Celebrations vs Legendary Collection)
  const brandClean = cleanName(doc.brand || '');
  const setNameClean = cleanName(card.set_name || '');
  const fullDocText = cleanName(`${doc.brand || ''} ${doc.name || ''} ${doc.itemName || ''}`);

  if (setNameClean === 'base' || setNameClean === 'base set') {
    // For Base Set, strictly avoid Base Set 2, Celebrations, Legendary Collection, Evolutions
    if (fullDocText.includes('base set 2') || fullDocText.includes('celebrations') || fullDocText.includes('legendary collection') || fullDocText.includes('evolutions')) {
      return false;
    }
  } else {
    // For other sets, at least one major distinctive set word must be present in the brand/listing
    const setWords = setNameClean.split(' ').filter(w => w.length > 3 && !['pokemon', 'scarlet', 'violet', 'sword', 'shield'].includes(w));
    if (setWords.length > 0) {
      const matchesSet = setWords.some(w => fullDocText.includes(w));
      if (!matchesSet) return false;
    }
  }

  return true;
}

async function syncSet(setSlug: string) {
  console.log(`\n========================================`);
  console.log(`Starting Alt graded price sync for set: ${setSlug}`);
  console.log(`========================================`);

  const cards = await dbQuery<CardRow>(`
    SELECT c.id, c.name, c.number, c.slug, s.id as set_id, s.name as set_name, s.slug as set_slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug = $1
    ORDER BY CAST(NULLIF(regexp_replace(c.number, '[^0-9]', '', 'g'), '') AS integer) ASC NULLS LAST;
  `, [setSlug]);

  if (!cards.length) {
    console.log(`No cards found for set ${setSlug}`);
    return;
  }

  console.log(`Fetched ${cards.length} cards in set ${cards[0].set_name}`);

  let totalPricesInserted = 0;
  let totalMappingsCreated = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    process.stdout.write(`[${i + 1}/${cards.length}] Checking #${card.number} ${card.name}... `);

    try {
      const searchResult = await altClient.searchPokemon({
        cardNumber: card.number,
        query: card.name,
        perPage: 25,
      });

      const matchingHits = searchResult.hits.filter(h => matchesCard(card, h.document));
      if (!matchingHits.length) {
        console.log(`No graded matches found.`);
        continue;
      }

      console.log(`Found ${matchingHits.length} graded hits!`);

      for (const hit of matchingHits) {
        const doc = hit.document;
        const gradingCompanyId = doc.gradingCompany ? GRADING_COMPANY_MAP[doc.gradingCompany.toUpperCase()] || null : null;
        const grade = doc.grade ? String(doc.grade).trim() : (doc.gradeKey ? doc.gradeKey.split('-')[1] : null);
        
        const price = doc.price || doc.altValue || null;
        if (!price || price <= 0) continue;

        const platform = doc.auctionHouse || doc.latestExternalTransaction?.platform || 'Alt';
        const saleType = doc.listingType || 'MARKET';
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
          doc.altValue && !doc.price ? 'market' : 'sold_guide',
        ]);
        totalPricesInserted++;

        // 2. Insert into card_source_mapping (if not already mapped)
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
      console.error(`Error processing card #${card.number}:`, err.message);
    }
  }

  console.log(`\n========================================`);
  console.log(`Completed sync for ${setSlug}:`);
  console.log(`- Graded price observations inserted: ${totalPricesInserted}`);
  console.log(`- Source mappings created: ${totalMappingsCreated}`);
  console.log(`========================================\n`);
}

async function main() {
  const targetSet = process.argv[2] || 'pokemon-base1';
  await syncSet(targetSet);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error in sync script:', err);
  process.exit(1);
});
