import { dbQuery } from './lib/db/client';
async function run() {
  const cards = await dbQuery("SELECT id, slug, name, snkrdunk_url, pricecharting_url, yuyutei_url, cardrush_url FROM cards WHERE slug = 'op-op06-118_p2-ja';");
  console.log('Cards:', cards);
  if (cards.length > 0) {
     const history = await dbQuery("SELECT count(*) as count, min(created_at) as min_date, max(created_at) as max_date, source FROM price_history WHERE card_id = $1 GROUP BY source", [cards[0].id]);
     console.log('History:', history);
  }
}
run();
