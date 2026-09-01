import { fetchSnkrdunkPrice } from './lib/price-engine/snkrdunk';

async function run() {
  const url = 'https://snkrdunk.com/en/trading-cards/159664?slide=right&query_id=1d219cb2-4a65-4c8f-9827-33d622a03269';
  const res = await fetchSnkrdunkPrice(url);
  console.log(JSON.stringify(res, null, 2));
}
run();
