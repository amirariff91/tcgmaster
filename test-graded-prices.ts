import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGradedPrices() {
  const { count, error } = await supabase
    .from('price_history')
    .select('*', { count: 'exact', head: true })
    .neq('grade', 'raw');
    
  console.log("Total graded price history records:", count);
}

checkGradedPrices();
