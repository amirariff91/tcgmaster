import { dbQuery } from "../lib/db/client";

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const Crockford32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function decodeUlidTime(ulid: string): Date {
  if (!ulid || ulid.length < 10) return new Date();
  const timePart = ulid.substring(0, 10).toUpperCase();
  let time = 0;
  for (let i = 0; i < timePart.length; i++) {
    const index = Crockford32.indexOf(timePart[i]);
    if (index !== -1) {
      time = time * 32 + index;
    }
  }
  return new Date(time);
}

function extractSnkrdunkId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:trading-cards|products|streetwears)\/(\d+)/i) || url.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

async function ingestSnkrdunkForCard(cardId: string, snkrdunkId: string, slug: string) {
  const productCode = `SW---${snkrdunkId}`;
  let totalSaved = 0;
  let page = 1;
  const maxPages = 50;

  console.log(`\nIngesting Snkrdunk sales for ${slug} (${productCode})...`);

  while (page <= maxPages) {
    try {
      const url = `https://snkrdunk.com/en/v1/products/${productCode}/used-listings?perPage=100&page=${page}&sortType=latest&isOnlyOnSale=false`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) break;

      const data = await res.json() as { usedListings?: any[] };
      const listings = data.usedListings || [];
      if (listings.length === 0) break;

      const soldListings = listings.filter((l: any) => l.isSold === true && Number(l.priceAmount) > 0);
      const insertRows = soldListings.map((l: any) => {
        const recordedAt = decodeUlidTime(l.listingUID || '').toISOString();
        let parsedGrade = 'raw';
        let gradingCompany = null;
        const condition = l.condition || 'A';
        if (['B', 'C', 'D'].includes(condition)) return null;

        const gradeMatch = condition.match(/^(PSA|BGS|CGC|TAG|AGS|ARS)(?:\s+Pristine|\s+Perfect|\s+Black Label|\s+Gold Label)?\s+([0-9]+\.?[0-9]*\+?)$/i);
        if (gradeMatch) {
          gradingCompany = gradeMatch[1].toLowerCase();
          parsedGrade = gradeMatch[2].replace('+', '');
        } else if (condition.includes('PSA')) {
          const m = condition.match(/PSA\s*([0-9]+\.?[0-9]*)/i);
          if (m) { gradingCompany = 'psa'; parsedGrade = m[1]; }
        }

        const COMPANY_UUIDS: Record<string, string> = {
          psa: '74c51627-cc4b-4a82-a1c0-52b3975b47b7',
          bgs: 'cda2045f-5d78-49e7-b1c8-de04dac9888d',
          cgc: 'dce6169f-8958-4229-861b-686a4644c984',
        };

        return {
          card_id: cardId,
          source: 'snkrdunk',
          grade: parsedGrade,
          grading_company_id: gradingCompany ? COMPANY_UUIDS[gradingCompany] || null : null,
          price: Number(l.priceAmount),
          currency: l.currency || 'USD',
          recorded_at: recordedAt,
        };
      }).filter((r: any) => r !== null);

      if (insertRows.length > 0) {
        for (const row of insertRows) {
          await dbQuery(`
            INSERT INTO price_history (card_id, source, grade, grading_company_id, price, currency, recorded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING
          `, [row.card_id, row.source, row.grade, row.grading_company_id, row.price, row.currency, row.recorded_at]);
        }
        totalSaved += insertRows.length;
      }

      page++;
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.error(`Error on page ${page}:`, e);
      break;
    }
  }

  console.log(`✅ Ingested ${totalSaved} Snkrdunk sales for ${slug}!`);
}

async function main() {
  const cards = await dbQuery<any>(`
    SELECT id, slug, name, snkrdunk_url
    FROM cards
    WHERE snkrdunk_url IS NOT NULL
      AND slug IN (
        'op-op05-119_p3-ja',
        'op-op08-106_p3-ja',
        'op-op08-106_p4-ja',
        'op-st01-001_p4-ja',
        'op-op09-118_p3-ja',
        'op-eb02-061_p3-ja'
      )
  `);

  console.log(`Found ${cards.length} cards with Snkrdunk URLs to ingest.`);
  for (const card of cards) {
    const snkrId = extractSnkrdunkId(card.snkrdunk_url);
    if (snkrId) {
      await ingestSnkrdunkForCard(card.id, snkrId, card.slug);
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
