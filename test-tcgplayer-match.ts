import { fetchEnglishPrice } from './scripts/price-engine/tcgcsv';

async function run() {
  const groups = await fetch('https://tcgcsv.com/tcgplayer/68/groups', { headers: { 'User-Agent': 'curl/8.4.0' } }).then(res => res.json());
  const op05Group = groups.results.find(g => g.abbreviation === 'OP05');
  const products = await fetch(`https://tcgcsv.com/tcgplayer/68/${op05Group.groupId}/products`, { headers: { 'User-Agent': 'curl/8.4.0' } }).then(res => res.json());
  
  const op05119 = products.results.filter(p => p.extendedData?.find(d => d.name === 'Number' && d.value === 'OP05-119'));
  console.log(JSON.stringify(op05119.map(p => p.name), null, 2));
}
run();
