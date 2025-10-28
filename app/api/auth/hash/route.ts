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
 */
function getPublicUrl(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  return forwardedHost 
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;
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
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Forzar cookies seguras en producción
            const secureOptions = {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax' as const,
              path: '/',
            };
            cookieStore.set(name, value, secureOptions);
          });
        } catch (error) {
          console.error('[AUTH HASH] Cookie error:', error);
        }
      },
    },
  });

  // Check if token already used (prevent replay attacks)
  const tokenHash = access_token.substring(0, 30); // Use first 30 chars as hash
  const { data: existingUse } = await supabase
    .from('used_tokens')
    .select('token_hash')
    .eq('token_hash', tokenHash)
    .single();
  
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
    await supabase.from('used_tokens').insert({
      token_hash: tokenHash,
      used_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // Expire in 1 hour
    });

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
