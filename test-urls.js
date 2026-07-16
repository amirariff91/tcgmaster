require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: rawCards } = await supabase
    .from('cards')
    .select('id, name, image_url, local_image_url, slug, rarity')
    .not('image_url', 'is', null)
    .or('slug.ilike.op-%,slug.ilike.dbfw-%')
    .limit(1000);

  const filteredCards = (rawCards || []).filter(card => {
    const slug = card.slug || '';
    const rarity = (card.rarity || '').toLowerCase();
    const name = (card.name || '').toLowerCase();
    const isOP = slug.startsWith('op-');
    const isDB = slug.startsWith('dbfw-');
    if (isOP) {
      return rarity.includes('sp') || rarity.includes('sec') || name.includes('manga') || name.includes('tournament') || name.includes('wanted');
    }
    if (isDB) {
      return rarity.includes('scr') || rarity.includes('sec');
    }
    return false;
  });

  console.log('Filtered cards count:', filteredCards.length);
  if (filteredCards.length > 0) {
    console.log('Sample image URLs:');
    filteredCards.slice(0, 10).forEach(c => console.log(c.slug, c.image_url));
  }
}
run();
