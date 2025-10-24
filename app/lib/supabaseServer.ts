import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side Supabase client (service role). Never import this in client components.
export function getServiceSupabase() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase service client missing configuration');
  }
  return createClient(supabaseUrl, serviceKey);
}
