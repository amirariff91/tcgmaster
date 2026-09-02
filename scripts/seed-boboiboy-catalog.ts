import 'dotenv/config';
import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface PackMeta {
  id: number;
  slug: string;
  name: string;
  releaseDate: string;
}

const PACKS: PackMeta[] = [
  { id: 1, slug: 'boboiboy-pek-adiwira', name: 'Pek Adiwira', releaseDate: '2019-01-01' },
  { id: 2, slug: 'boboiboy-pek-lagenda', name: 'Pek Lagenda', releaseDate: '2019-06-01' },
  { id: 3, slug: 'boboiboy-pek-unggul', name: 'Pek Unggul', releaseDate: '2019-12-01' },
  { id: 4, slug: 'boboiboy-pek-elemental', name: 'Pek Elemental', releaseDate: '2020-06-01' },
  { id: 6, slug: 'boboiboy-pek-fusion', name: 'Pek Fusion', releaseDate: '2021-01-01' },
  { id: 7, slug: 'boboiboy-pek-versus', name: 'Pek Versus', releaseDate: '2021-08-01' },
  { id: 8, slug: 'boboiboy-pek-impak', name: 'Pek Impak', releaseDate: '2022-03-01' },
  { id: 9, slug: 'boboiboy-pek-beyond', name: 'Pek Beyond', releaseDate: '2022-10-01' },
  { id: 10, slug: 'boboiboy-pek-vortex', name: 'Pek Vortex', releaseDate: '2023-05-01' },
  { id: 11, slug: 'boboiboy-pek-rumble', name: 'Pek Rumble', releaseDate: '2023-11-01' },
  { id: 12, slug: 'boboiboy-pek-satria', name: 'Pek Satria', releaseDate: '2024-04-01' },
  { id: 13, slug: 'boboiboy-pek-quest', name: 'Pek Quest', releaseDate: '2024-11-01' },
];

function sanitizeUrlToken(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeCardDetails(cardId: number): Promise<{
  name: string;
  imageUrl: string | null;
  hp: string | null;
  atk: string | null;
  stars: number;
  effect: string | null;
} | null> {
  try {
    const res = await fetch(`https://www.boboiboygc.com/card/id=${cardId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/property="og:title"\s+content="([^"]+)"/)?.[1];
    if (!titleMatch || titleMatch.includes('404')) return null;

    let rawName = titleMatch.replace(/^BoBoiBoy Galaxy Card\s*-\s*/i, '').trim();
    rawName = rawName.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    let imageUrl = html.match(/property="og:image"\s+content="([^"]+)"/)?.[1] || null;
    if (imageUrl && imageUrl.startsWith('http://')) {
      imageUrl = imageUrl.replace('http://', 'https://');
    }

    const hp = html.match(/<span id="hp">(\d+)<\/span>/)?.[1] || null;
    const atk = html.match(/<span id="atk">(\d+)<\/span>/)?.[1] || null;

    const starsMatch = html.match(/data-stars="(\d+)"/)?.[1];
    const stars = starsMatch ? parseInt(starsMatch, 10) : 1;

    let effect = html.match(/class="card-body">\s*<p class="card-text">([\s\S]*?)<\/p>/)?.[1] || null;
    if (effect) {
      effect = effect.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    return {
      name: rawName,
      imageUrl,
      hp,
      atk,
      stars,
      effect,
    };
  } catch (err) {
    return null;
  }
}

async function seedBoboiboyCatalog() {
  console.log('[BoBoiBoy Seeder] 1. Upserting BoBoiBoy game record...');

  const gameRows = await dbQuery<{ id: string }>(`
    INSERT INTO games (name, slug, display_name, icon, is_active)
    VALUES ('boboiboy', 'boboiboy', 'BoBoiBoy Galaxy Card', '/icons/boboiboy.svg', true)
    ON CONFLICT (slug) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      is_active = EXCLUDED.is_active
    RETURNING id
  `);
  const gameId = gameRows[0].id;
  console.log(`[BoBoiBoy Seeder] Game ID: ${gameId}`);

  let totalCardsIngested = 0;

  for (const pack of PACKS) {
    console.log(`\n========================================`);
    console.log(`[BoBoiBoy Seeder] Processing Pack: "${pack.name}" (ID ${pack.id})...`);
    console.log(`========================================`);

    // 1. Fetch pack page to get card IDs
    const packRes = await fetch(`https://www.boboiboygc.com/pack/id=${pack.id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (!packRes.ok) {
      console.warn(`[BoBoiBoy Seeder] Could not load pack ${pack.id}`);
      continue;
    }
    const packHtml = await packRes.text();

    const matches = packHtml.match(/\/card\/id=\d+/g) || [];
    const cardIds = [...new Set(matches.map((m) => parseInt(m.replace('/card/id=', ''), 10)))];

    console.log(`[BoBoiBoy Seeder] Found ${cardIds.length} card references in ${pack.name}.`);

    // 2. Upsert Set record
    const setRows = await dbQuery<{ id: string }>(`
      INSERT INTO sets (game_id, name, slug, release_date, card_count)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (game_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        release_date = EXCLUDED.release_date,
        card_count = EXCLUDED.card_count
      RETURNING id
    `, [
      gameId,
      pack.name,
      pack.slug,
      new Date(pack.releaseDate).toISOString(),
      cardIds.length,
    ]);
    const setId = setRows[0].id;

    // 3. Ingest each card
    let packCardIndex = 1;
    for (const cardId of cardIds) {
      const details = await scrapeCardDetails(cardId);
      if (!details) continue;

      const cardNum = packCardIndex.toString().padStart(3, '0');
      const cardSlug = `${pack.slug}-${cardNum}-${sanitizeUrlToken(details.name)}`;

      const rarityLabel =
        details.stars === 5
          ? 'Ultra Rare'
          : details.stars === 4
            ? 'Super Rare'
            : details.stars === 3
              ? 'Rare'
              : details.stars === 2
                ? 'Uncommon'
                : 'Common';

      await dbQuery(`
        INSERT INTO cards (
          set_id,
          name,
          slug,
          number,
          rarity,
          image_url,
          description
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (set_id, slug) DO UPDATE SET
          name = EXCLUDED.name,
          number = EXCLUDED.number,
          rarity = EXCLUDED.rarity,
          image_url = EXCLUDED.image_url,
          description = EXCLUDED.description
      `, [
        setId,
        details.name,
        cardSlug,
        cardNum,
        rarityLabel,
        details.imageUrl,
        details.effect,
      ]);

      packCardIndex++;
      totalCardsIngested++;
    }

    console.log(`[BoBoiBoy Seeder] Completed ${pack.name}: ${packCardIndex - 1} cards ingested.`);
  }

  console.log(`\n========================================`);
  console.log(`[BoBoiBoy Seeder] Ingested a total of ${totalCardsIngested} BoBoiBoy cards!`);
  console.log(`========================================\n`);

  // Flush Redis caches
  const setKeys = await redis.keys('api:sets:*');
  for (const k of setKeys) await redis.del(k);
  const searchKeys = await redis.keys('search:*');
  for (const k of searchKeys) await redis.del(k);
  await redis.del('api:search:trending');
  console.log('[BoBoiBoy Seeder] Flushed Redis sets and search caches.');
}

seedBoboiboyCatalog()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
