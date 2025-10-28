import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Rutas públicas que NO requieren autenticación
const PUBLIC_ROUTES = ['/', '/auth', '/api/auth'];

// Rutas que requieren autenticación
const PROTECTED_ROUTES = ['/dashboard', '/admin', '/settings'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 1. VERIFICAR AUTENTICACIÓN PRIMERO
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route));
  
  if (isProtectedRoute) {
    const authResponse = await verifyAuth(request);
    if (authResponse) return authResponse; // Redirect si no autenticado
  }
  
  // 2. RATE LIMITING solo para APIs (después de auth)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
    const rateLimitResponse = await applyRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;
  }
  
  return NextResponse.next();
}

/**
 * Verifica autenticación del usuario
 * Retorna Response si hay error, null si está autenticado
 */
async function verifyAuth(request: NextRequest): Promise<NextResponse | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // No podemos setear cookies en middleware read-only
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'required');
      return NextResponse.redirect(url);
    }
    
    return null; // Usuario autenticado
  } catch (error) {
    console.error('[AUTH ERROR]', error);
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('auth', 'error');
    return NextResponse.redirect(url);
  }
}

/**
 * Aplica rate limiting basado en tier del usuario
 */
async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  // Skip en desarrollo
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  const clientIP = getClientIP(request);
  const tier = await getUserTier(request);
  
  // Límites por tier (requests por hora)
  const limits = {
    free: 10,
    paid: 100,
    enterprise: 1000
  };
  
  const limit = limits[tier];
  
  // Usar Upstash si está configurado
  if (process.env.UPSTASH_REDIS_REST_URL) {
    return await upstashRateLimit(clientIP, tier, limit);
  }
  
  // Fallback a Supabase
  return await supabaseRateLimit(clientIP, tier, limit);
}

/**
 * Rate limiting con Upstash Redis
 */
async function upstashRateLimit(
  clientIP: string, 
  tier: string, 
  limit: number
): Promise<NextResponse | null> {
  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis } = await import('@upstash/redis');
    
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, '1 h'),
      analytics: true,
      prefix: `ratelimit:${tier}`,
    });

    const { success, limit: maxLimit, reset, remaining } = await ratelimit.limit(clientIP);

    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          tier,
          limit: maxLimit,
          reset: new Date(reset).toISOString(),
        }),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(maxLimit));
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    response.headers.set('X-RateLimit-Reset', String(reset));
    return null; // Permite continuar
    
  } catch (error) {
    console.error('[UPSTASH ERROR]', error);
    return null; // Fail open
  }
}

/**
 * Rate limiting con Supabase (fallback)
 */
async function supabaseRateLimit(
  clientIP: string,
  tier: string,
  limit: number
): Promise<NextResponse | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) return null;

    const identifier = `${tier}:${clientIP}`;
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        p_identifier: identifier, 
        p_limit: limit 
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const allowed = data?.allowed ?? true;

    if (!allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Rate limit exceeded',
          tier,
          limit,
        }),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return null;
    
  } catch (error) {
    console.error('[SUPABASE RATE LIMIT ERROR]', error);
    return null; // Fail open
  }
}

/**
 * Obtiene tier del usuario de forma SEGURA
 */
async function getUserTier(request: NextRequest): Promise<'free' | 'paid' | 'enterprise'> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'free';

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    return (profile?.subscription_tier as any) || 'free';
    
  } catch (error) {
    console.error('[GET USER TIER ERROR]', error);
    return 'free';
  }
}

/**
 * Extrae IP del cliente
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/settings/:path*',
    '/api/:path*',
  ],
};