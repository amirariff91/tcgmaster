import { dbQuery } from '../lib/db/client';
import 'dotenv/config';

const VERIFIED_URLS: Record<string, string> = {
  'op-op09-004_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-emperors-in-the-new-world/shanks-manga-op09-004',
  'op-op09-051_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-emperors-in-the-new-world/buggy-alternate-art-manga-op09-051',
  'op-op09-093_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-emperors-in-the-new-world/marshalldteach-manga-op09-093',
  'op-op09-118_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-emperors-in-the-new-world/goldroger-manga-op09-118',
  'op-op09-119_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-emperors-in-the-new-world/monkeydluffy-manga-op09-119',
  'op-op10-119_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-royal-blood/trafalgar-law-manga-alternate-art-op10-119',
  'op-op11-118_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-fist-of-divine-speed/monkeydluffy-manga-op11-118',
  'op-op13-118_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-carrying-on-his-will/monkeydluffy-manga-op13-118',
  'op-op13-120_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-carrying-on-his-will/sabo-manga-op13-120',
  'op-op16-065_p2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-the-time-of-battle/sakazuki-manga-op16-065',
  'op-op03-122_r1-ja': 'https://www.pricecharting.com/game/one-piece-japanese-pillars-of-strength/sogeking-manga-foil-prb01-op03-122',
  'op-op04-083_r1-ja': 'https://www.pricecharting.com/game/one-piece-kingdoms-of-intrigue/sabo-alternate-art-manga-prb01-op04-083',
  'op-op05-074_r2-ja': 'https://www.pricecharting.com/game/one-piece-japanese-awakening-of-the-new-era/eustasscaptainkid-alternate-art-prb01-op05-074',
  'op-op05-069_r1-ja': 'https://www.pricecharting.com/game/one-piece-awakening-of-the-new-era/trafalgar-law-manga-prb01-op05-069',
  'op-eb01-006_r1-ja': 'https://www.pricecharting.com/game/one-piece-japanese-extra-booster-memorial-collection/tony-tonychopper-manga-prb01-eb01-006'
};

async function updateUrls() {
  for (const [slug, url] of Object.entries(VERIFIED_URLS)) {
    await dbQuery(`
      UPDATE cards 
      SET pricecharting_url = $1, pc_fetched = FALSE 
      WHERE slug = $2
    `, [url, slug]);
    console.log(`Updated ${slug} -> ${url}`);
  }
}
updateUrls().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
