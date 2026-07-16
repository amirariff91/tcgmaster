import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Service role key

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.log("Wiping Japanese Cards...");
  const { data: deletedCards, error: cardsError } = await supabase
    .from('cards')
    .delete()
    .ilike('slug', '%-ja')
    .select('id');
    
  if (cardsError) {
    console.error("Error wiping cards:", cardsError);
  } else {
    console.log(`Wiped ${deletedCards?.length || 0} Japanese cards.`);
  }
  
  console.log("Wiping Japanese Sets...");
  // Japanese sets were inserted with slugs like 'op-550101'
  const { data: deletedSets, error: setsError } = await supabase
    .from('sets')
    .delete()
    .ilike('slug', 'op-550%')
    .select('id');
    
  if (setsError) {
    console.error("Error wiping sets:", setsError);
  } else {
    console.log(`Wiped ${deletedSets?.length || 0} Japanese sets.`);
  }
}
run();
