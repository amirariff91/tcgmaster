import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';

interface TcgGroup {
  groupId: number;
  name: string;
  abbreviation?: string;
}

interface TcgExtendedData {
  name: string;
  value: string;
}

interface TcgProduct {
  productId: number;
  name: string;
  cleanName?: string;
  url?: string;
  extendedData?: TcgExtendedData[];
}

interface DbCard {
  id: string;
  name: string;
  number: string;
  slug: string;
  set_name: string;
  tcg_player_id: string | null;
}

function cleanNumber(raw: string): string {
  if (!raw) return '';
  return raw.trim().toUpperCase();
}

async function mapDbfwTcgPlayer() {
  console.log('[DBFW TCGplayer Mapper] Fetching DBFW groups from TCGcsv (Category 80)...');

  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/80/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  if (!groupsRes.ok) {
    throw new Error(`Failed to fetch groups: ${groupsRes.statusText}`);
  }
  const groupsData = await groupsRes.json();
  const groups: TcgGroup[] = groupsData.results || [];
  console.log(`[DBFW TCGplayer Mapper] Found ${groups.length} groups.`);

  // Load English DBFW cards from DB
  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.number, c.slug, s.name as set_name, c.tcg_player_id
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = 'dbfw'
      AND c.slug NOT LIKE '%-ja'
  `);
  console.log(`[DBFW TCGplayer Mapper] Loaded ${cards.length} English DBFW cards from DB.`);

  // Index cards by cleaned number
  const cardsByNumber = new Map<string, DbCard[]>();
  for (const c of cards) {
    const num = cleanNumber(c.number || c.slug);
    if (!cardsByNumber.has(num)) cardsByNumber.set(num, []);
    cardsByNumber.get(num)!.push(c);
  }

  const updates: Array<{ id: string; tcg_player_id: string; tcgplayer_url: string; rarity?: string }> = [];

  for (const g of groups) {
    console.log(`[DBFW TCGplayer Mapper] Processing group: ${g.name} (${g.groupId})...`);
    try {
      const prodRes = await fetch(`https://tcgcsv.com/tcgplayer/80/${g.groupId}/products`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      if (!prodRes.ok) continue;

      const prodData = await prodRes.json();
      const products: TcgProduct[] = prodData.results || [];

      for (const prod of products) {
        const numExt = prod.extendedData?.find((e) => e.name === 'Number')?.value;
        const rarityExt = prod.extendedData?.find((e) => e.name === 'Rarity')?.value;
        if (!numExt) continue;

        const prodNum = numExt.trim().toUpperCase();
        const isAlt = prod.name.toLowerCase().includes('alternate art');

        let candidates = cardsByNumber.get(prodNum) || [];
        if (isAlt) {
          const altCandidates = [
            ...(cardsByNumber.get(`${prodNum}_P1`) || []),
            ...(cardsByNumber.get(`${prodNum}-P1`) || []),
          ];
          if (altCandidates.length > 0) candidates = altCandidates;
        }

        if (candidates.length === 1) {
          const match = candidates[0];
          if (!match.tcg_player_id || match.tcg_player_id !== String(prod.productId)) {
            updates.push({
              id: match.id,
              tcg_player_id: String(prod.productId),
              tcgplayer_url: prod.url || `https://www.tcgplayer.com/product/${prod.productId}`,
              rarity: rarityExt,
            });
          }
        }
      }
    } catch (err) {
      console.error(`Error processing group ${g.groupId}:`, err);
    }
  }

  console.log(`[DBFW TCGplayer Mapper] Found ${updates.length} matches to update.`);

  if (updates.length > 0) {
    const batchSize = 200;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await dbQuery(
        `UPDATE cards AS c
         SET tcg_player_id = v.tcg_player_id,
             tcgplayer_url = COALESCE(c.tcgplayer_url, v.tcgplayer_url),
             rarity = COALESCE(c.rarity, v.rarity)
         FROM (
           SELECT (x->>'id')::uuid AS id,
                  x->>'tcg_player_id' AS tcg_player_id,
                  x->>'tcgplayer_url' AS tcgplayer_url,
                  x->>'rarity' AS rarity
           FROM jsonb_array_elements($1::jsonb) AS x
         ) AS v
         WHERE c.id = v.id`,
        [JSON.stringify(batch)],
      );
    }
    console.log(`[DBFW TCGplayer Mapper] Successfully updated ${updates.length} cards in DB!`);
  }
}

mapDbfwTcgPlayer()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
