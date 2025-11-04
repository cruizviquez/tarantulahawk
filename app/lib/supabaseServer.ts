import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side Supabase client (service role). Never import this in client components.
export function getServiceSupabase() {
  if (!supabaseUrl || !serviceKey) {
    console.error('[Supabase] Service client missing configuration.');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
    console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceKey);
    console.error('Verifica que .env.local esté en la raíz y que el servidor se haya reiniciado.');
    // Return a dummy client that always errors
    return {
      auth: {
        getUser: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null })
      },
      from: () => ({ select: () => ({ error: { message: 'Supabase service client missing configuration' }, data: null }) })
    };
  }
  return createClient(supabaseUrl, serviceKey);
}
