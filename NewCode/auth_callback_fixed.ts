import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Endpoint para procesar magic link con tokens en hash
 * GET /api/auth/hash?access_token=...&refresh_token=...&next=/dashboard
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const access_token = url.searchParams.get('access_token');
  const refresh_token = url.searchParams.get('refresh_token');
  const next = url.searchParams.get('next') || '/dashboard';
  const origin = request.nextUrl.origin;

  // Validar tokens requeridos
  if (!access_token || !refresh_token) {
    console.error('[AUTH HASH] Missing tokens');
    return NextResponse.redirect(`${origin}/?auth_error=missing_tokens`);
  }

  // Validar configuración de Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[AUTH HASH] Missing Supabase config');
    return NextResponse.redirect(`${origin}/?auth_error=server_config`);
  }

  // Sanitizar ruta de redirección (prevenir open redirect)
  let nextPath = '/dashboard';
  try {
    if (next.startsWith('/')) {
      // Ruta relativa válida
      nextPath = next;
    } else if (next.startsWith('http://') || next.startsWith('https://')) {
      // Solo permitir mismo origen
      const parsed = new URL(next);
      if (parsed.origin === origin) {
        nextPath = parsed.pathname + parsed.search;
      }
    }
  } catch (error) {
    console.error('[AUTH HASH] Invalid next parameter:', error);
    nextPath = '/dashboard';
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

  // Establecer sesión con los tokens
  try {
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.error('[AUTH HASH] setSession error:', error.message);
      return NextResponse.redirect(
        `${origin}/?auth_error=${encodeURIComponent(error.message)}`
      );
    }

    if (!data?.session) {
      console.error('[AUTH HASH] No session returned');
      return NextResponse.redirect(`${origin}/?auth_error=no_session`);
    }

    // Verificar que el usuario existe
    if (!data.user) {
      console.error('[AUTH HASH] No user in session');
      return NextResponse.redirect(`${origin}/?auth_error=no_user`);
    }

    // Log exitoso (útil para debugging)
    console.log('[AUTH HASH] Success:', {
      userId: data.user.id,
      email: data.user.email,
      nextPath,
    });

    // Redirigir a la ruta protegida
    return NextResponse.redirect(`${origin}${nextPath}`);
    
  } catch (error) {
    console.error('[AUTH HASH] Exception:', error);
    return NextResponse.redirect(`${origin}/?auth_error=exception`);
  }
}

/**
 * Manejar otros métodos HTTP
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed. Use GET with query parameters.' },
    { status: 405 }
  );
}