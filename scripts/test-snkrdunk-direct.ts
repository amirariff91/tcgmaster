import { fetchSnkrdunkPrice } from './price-engine/snkrdunk';

async function test() {
  const query = 'OP01-120';
  console.log(`Testing snkrdunk fetch for ${query}...`);
  const result = await fetchSnkrdunkPrice(query, 'Romance Dawn');
  console.log(`Result: ${result}`);
}

test();
