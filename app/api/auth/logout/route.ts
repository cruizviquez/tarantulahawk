import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  
  // Get the correct public URL (handles Codespaces X-Forwarded-Host)
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const publicUrl = forwardedHost 
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;
  
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
          } catch {}
        },
      },
    }
  );

  // Sign out from Supabase (clears session and cookies)
  await supabase.auth.signOut();

  // Clear all Supabase cookies manually to ensure logout
  const allCookies = cookieStore.getAll();
  allCookies.forEach(cookie => {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name);
    }
  });

  // Build redirect URL correctly for Codespaces and local dev
  const redirectUrl = `${publicUrl}/?logout=true`;
  
  console.log('[LOGOUT] Public URL:', publicUrl);
  console.log('[LOGOUT] Redirecting to:', redirectUrl);
  
  return NextResponse.redirect(redirectUrl);
}
