import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey);

// Server-side client with service role for admin operations
export function createServerClient() {
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;
  return createClient<Database>(supabaseUrl, supabaseSecretKey);
}
