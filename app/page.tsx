import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import TarantulaHawkWebsite from './components/TarantulaHawkWebsite';

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // If the magic link accidentally lands on '/', forward the code to /auth/callback
  const params = searchParams ? await searchParams : {};
  const code = typeof params.code === 'string' ? params.code : undefined;
  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }
  
  // Check for auth errors (show to user) and inactivity timeout
  const authParam = typeof params.auth === 'string' ? params.auth : undefined;
  const authErrorParam = typeof params.auth_error === 'string' ? params.auth_error : undefined;
  const authError = authErrorParam || (authParam === 'timeout' ? 'timeout' : undefined);
  if (authError) {
    console.log('[HOME] Auth error:', authError);
  }
  
  // Check if user explicitly logged out (skip any special handling)
  const loggedOut = typeof params.logout === 'string';
  
  // Check if user is authenticated
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  // We still perform the call to hydrate session cookies (SSR),
  // but we DO NOT redirect away from home if authenticated.
  // This lets users visit the marketing homepage even when logged in.
  const { data: { user } } = await supabase.auth.getUser();
  
  // Optional: acknowledge logout without referencing undefined variables
  if (loggedOut) {
    console.log('[HOME] User logged out flag present');
  }

  return (
    <TarantulaHawkWebsite authError={authError} />
  );
}