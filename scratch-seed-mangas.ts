import { dbQuery } from './lib/db/client';
import crypto from 'crypto';

const MANGA_LIST = [
  { slug: 'op-op01-120_p2-ja', name: 'Shanks (Manga Alternate Art)', set_slug: 'op-op-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/93520' },
  { slug: 'op-op01-120_r2-ja', name: 'Shanks (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332159' },
  { slug: 'op-op02-013_p2-ja', name: 'Portgas.D.Ace (Manga Alternate Art)', set_slug: 'op-op-02', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/102434' },
  { slug: 'op-op02-013_r1-ja', name: 'Portgas.D.Ace (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332160' },
  { slug: 'op-op03-122_p2-ja', name: 'Sogeking (Manga Alternate Art)', set_slug: 'op-op-03', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/112979' },
  { slug: 'op-op03-122_r1-ja', name: 'Sogeking (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332162' },
  { slug: 'op-op04-083_p2-ja', name: 'Sabo (Manga Alternate Art)', set_slug: 'op-op-04', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/126134' },
  { slug: 'op-op04-083_r1-ja', name: 'Sabo (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332161' },
  { slug: 'op-op05-119_p2-ja', name: 'Monkey.D.Luffy (Manga Alternate Art)', set_slug: 'op-op-05', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/135439' },
  { slug: 'op-op05-119_r2-ja', name: 'Monkey.D.Luffy (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332165' },
  { slug: 'op-op05-069_p2-ja', name: 'Trafalgar Law (Manga Alternate Art)', set_slug: 'op-op-05', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/135449' },
  { slug: 'op-op05-069_r1-ja', name: 'Trafalgar Law (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332166' },
  { slug: 'op-op05-074_p2-ja', name: 'Eustass"Captain"Kid (Manga Alternate Art)', set_slug: 'op-op-05', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/135425' },
  { slug: 'op-op05-074_r2-ja', name: 'Eustass"Captain"Kid (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332164' },
  { slug: 'op-op06-118_p2-ja', name: 'Roronoa Zoro (Manga Alternate Art)', set_slug: 'op-op-06', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/159664' },
  { slug: 'op-eb01-006_p2-ja', name: 'Tony Tony.Chopper (Manga Alternate Art)', set_slug: 'op-eb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/184326' },
  { slug: 'op-eb01-006_r1-ja', name: 'Tony Tony.Chopper (Manga Alternate Art)', set_slug: 'op-prb-01', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/332167' },
  { slug: 'op-op07-051_p2-ja', name: 'Boa Hancock (Manga Alternate Art)', set_slug: 'op-op-07', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/198723' },
  { slug: 'op-op08-118_p2-ja', name: 'Silvers Rayleigh (Manga Alternate Art)', set_slug: 'op-op-08', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/265745' },
  { slug: 'op-op09-119_p2-ja', name: 'Monkey.D.Luffy (Manga Alternate Art)', set_slug: 'op-op-09', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/349475' },
  { slug: 'op-op09-093_p2-ja', name: 'Buggy (Manga Alternate Art)', set_slug: 'op-op-09', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/349441' },
  { slug: 'op-op09-004_p2-ja', name: 'Shanks (Manga Alternate Art)', set_slug: 'op-op-09', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/349418' },
  { slug: 'op-op09-051_p2-ja', name: 'Marshall.D.Teach (Manga Alternate Art)', set_slug: 'op-op-09', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/349460' },
  { slug: 'op-op09-118_p2-ja', name: 'Gol.D.Roger (Manga Alternate Art)', set_slug: 'op-op-09', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/349472' },
  { slug: 'op-op10-119_p2-ja', name: 'Trafalgar Law (Manga Alternate Art)', set_slug: 'op-op-10', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/442287' },
  { slug: 'op-eb02-061_p2-ja', name: 'Monkey.D.Luffy (Manga Alternate Art)', set_slug: 'op-eb-02', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/503507' },
  { slug: 'op-op11-118_p2-ja', name: 'Monkey.D.Luffy (Manga Alternate Art)', set_slug: 'op-op-11', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/519929' },
  { slug: 'op-op12-118_p2-ja', name: 'Jewelry Bonney (Manga Alternate Art)', set_slug: 'op-op-12', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/588855' },
  { slug: 'op-op06-119_p3-ja', name: 'Sanji (Manga Alternate Art)', set_slug: 'op-prb-02', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/653291' },
  { slug: 'op-op13-119_p3-ja', name: 'Monkey.D.Luffy (Red Manga Alternate Art)', set_slug: 'op-op-13', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/676003' },
  { slug: 'op-op13-119_p1-ja', name: 'Monkey.D.Luffy (Manga Alternate Art)', set_slug: 'op-op-13', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/676002' },
  { slug: 'op-op13-120_p3-ja', name: 'Sabo (Red Manga Alternate Art)', set_slug: 'op-op-13', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/676007' },
  { slug: 'op-op13-120_p2-ja', name: 'Sabo (Manga Alternate Art)', set_slug: 'op-op-13', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/676006' },
  { slug: 'op-op13-118_p3-ja', name: 'Portgas.D.Ace (Red Manga Alternate Art)', set_slug: 'op-op-13', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/676005' },
  { slug: 'op-op13-118_p2-ja', name: 'Portgas.D.Ace (Manga Alternate Art)', set_slug: 'op-op-13', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/676004' },
  { slug: 'op-op14-119_p2-ja', name: 'Dracule Mihawk (Manga Alternate Art)', set_slug: 'op-op-14', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/728159' },
  { slug: 'op-op15-118_p2-ja', name: 'Enel (Manga Alternate Art)', set_slug: 'op-op-15', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/764635' },
  { slug: 'op-eb03-uta_p2-ja', name: 'Uta (Manga Alternate Art)', set_slug: 'op-eb-03', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/714426' },
  { slug: 'op-eb04-koby_p2-ja', name: 'Koby (Manga Alternate Art)', set_slug: 'op-eb-04', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/751303' },
  { slug: 'op-op16-065_p2-ja', name: 'Sakazuki (Manga Alternate Art)', set_slug: 'op-op-16', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/822602' },
  { slug: 'op-op16-073_p2-ja', name: 'Borsalino (Manga Alternate Art)', set_slug: 'op-op-16', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/822604' },
  { slug: 'op-op16-063_p2-ja', name: 'Kuzan (Manga Alternate Art)', set_slug: 'op-op-16', snkrdunk_url: 'https://snkrdunk.com/en/trading-cards/822600' }
];

async function main() {
  const sets = await dbQuery("SELECT id, slug FROM sets");
  const setMap = new Map();
  for (const s of sets) setMap.set(s.slug, s.id);

  for (const item of MANGA_LIST) {
    const setId = setMap.get(item.set_slug);
    if (!setId) {
      console.log(`[WARNING] Set ${item.set_slug} not found for ${item.slug}, skipping create`);
      continue;
    }

    const cards = await dbQuery(`SELECT id FROM cards WHERE slug = $1`, [item.slug]);
    let cardId;
    if (cards.length === 0) {
      console.log(`Creating missing manga card: ${item.slug}`);
      cardId = crypto.randomUUID();
      // Extract number from slug (e.g. op-eb03-uta_p2-ja -> uta, or op-op01-120_p2 -> 120)
      const slugParts = item.slug.split('-');
      const number = slugParts.length > 2 ? slugParts[2].split('_')[0] : '000';
      await dbQuery(`
        INSERT INTO cards (id, set_id, slug, name, number, rarity, curation_status, snkrdunk_fetched, pc_fetched)
        VALUES ($1, $2, $3, $4, $5, 'SecretRare', 'pending', false, false)
      `, [cardId, setId, item.slug, item.name, number]);
    } else {
      cardId = cards[0].id;
    }

    await dbQuery(`
      UPDATE cards 
      SET snkrdunk_url = $1, snkrdunk_fetched = FALSE
      WHERE id = $2
    `, [item.snkrdunk_url, cardId]);
    console.log(`Mapped Snkrdunk URL for ${item.slug}`);
  }
  
  console.log("All mangas seeded and mapped!");
  process.exit(0);
}
main().catch(console.error);
