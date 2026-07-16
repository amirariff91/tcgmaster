import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Need service role key to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const newGames = [
  {
    name: 'one-piece',
    slug: 'one-piece',
    display_name: 'One Piece TCG',
    icon: '/icons/one-piece.svg',
    is_active: true,
  },
  {
    name: 'dbfw',
    slug: 'dbfw',
    display_name: 'Dragon Ball Fusion World',
    icon: '/icons/dragon-ball.svg',
    is_active: true,
  },
];

async function seedGames() {
  console.log('Inserting new games into Supabase...');

  for (const game of newGames) {
    // Check if it already exists
    const { data: existing } = await supabase
      .from('games')
      .select('id')
      .eq('slug', game.slug)
      .single();

    if (existing) {
      console.log(`Game ${game.display_name} already exists. Skipping.`);
      continue;
    }

    const { data, error } = await supabase
      .from('games')
      .insert(game)
      .select()
      .single();

    if (error) {
      console.error(`Failed to insert ${game.display_name}:`, error.message);
    } else {
      console.log(`Successfully inserted ${game.display_name}! (ID: ${data.id})`);
    }
  }

  console.log('Seeding complete!');
}

seedGames().catch(console.error);
