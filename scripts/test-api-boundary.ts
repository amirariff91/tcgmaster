import { searchCards } from '../lib/search/service';

async function test() {
  const result = await searchCards('', { sort: 'price-desc', page: 1, pageSize: 12000 });
  
  const total = result.results.length;
  const complete = result.results.filter(c => c.imageUrl).length;
  const incomplete = result.results.filter(c => !c.imageUrl).length;
  
  console.log("Total Fetched:", total);
  console.log("Complete in Fetch:", complete);
  console.log("Incomplete in Fetch:", incomplete);
  
  // Verify order: find first incomplete
  const firstIncompleteIdx = result.results.findIndex(c => !c.imageUrl);
  if (firstIncompleteIdx !== -1) {
    // Check if any complete cards exist AFTER the first incomplete card
    const badOrdering = result.results.slice(firstIncompleteIdx).some(c => !!c.imageUrl);
    console.log("Is ordering correct (complete always before incomplete)?", !badOrdering);
  } else {
    console.log("No incomplete cards fetched");
  }
}
test();
