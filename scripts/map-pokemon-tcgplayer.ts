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
  extendedData?: TcgExtendedData[];
}

interface DbCard {
  id: string;
  name: string;
  number: string;
  slug: string;
  set_name: string;
  ppt_set_id: string;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function mapPokemonTcgPlayer() {
  console.log('[Pokemon TCGplayer Mapper] Fetching Pokemon groups from TCGcsv (Category 3)...');

  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/3/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  const groupsData = await groupsRes.json();
  const groups: TcgGroup[] = groupsData.results || [];
  console.log(`[Pokemon TCGplayer Mapper] Found ${groups.length} groups.`);

  // Load English Pokemon cards from DB
  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.number, c.slug, s.name as set_name, s.ppt_set_id
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%'
      AND s.slug NOT LIKE 'pokemon-%-ja'
  `);
  console.log(`[Pokemon TCGplayer Mapper] Loaded ${cards.length} English Pokemon cards from DB.`);

  // Group cards by set
  const cardsBySet = new Map<string, DbCard[]>();
  for (const c of cards) {
    const key = c.set_name.toLowerCase();
    if (!cardsBySet.has(key)) cardsBySet.set(key, []);
    cardsBySet.get(key)!.push(c);
  }

  let mappedCount = 0;
  const updates: Array<{ id: string; tcg_player_id: string }> = [];

  for (const group of groups) {
    const groupNorm = normalize(group.name);

    // Find matching DB set
    let matchedCards: DbCard[] | undefined;
    for (const [setName, setCards] of cardsBySet.entries()) {
      const setNorm = normalize(setName);
      if (setNorm === groupNorm || groupNorm.includes(setNorm) || setNorm.includes(groupNorm)) {
        matchedCards = setCards;
        break;
      }
    }

    if (!matchedCards || matchedCards.length === 0) continue;

    console.log(`[Pokemon TCGplayer Mapper] Mapping group "${group.name}" (${matchedCards.length} DB cards)...`);

    try {
      const prodRes = await fetch(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/products`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      const prodData = await prodRes.json();
      const products: TcgProduct[] = prodData.results || [];

      for (const card of matchedCards) {
        const cardNum = card.number.replace(/^0+/, '');
        const cardNameNorm = normalize(card.name);

        // Find product matching card number and name
        const match = products.find((p) => {
          const numExt = p.extendedData?.find((d) => d.name === 'Number')?.value;
          const pNum = numExt ? String(numExt).replace(/^0+/, '') : '';
          const pNameNorm = normalize(p.name);

          if (pNum && cardNum && pNum === cardNum) return true;
          return pNameNorm === cardNameNorm;
        });

        if (match) {
          updates.push({ id: card.id, tcg_player_id: String(match.productId) });
          mappedCount++;
        }
      }
    } catch (e) {
      console.error(`Error mapping group ${group.name}:`, e);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon TCGplayer Mapper] Prepared ${updates.length} card mappings!`);
  console.log(`========================================\n`);

  // Batch update DB
  const batchSize = 500;
  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    await dbQuery(`
      UPDATE cards AS c
      SET tcg_player_id = v.tcg_player_id
      FROM (
        SELECT (x->>'id')::uuid AS id, x->>'tcg_player_id' AS tcg_player_id
        FROM jsonb_array_elements($1::jsonb) AS x
      ) AS v
      WHERE c.id = v.id
    `, [JSON.stringify(chunk)]);
    console.log(`[Pokemon TCGplayer Mapper] Updated ${Math.min(i + batchSize, updates.length)} / ${updates.length} cards...`);
  }

  console.log('[Pokemon TCGplayer Mapper] Mapping complete!');
}

mapPokemonTcgPlayer()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
