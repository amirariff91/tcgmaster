import { searchCards } from '../lib/search/service';

async function test() {
  const result = await searchCards('', { sort: 'price-desc', page: 1, pageSize: 5 });
  console.log("Total Count:", result.totalCount);
  console.log("Page Size:", result.pageSize);
  console.log("First card:", result.results[0].name, "hasImage:", !!result.results[0].imageUrl);
}
test();
