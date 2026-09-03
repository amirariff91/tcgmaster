import { dbQuery, pool } from '../lib/db/client';
import { redis } from '../lib/redis/client';

interface CategoryConfig {
  catId: string;
  setSlug: string;
  name: string;
}

const CATEGORIES: CategoryConfig[] = [
  // Main Boosters
  { catId: '584005', setSlug: 'dbfw-fb05', name: 'New Adventure [FB05]' },
  { catId: '584006', setSlug: 'dbfw-fb06', name: 'Rivals Clash [FB06]' },
  { catId: '584007', setSlug: 'dbfw-fb07', name: 'Wish for Shenron [FB07]' },
  { catId: '584008', setSlug: 'dbfw-fb08', name: 'Saiyan’s Pride [FB08]' },
  { catId: '584009', setSlug: 'dbfw-fb09', name: 'Dual Evolution [FB09]' },
  { catId: '584010', setSlug: 'dbfw-fb10', name: 'Cross Force [FB10]' },
  // Manga Boosters
  { catId: '584201', setSlug: 'dbfw-sb01', name: 'Manga Booster 01 [SB01]' },
  { catId: '584202', setSlug: 'dbfw-sb02', name: 'Manga Booster 02 [SB02]' },
  // Starter Decks
  { catId: '584106', setSlug: 'dbfw-fs06', name: 'Starter Deck: Son Goku (Mini) [FS06]' },
  { catId: '584107', setSlug: 'dbfw-fs07', name: 'Starter Deck: Vegeta (Mini) [FS07]' },
  { catId: '584108', setSlug: 'dbfw-fs08', name: 'Starter Deck: Vegeta (Mini) SS3 [FS08]' },
  { catId: '584109', setSlug: 'dbfw-fs09', name: 'Starter Deck EX Shallot [FS09]' },
  { catId: '584110', setSlug: 'dbfw-fs10', name: 'Starter Deck EX Giblet [FS10]' },
  { catId: '584111', setSlug: 'dbfw-fs11', name: 'Starter Deck EX The Phase of Evolution [FS11]' },
  { catId: '584112', setSlug: 'dbfw-fs12', name: 'Starter Deck EX The Beat of Ki [FS12]' },
  // Promotions
  { catId: '584901', setSlug: 'dbfw-promo', name: 'Promo Cards' },
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeCategory(cat: CategoryConfig) {
  console.log(`\n======================================================`);
  console.log(`Processing: ${cat.name} (${cat.setSlug}) - Category ID: ${cat.catId}`);
  console.log(`======================================================`);

  // Find set in database
  const setRows = await dbQuery<{ id: string; card_count: number }>(`
    SELECT s.id, s.card_count
    FROM sets s
    JOIN games g ON s.game_id = g.id
    WHERE s.slug = $1 AND g.slug = $2
    LIMIT 1
  `, [cat.setSlug, 'dbfw']);

  if (setRows.length === 0) {
    console.error(`Set not found in database: ${cat.setSlug}`);
    return;
  }

  const setId = setRows[0].id;

  const url = `https://www.dbs-cardgame.com/fw/jp/cardlist/?search=true&category%5B%5D=${cat.catId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    console.error(`Failed to fetch ${url}: ${res.status}`);
    return;
  }

  const html = await res.text();

  // Extract all card items
  const cardRegex = /<li class="cardItem">[\s\S]*?data-src="detail\.php\?card_no=([^"&]+)(?:&p=([^"&]+))?"[\s\S]*?data-src="([^"]+)"[\s\S]*?alt="([^"]+)"/g;
  let match;
  let added = 0;
  let updated = 0;

  while ((match = cardRegex.exec(html)) !== null) {
    const rawCode = match[1];
    const pSuffix = match[2] || '';
    const fullCode = pSuffix ? `${rawCode}${pSuffix}` : rawCode;
    const relImg = match[3];
    const alt = match[4];
    const fullImg = relImg.startsWith('http') ? relImg : `https://www.dbs-cardgame.com/fw/${relImg.replace(/^\.\.\/\.\.\//, '')}`;
    const jaName = alt.replace(rawCode, '').trim();

    // Standardized slug format: dbfw-fb05-001-ja or dbfw-fb05-001_p1-ja
    const cleanNumber = fullCode.trim();
    const jaSlug = `dbfw-${cleanNumber.toLowerCase()}-ja`;

    // Try finding English counterpart to get English name and rarity
    const enCounterpart = await dbQuery<{ name: string; rarity: string }>(`
      SELECT c.name, c.rarity
      FROM cards c
      JOIN sets s ON c.set_id = s.id
      WHERE (c.number = $1 OR c.slug = $2)
        AND c.slug NOT LIKE '%-ja'
      LIMIT 1
    `, [cleanNumber, `dbfw-${cleanNumber.toLowerCase()}`]);

    const cardName = enCounterpart[0]?.name || jaName || cleanNumber;
    const rarity = enCounterpart[0]?.rarity || null;

    // Check if Japanese card already exists
    const existing = await dbQuery<{ id: string }>(`
      SELECT id FROM cards WHERE slug = $1 LIMIT 1
    `, [jaSlug]);

    if (existing.length > 0) {
      // Update image and metadata
      await dbQuery(`
        UPDATE cards
        SET image_url = $1,
            local_image_url = $1,
            name = $2,
            number = $3,
            rarity = COALESCE(rarity, $4),
            set_id = $5,
            updated_at = NOW()
        WHERE id = $6
      `, [fullImg, cardName, cleanNumber, rarity, setId, existing[0].id]);
      updated++;
    } else {
      // Insert new Japanese card
      await dbQuery(`
        INSERT INTO cards (
          set_id,
          name,
          slug,
          number,
          rarity,
          image_url,
          local_image_url,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $6, NOW(), NOW())
      `, [setId, cardName, jaSlug, cleanNumber, rarity, fullImg]);
      added++;
    }
  }

  console.log(`  -> Finished ${cat.name}: Added ${added} new, Updated ${updated} existing Japanese cards.`);
}

async function run() {
  console.log('=== STARTING OFFICIAL JAPANESE DRAGON BALL TCG INGESTION ===');

  for (const cat of CATEGORIES) {
    await scrapeCategory(cat);
    await delay(200); // Polite delay to Bandai servers
  }

  // Clear redis sets caches
  console.log('\nPurging API set caches in Redis...');
  const keys = await redis.keys('api:sets:dbfw*');
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log(`Deleted ${keys.length} cached set keys in Redis.`);
  }

  // Update card_count on sets
  console.log('\nUpdating total card counts on DBFW sets...');
  await dbQuery(`
    UPDATE sets s
    SET card_count = (
      SELECT COUNT(*)
      FROM cards c
      WHERE c.set_id = s.id
    )
    WHERE s.game_id = (SELECT id FROM games WHERE slug = 'dbfw')
  `);

  console.log('=== ALL JAPANESE DRAGON BALL TCG CARDS SUCCESSFULLY INGESTED! ===');
  pool.end();
}

run().catch(err => {
  console.error('Fatal error during ingestion:', err);
  pool.end();
  process.exit(1);
});
