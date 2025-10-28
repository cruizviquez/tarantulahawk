import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import TarantulaHawkWebsite from './components/TarantulaHawkWebsite';
import AuthRedirectHandler from './components/AuthRedirectHandler';

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
  
  // Check for auth errors (show to user)
  const authError = typeof params.auth_error === 'string' ? params.auth_error : undefined;
  if (authError) {
    console.log('[HOME] Auth error:', authError);
  }
  
  // Check if user explicitly logged out (skip redirect to dashboard)
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

  const { data: { user } } = await supabase.auth.getUser();

  // If user is logged in and didn't just logout, redirect to dashboard
  if (user && !loggedOut) {
    redirect('/dashboard');
  }
  
  // If just logged out, clear the logout param to prevent stuck state
  if (loggedOut && !user) {
    console.log('[HOME] User logged out successfully');
  }

  return (
    <>
      <AuthRedirectHandler />
      <TarantulaHawkWebsite authError={authError} />
    </>
  );
}