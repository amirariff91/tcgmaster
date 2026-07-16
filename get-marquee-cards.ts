import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function run() {
  console.log("Fetching OP cards...");
  const { data: opCards } = await supabase
    .from('cards')
    .select('name, slug, image_url')
    .ilike('slug', 'op-%')
    .like('slug', '%_%')
    .not('slug', 'like', '%-ja')
    .limit(300);
    
  if (opCards) {
    const selected = opCards.filter(c => 
      (c.name.toLowerCase().includes('luffy') || c.name.toLowerCase().includes('zoro') || c.name.toLowerCase().includes('nami') || c.name.toLowerCase().includes('uta')) && 
      (c.slug.includes('_p') || c.slug.includes('_r'))
    ).slice(0, 15);
    console.log("OP Cards:", selected.map(c => c.image_url));
  }

  console.log("Fetching DBFW cards...");
  const { data: dbCards } = await supabase
    .from('cards')
    .select('name, slug, image_url, tcg_player_id')
    .ilike('slug', 'dbfw%')
    .limit(100);
    
  if (dbCards) {
    // just pick some DB cards, preferably variants
    const selected = dbCards.filter(c => c.slug.includes('_')).slice(0, 5);
    if (selected.length === 0) {
      console.log("DBFW Cards (fallback):", dbCards.slice(0, 5).map(c => c.image_url));
    } else {
      console.log("DBFW Cards:", selected.map(c => c.image_url));
    }
  }
}
run();
