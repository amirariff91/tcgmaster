import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
async function run() {
  const { data } = await supabase.from('sets').select('*').in('id', ['85aebeb6-5eb4-4462-b60a-934b0856e9c5', 'df1da1e2-7504-4169-8fc9-496fe8d27f96']);
  console.log(JSON.stringify(data, null, 2));
}
run();
