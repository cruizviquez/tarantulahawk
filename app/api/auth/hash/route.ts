export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Endpoint para procesar magic link con tokens
 * POST /api/auth/hash (body: { access_token, refresh_token }) - RECOMENDADO (no expone tokens en URL)
 * GET /api/auth/hash?access_token=...&refresh_token=... - Legacy support
 */

/**
 * Helper: Get public URL from request
 * Works in Codespaces, localhost, and Vercel production
 */
function getPublicUrl(request: NextRequest): string {
  // If NEXT_PUBLIC_SITE_URL is set (production/staging), use it
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  const url = new URL(request.url);
  let host = request.headers.get('x-forwarded-host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'https';

  // GitHub Codespaces: port is in subdomain (-3000), not suffix (:3000)
  // Some proxies incorrectly append :port, so strip it for .github.dev hosts
  if (host.includes('.github.dev:')) {
    host = host.split(':')[0];
  }

  // Localhost: strip port for consistency (optional, but keeps URLs clean)
  // Vercel/production: x-forwarded-host won't have port, so no action needed

  return `${proto}://${host}`;
}

/**
 * POST handler - Método preferido (tokens en body, no en URL)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    return await processAuth(request, access_token, refresh_token, false);
  } catch (error) {
    console.error('[AUTH HASH POST] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

/**
 * GET handler - Legacy support (menos seguro, tokens en URL)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const access_token = url.searchParams.get('access_token');
  const refresh_token = url.searchParams.get('refresh_token');
  
  return await processAuth(request, access_token, refresh_token, true);
}

/**
 * Función compartida para procesar autenticación
 */
async function processAuth(
  request: NextRequest,
  access_token: string | null,
  refresh_token: string | null,
  isRedirect: boolean
): Promise<NextResponse> {
  const publicUrl = getPublicUrl(request);

  // Validar tokens requeridos
  if (!access_token || !refresh_token) {
    console.error('[AUTH HASH] Missing tokens');
    if (isRedirect) {
      return NextResponse.redirect(`${publicUrl}/?auth_error=missing_tokens`);
    }
    return NextResponse.json(
      { success: false, error: 'Missing tokens' },
      { status: 400 }
    );
  }

  // Validar configuración de Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[AUTH HASH] Missing Supabase config');
    if (isRedirect) {
      return NextResponse.redirect(`${publicUrl}/?auth_error=server_config`);
    }
    return NextResponse.json(
      { success: false, error: 'Server configuration error' },
      { status: 500 }
    );
  }

  // Crear cliente de Supabase con acceso a cookies
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  // Admin client (service role) for used_tokens table (RLS: service-only)
  const admin = serviceRoleKey
    ? createServerClient(supabaseUrl, serviceRoleKey, {
        cookies: {
          getAll() {
            return [];
          },
          setAll() {},
        },
      })
    : null;

  // Check if token already used (prevent replay attacks)
  const tokenHash = access_token.substring(0, 30); // Use first 30 chars as hash
  let existingUse: any = null;
  try {
    const client = admin || supabase;
    const { data } = await client
      .from('used_tokens')
      .select('token_hash')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    existingUse = data;
  } catch (e) {
    console.warn('[AUTH HASH] used_tokens check failed:', (e as any)?.message || e);
    // Fail closed in production if we expect service role
    if (process.env.NODE_ENV === 'production') {
      const publicUrl = getPublicUrl(request);
      return isRedirect
        ? NextResponse.redirect(`${publicUrl}/?auth_error=token_check_failed`)
        : NextResponse.json({ success: false, error: 'Token check failed' }, { status: 500 });
    }
  }
  
  if (existingUse) {
    console.warn('[AUTH HASH] Magic link already used');
    if (isRedirect) {
      return NextResponse.redirect(`${publicUrl}/?auth_error=link_expired`);
    }
    return NextResponse.json(
      { success: false, error: 'Magic link already used or expired' },
      { status: 400 }
    );
  }

  // Establecer sesión con los tokens
  try {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.error('[AUTH HASH] setSession error:', error.message);
      if (isRedirect) {
        return NextResponse.redirect(
          `${publicUrl}/?auth_error=${encodeURIComponent(error.message)}`
        );
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (!data?.session) {
      console.error('[AUTH HASH] No session returned');
      if (isRedirect) {
        return NextResponse.redirect(`${publicUrl}/?auth_error=no_session`);
      }
      return NextResponse.json(
        { success: false, error: 'No session returned' },
        { status: 400 }
      );
    }

    // Verificar que el usuario existe
    if (!data.user) {
      console.error('[AUTH HASH] No user in session');
      if (isRedirect) {
        return NextResponse.redirect(`${publicUrl}/?auth_error=no_user`);
      }
      return NextResponse.json(
        { success: false, error: 'No user in session' },
        { status: 400 }
      );
    }

    // Mark token as used (prevent reuse)
    if (!admin && process.env.NODE_ENV === 'production') {
      console.error('[AUTH HASH] Service role key missing; refusing to mark token used');
      const publicUrl = getPublicUrl(request);
      return isRedirect
        ? NextResponse.redirect(`${publicUrl}/?auth_error=server_config`)
        : NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
    }
    const writer = admin || supabase;
    const { error: insertErr } = await writer.from('used_tokens').insert({
      token_hash: tokenHash,
      used_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (insertErr) {
      console.error('[AUTH HASH] used_tokens insert failed:', insertErr.message);
      if (process.env.NODE_ENV === 'production') {
        const publicUrl = getPublicUrl(request);
        return isRedirect
          ? NextResponse.redirect(`${publicUrl}/?auth_error=token_mark_failed`)
          : NextResponse.json({ success: false, error: 'Token mark failed' }, { status: 500 });
      }
    }

    // Log exitoso (útil para debugging)
    console.log('[AUTH HASH] Success:', {
      userId: data.user.id,
      email: data.user.email,
      publicUrl,
    });

    // Para GET: redirigir al dashboard
    if (isRedirect) {
      const redirectUrl = `${publicUrl}/dashboard`;
      console.log('[AUTH HASH] Redirecting to:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    }

    // Para POST: retornar JSON success
    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
    
  } catch (error) {
    console.error('[AUTH HASH] Exception:', error);
    if (isRedirect) {
      return NextResponse.redirect(`${publicUrl}/?auth_error=exception`);
    }
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
