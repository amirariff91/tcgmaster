import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const buildBaseQuery = (head: boolean = false) => {
    let q = supabase.from('cards').select(`
      id, name, image_url, price_cache_ttl,
      sets!inner ( games!inner ( slug ) )
    `, { count: 'exact', head });
    q = q.eq('sets.games.slug', 'one-piece');
    return q;
  };

  const { count: totalCount } = await buildBaseQuery(true);
  const { count: completeCount } = await buildBaseQuery(true).not('image_url', 'is', null);
  
  console.log("Total Count:", totalCount);
  console.log("Complete Count:", completeCount);

  // Test pagination at boundary
  const page = 321; // Assuming 20 per page, offset = 380. completeCount is 399
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  
  let completeCards = [];
  let incompleteCards = [];

  if (offset < completeCount) {
    const completeFetchSize = Math.min(pageSize, completeCount - offset);
    let q = buildBaseQuery().not('image_url', 'is', null).order('price_cache_ttl', { ascending: false, nullsFirst: false });
    q = q.range(offset, offset + completeFetchSize - 1);
    const { data } = await q;
    completeCards = data || [];
  }

  if (completeCards.length < pageSize) {
    const remainingSize = pageSize - completeCards.length;
    const incompleteOffset = Math.max(0, offset - completeCount);
    let q = buildBaseQuery().is('image_url', null).order('price_cache_ttl', { ascending: false, nullsFirst: false });
    q = q.range(incompleteOffset, incompleteOffset + remainingSize - 1);
    const { data } = await q;
    incompleteCards = data || [];
  }

  const finalCards = [...completeCards, ...incompleteCards];
  console.log(`Page ${page} Results:`, finalCards.length);
  console.log(`Complete in Page:`, completeCards.length);
  console.log(`Incomplete in Page:`, incompleteCards.length);
  if (finalCards.length > 0) {
    console.log("First card:", finalCards[0].name, "hasImage:", !!finalCards[0].image_url);
    console.log("Last card:", finalCards[finalCards.length - 1].name, "hasImage:", !!finalCards[finalCards.length - 1].image_url);
  }
}
run();
