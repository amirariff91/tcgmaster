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
  imageUrl?: string;
  extendedData?: TcgExtendedData[];
}

async function backfillPokemonJaRaritiesAndNames() {
  console.log('[Pokemon JA Rarity Backfill] Fetching Category 85 (Pokemon Japan) groups...');

  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/85/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  if (!groupsRes.ok) {
    throw new Error(`Failed to fetch groups: ${groupsRes.statusText}`);
  }
  const groupsData = await groupsRes.json();
  const groups: TcgGroup[] = groupsData.results || [];
  console.log(`[Pokemon JA Rarity Backfill] Found ${groups.length} groups.`);

  let totalUpdated = 0;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (i % 25 === 0) {
      console.log(`[Pokemon JA Rarity Backfill] Progress: ${i}/${groups.length} groups processed...`);
    }

    try {
      const prodRes = await fetch(`https://tcgcsv.com/tcgplayer/85/${g.groupId}/products`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      if (!prodRes.ok) continue;

      const prodData = await prodRes.json();
      const products: TcgProduct[] = prodData.results || [];

      const updates: Array<{ tcgId: string; rarity: string; cleanName: string; imageUrl?: string }> = [];

      for (const p of products) {
        const rarity = p.extendedData?.find((e) => e.name === 'Rarity')?.value;
        const cleanName = p.cleanName || p.name;
        const highResImg = p.imageUrl ? p.imageUrl.replace('_200w.jpg', '_400w.jpg') : undefined;

        if (p.productId && (rarity || cleanName)) {
          updates.push({
            tcgId: String(p.productId),
            rarity: rarity || '',
            cleanName,
            imageUrl: highResImg,
          });
        }
      }

      if (updates.length > 0) {
        const res = await dbQuery<{ count: string }>(
          `WITH updated AS (
             UPDATE cards AS c
             SET rarity = CASE WHEN v.rarity <> '' THEN v.rarity ELSE c.rarity END,
                 name = CASE WHEN c.name IN ('Special Card', 'No', '') AND v.clean_name <> '' THEN v.clean_name ELSE c.name END,
                 image_url = CASE WHEN c.image_url IS NULL AND v.image_url <> '' THEN v.image_url ELSE c.image_url END
             FROM (
               SELECT (x->>'tcgId') AS tcg_id,
                      (x->>'rarity') AS rarity,
                      (x->>'cleanName') AS clean_name,
                      COALESCE(x->>'imageUrl', '') AS image_url
               FROM json_array_elements($1::json) AS x
             ) AS v
             WHERE c.tcg_player_id = v.tcg_id
             RETURNING c.id
           )
           SELECT count(*)::text as count FROM updated`,
          [JSON.stringify(updates)],
        );
        const count = parseInt(res[0]?.count || '0', 10);
        totalUpdated += count;
      }
    } catch (err) {
      console.error(`Error on group ${g.groupId}:`, err);
    }
  }

  console.log(`\n======================================================`);
  console.log(`[Pokemon JA Rarity Backfill] Successfully updated ${totalUpdated} cards!`);
  console.log(`======================================================\n`);
}

backfillPokemonJaRaritiesAndNames()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
