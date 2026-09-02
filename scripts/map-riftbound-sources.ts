import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';

interface RiftcodexCard {
  id: string;
  name: string;
  riftbound_id: string;
  tcgplayer_id: string | null;
  collector_number: number | string;
}

interface CardsApiResponse {
  items: RiftcodexCard[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

interface DbCard {
  id: string;
  name: string;
  number: string;
  slug: string;
  set_name: string;
}

function sanitizeUrlToken(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function mapRiftboundSources() {
  console.log('[Riftbound Mapper] Loading Riftbound cards from database...');

  const dbCards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.number, c.slug, s.name as set_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'riftbound'
  `);
  console.log(`[Riftbound Mapper] Found ${dbCards.length} Riftbound cards in database.`);

  // Fetch all cards from Riftcodex API to get official tcgplayer_id
  console.log('[Riftbound Mapper] Fetching card metadata from api.riftcodex.com...');
  const tcgPlayerIdMap = new Map<string, string>(); // number -> tcgplayer_id

  let page = 1;
  const pageSize = 100;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await fetch(`https://api.riftcodex.com/cards?page=${page}&size=${pageSize}`);
      if (!res.ok) break;
      const data: CardsApiResponse = await res.json();
      for (const card of data.items || []) {
        if (card.tcgplayer_id && card.collector_number) {
          tcgPlayerIdMap.set(String(card.collector_number).toLowerCase(), card.tcgplayer_id);
          tcgPlayerIdMap.set(String(card.riftbound_id).toLowerCase(), card.tcgplayer_id);
        }
      }
      if (page >= data.pages) hasMore = false;
      else page++;
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e);
      break;
    }
  }

  console.log(`[Riftbound Mapper] Loaded ${tcgPlayerIdMap.size} official TCGplayer IDs from Riftcodex.`);

  const updates: Array<{
    id: string;
    tcg_player_id: string | null;
    pricecharting_url: string;
    cardrush_url: string;
  }> = [];

  for (const c of dbCards) {
    const cleanNum = c.number.replace(/^0+/, '');
    const cleanNumberForMap = c.number.toLowerCase();
    const tcgId = tcgPlayerIdMap.get(cleanNumberForMap) || tcgPlayerIdMap.get(c.number.toLowerCase()) || null;

    const cardSlug = sanitizeUrlToken(`${c.name} ${cleanNum}`);
    const setSlug = sanitizeUrlToken(`riftbound ${c.set_name}`);
    const pcUrl = `https://www.pricecharting.com/game/${setSlug}/${cardSlug}`;
    const cardrushUrl = `https://www.cardrush-db.jp/phone/product-list?keyword=${encodeURIComponent(c.number)}`;

    updates.push({
      id: c.id,
      tcg_player_id: tcgId,
      pricecharting_url: pcUrl,
      cardrush_url: cardrushUrl,
    });
  }

  console.log(`[Riftbound Mapper] Batch updating ${updates.length} cards...`);

  const batchSize = 250;
  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    await dbQuery(`
      UPDATE cards AS c
      SET tcg_player_id = v.tcg_player_id,
          pricecharting_url = v.pricecharting_url,
          cardrush_url = v.cardrush_url
      FROM (
        SELECT (x->>'id')::uuid AS id,
               x->>'tcg_player_id' AS tcg_player_id,
               x->>'pricecharting_url' AS pricecharting_url,
               x->>'cardrush_url' AS cardrush_url
        FROM jsonb_array_elements($1::jsonb) AS x
      ) AS v
      WHERE c.id = v.id
    `, [JSON.stringify(chunk)]);
    console.log(`[Riftbound Mapper] Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length}...`);
  }

  console.log('[Riftbound Mapper] Riftbound sources mapped successfully!');
}

mapRiftboundSources()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
