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

interface DbCard {
  id: string;
  name: string;
  number: string;
  slug: string;
  set_id: string;
  set_name: string;
  ppt_set_id: string | null;
  image_url: string | null;
  tcg_player_id: string | null;
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function mapPokemonJaTcgPlayer() {
  console.log('[Pokemon JA Mapper] Fetching Category 85 (Pokemon Japan) groups from TCGcsv...');

  const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/85/groups', {
    headers: { 'User-Agent': 'curl/8.4.0' },
  });
  if (!groupsRes.ok) {
    console.error('Failed to fetch Category 85 groups:', groupsRes.statusText);
    return;
  }
  const groupsData = await groupsRes.json();
  const groups: TcgGroup[] = groupsData.results || [];
  console.log(`[Pokemon JA Mapper] Found ${groups.length} Japanese groups in Category 85.`);

  // Load all Japanese Pokemon cards from DB
  const cards = await dbQuery<DbCard>(`
    SELECT c.id, c.name, c.number, c.slug, c.set_id, s.name as set_name, s.ppt_set_id, c.image_url, c.tcg_player_id
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE s.slug LIKE 'pokemon-%-ja'
  `);
  console.log(`[Pokemon JA Mapper] Loaded ${cards.length} Japanese Pokemon cards from DB.`);

  // Group DB cards by normalized set name AND set code (ppt_set_id)
  const cardsBySet = new Map<string, DbCard[]>();
  const cardsByCode = new Map<string, DbCard[]>();

  for (const c of cards) {
    const nameKey = normalize(c.set_name);
    if (!cardsBySet.has(nameKey)) cardsBySet.set(nameKey, []);
    cardsBySet.get(nameKey)!.push(c);

    if (c.ppt_set_id) {
      const codeKey = normalize(c.ppt_set_id);
      if (!cardsByCode.has(codeKey)) cardsByCode.set(codeKey, []);
      cardsByCode.get(codeKey)!.push(c);
    }
  }

  let mappedCount = 0;
  let imageBackfilledCount = 0;

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const groupNorm = normalize(group.name);
    const abbrNorm = group.abbreviation ? normalize(group.abbreviation) : '';

    // Find matching DB set
    let matchingSetCards: DbCard[] | undefined;

    // 1. Try match by set code/abbreviation (e.g. M1L, M2, M3, MC)
    if (abbrNorm && cardsByCode.has(abbrNorm)) {
      matchingSetCards = cardsByCode.get(abbrNorm);
    } else {
      for (const [codeKey, setCardsList] of cardsByCode.entries()) {
        if (codeKey.length >= 2 && (groupNorm.startsWith(codeKey) || abbrNorm === codeKey)) {
          matchingSetCards = setCardsList;
          break;
        }
      }
    }

    // 2. Try match by name
    if (!matchingSetCards) {
      for (const [setKey, setCardsList] of cardsBySet.entries()) {
        if (
          groupNorm.includes(setKey) ||
          setKey.includes(groupNorm) ||
          (abbrNorm && abbrNorm === setKey)
        ) {
          matchingSetCards = setCardsList;
          break;
        }
      }
    }

    if (!matchingSetCards || matchingSetCards.length === 0) {
      continue;
    }

    // Fetch products for this group
    try {
      const prodRes = await fetch(`https://tcgcsv.com/tcgplayer/85/${group.groupId}/products`, {
        headers: { 'User-Agent': 'curl/8.4.0' },
      });
      if (!prodRes.ok) continue;

      const prodData = await prodRes.json();
      const products: TcgProduct[] = prodData.results || [];

      for (const p of products) {
        const pNum = p.extendedData?.find((e) => e.name === 'Number')?.value;
        const pNameNorm = normalize(p.cleanName || p.name);

        // Find match in matchingSetCards
        const matched = matchingSetCards.find((c) => {
          const cNum = c.number.split('/')[0].replace(/^0+/, '');
          if (pNum) {
            const rawPNum = pNum.split('/')[0].replace(/^0+/, '');
            if (cNum === rawPNum) return true;
          }
          const cNameNorm = normalize(c.name);
          return pNameNorm.includes(cNameNorm) || cNameNorm.includes(pNameNorm);
        });

        if (matched) {
          const updates: string[] = [];
          const params: any[] = [matched.id];

          if (!matched.tcg_player_id || matched.tcg_player_id !== p.productId.toString()) {
            params.push(p.productId.toString());
            updates.push(`tcg_player_id = $${params.length}`);
            mappedCount++;
          }

          // Always prefer crisp 400w high-res image
          const highResImageUrl = p.imageUrl ? p.imageUrl.replace('_200w.jpg', '_400w.jpg') : null;

          if (highResImageUrl && (!matched.image_url || matched.image_url.includes('404') || matched.image_url === '' || matched.image_url.includes('_200w.jpg'))) {
            params.push(highResImageUrl);
            updates.push(`image_url = $${params.length}`);
            imageBackfilledCount++;
          }

          if (updates.length > 0) {
            await dbQuery(`
              UPDATE cards
              SET ${updates.join(', ')}
              WHERE id = $1
            `, params);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing group ${group.groupId} (${group.name}):`, err);
    }
  }

  console.log(`\n========================================`);
  console.log(`[Pokemon JA Mapper] Successfully mapped ${mappedCount} Japanese cards to TCGPlayer IDs.`);
  console.log(`[Pokemon JA Mapper] Backfilled ${imageBackfilledCount} missing high-res images.`);
  console.log(`========================================\n`);
}

mapPokemonJaTcgPlayer()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
