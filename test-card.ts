import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const slugs = [
    'op-op13-118_p4-ja', 'op-op09-093_p3-ja', 'op-op09-118_p3-ja', 'op-op09-004_p3-ja', 'op-op13-120_p4',
    'op-eb03-018_p2', 'op-eb03-003_p2', 'op-eb03-053_p2', 'op-eb03-026_p2', 'op-op07-051_p3-ja',
    'op-eb03-031_p2', 'op-eb02-061_p3-ja',
    'op-eb03-061_p2', 'op-op13-120_p2', 'op-op02-013_r1-ja',
    'op-op13-118_p3-ja', 'op-op13-119_p3-ja',
    'op-op01-121_r1',
    'op-op13-120_p1', 'op-op05-119_p3-ja',
    'op-op05-074_p4-ja',
    'op-op12-020_p2-ja',
    'op-st01-001_p4-ja', 'op-op07-038_p2', 'op-op12-020_p4-ja'
  ];
  const { data } = await supabase.from('cards').select('slug, rarity').in('slug', slugs);
  console.log(data);
}
run();
