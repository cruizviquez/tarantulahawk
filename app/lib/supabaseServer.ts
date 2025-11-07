import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Server-side Supabase client (service role). Never import this in client components.
// Use a broad return type to avoid build-time type unions when a dummy client is returned
export function getServiceSupabase(): any {
  if (!supabaseUrl || !serviceKey) {
    console.error('[Supabase] Service client missing configuration.');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
    console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceKey);
    console.error('Verifica que .env.local esté en la raíz y que el servidor se haya reiniciado.');
    // Return a dummy client that always errors
    const dummy = {
      auth: {
        getUser: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null })
      },
      from: () => ({
        select: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null }),
        insert: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null }),
        update: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null }),
        upsert: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null }),
        delete: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null }),
        eq: () => dummy.from(),
        single: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null }),
        order: () => dummy.from(),
      }),
      rpc: async () => ({ error: { message: 'Supabase service client missing configuration' }, data: null })
    };
    return dummy;
  }
  return createClient(supabaseUrl, serviceKey);
}
