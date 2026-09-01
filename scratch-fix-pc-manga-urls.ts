import { dbQuery } from './lib/db/client';

const MANGA_SLUGS = [
  'op-op01-120_p2-ja', 'op-op01-120_r2-ja', 'op-op02-013_p2-ja', 'op-op02-013_r1-ja',
  'op-op03-122_p2-ja', 'op-op03-122_r1-ja', 'op-op04-083_p2-ja', 'op-op04-083_r1-ja',
  'op-op05-119_p2-ja', 'op-op05-119_r2-ja', 'op-op05-069_p2-ja', 'op-op05-069_r1-ja',
  'op-op05-074_p2-ja', 'op-op05-074_r2-ja', 'op-op06-118_p2-ja', 'op-eb01-006_p2-ja',
  'op-eb01-006_r1-ja', 'op-op07-051_p2-ja', 'op-op08-118_p2-ja', 'op-op09-119_p2-ja',
  'op-op09-093_p2-ja', 'op-op09-004_p2-ja', 'op-op09-051_p2-ja', 'op-op09-118_p2-ja',
  'op-op10-119_p2-ja', 'op-eb02-061_p2-ja', 'op-op11-118_p2-ja', 'op-op12-118_p2-ja',
  'op-op06-119_p3-ja', 'op-op13-119_p3-ja', 'op-op13-119_p1-ja', 'op-op13-120_p3-ja',
  'op-op13-120_p2-ja', 'op-op13-118_p3-ja', 'op-op13-118_p2-ja', 'op-op14-119_p2-ja',
  'op-op15-118_p2-ja', 'op-eb03-uta_p2-ja', 'op-eb04-koby_p2-ja', 'op-op16-065_p2-ja',
  'op-op16-073_p2-ja', 'op-op16-063_p2-ja'
];

const PC_SET_NAMES: Record<string, string> = {
  'op01': 'romance-dawn',
  'op02': 'paramount-war',
  'op03': 'pillars-of-strength',
  'op04': 'kingdoms-of-intrigue',
  'op05': 'awakening-of-the-new-era',
  'op06': 'wings-of-the-captain',
  'op07': '500-years-in-the-future',
  'op08': 'two-legends',
  'op09': 'the-new-emperor',
  'op10': 'royal-bloodline',
  'eb01': 'memorial-collection',
  'eb02': 'extra-booster-2',
  'eb03': 'extra-booster-3',
  'eb04': 'extra-booster-4',
  'prb01': 'premium-booster'
};

const NAME_MAP: Record<string, string> = {
  'Monkey.D.Luffy': 'monkey-d-luffy',
  'Roronoa Zoro': 'roronoa-zoro',
  'Sanji': 'sanji',
  'Nami': 'nami',
  'Usopp': 'usopp',
  'Tony Tony.Chopper': 'tony-tony-chopper',
  'Nico Robin': 'nico-robin',
  'Franky': 'franky',
  'Brook': 'brook',
  'Jinbe': 'jinbe',
  'Shanks': 'shanks',
  'Portgas.D.Ace': 'portgas-d-ace',
  'Trafalgar Law': 'trafalgar-law',
  'Eustass Kid': 'eustass-kid',
  'Sogeking': 'sogeking',
  'Sabo': 'sabo',
  'Kouzuki Oden': 'kouzuki-oden',
  'Boa Hancock': 'boa-hancock',
  'Dracule Mihawk': 'dracule-mihawk',
  'Buggy': 'buggy',
  'Vivi': 'vivi',
  'Nefeltari Vivi': 'nefeltari-vivi',
  'Uta': 'uta',
  'Koby': 'koby',
  'Tony Tony Chopper': 'tony-tony-chopper',
  'Tonytony Chopper': 'tony-tony-chopper',
};

async function verifyUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

function formatName(name: string): string {
  if (NAME_MAP[name]) return NAME_MAP[name];
  return name.toLowerCase().replace(/[.\s]+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function fixCard(card: any) {
  const parts = card.number.toLowerCase().split('-'); 
  const setPrefix = parts[0]; 
  const setName = PC_SET_NAMES[setPrefix];
  if (!setName) {
    console.log(`❌ ${card.slug}: Unknown set prefix ${setPrefix}`);
    return;
  }

  const charSlug = formatName(card.name || '');
  const cardNumber = card.number.toLowerCase();
  
  const patterns = [
    `${charSlug}-alternate-art-manga-${cardNumber}`,
    `${charSlug}-manga-alternate-art-${cardNumber}`,
    `${charSlug}-comic-parallel-${cardNumber}`,
    `${charSlug}-parallel-${cardNumber}`,
    `${charSlug}-${cardNumber}`
  ];

  let foundUrl = null;

  for (const pattern of patterns) {
    const testUrl = `https://www.pricecharting.com/game/one-piece-japanese-${setName}/${pattern}`;
    if (await verifyUrl(testUrl)) {
      foundUrl = testUrl;
      break;
    }
  }

  if (foundUrl) {
    if (card.pricecharting_url !== foundUrl) {
      console.log(`✅ FOUND NEW URL for ${card.slug}: ${foundUrl}`);
      
      await dbQuery(`
        INSERT INTO price_quarantine (card_id, source, grade, grading_company_id, price, currency, recorded_at, quarantine_reason, quarantined_at)
        SELECT card_id, source, grade, grading_company_id, price, currency, recorded_at, 'manual-mapping-correction', NOW()
        FROM price_history
        WHERE card_id = $1 AND source = 'pricecharting'
      `, [card.id]);
      
      await dbQuery(`
        DELETE FROM price_history
        WHERE card_id = $1 AND source = 'pricecharting'
      `, [card.id]);

      await dbQuery(`
        UPDATE cards 
        SET pricecharting_url = $1, pc_fetched = FALSE
        WHERE id = $2
      `, [foundUrl, card.id]);
      
      console.log(`   -> Quarantined and updated!`);
    } else {
      console.log(`- ${card.slug} already correct: ${foundUrl}`);
    }
  } else {
    console.log(`❌ FAILED to predict URL for ${card.slug} (${card.name})`);
  }
}

async function main() {
  const cards = await dbQuery("SELECT id, slug, name, number, pricecharting_url FROM cards WHERE slug = ANY($1::text[])", [MANGA_SLUGS]);
  console.log(`Found ${cards.length} cards. Beginning verification...`);
  
  for (const card of cards) {
    await fixCard(card);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.exit(0);
}

main();
