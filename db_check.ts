import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://mquqwlxqrsvfflsgfhmi.supabase.co', 'sb_publishable_BtBRGcZWKeCUsmL_WsR67w_HbEK6CbH');

async function check() {
  console.log('--- GAMES ---');
  const { data: games, error: e1 } = await supabase.from('games').select('*');
  console.log(games, e1);

  console.log('\n--- CARDS COUNT PER GAME ---');
  if (games) {
    for (const game of games) {
      const { count, error: e2 } = await supabase.from('cards').select('*', { count: 'exact', head: true }).eq('game_id', game.id);
      console.log(`${game.name}: ${count} cards`, e2);
    }
  }
}

check();
