import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Rutas públicas que NO requieren autenticación
const PUBLIC_ROUTES = ['/', '/auth/callback', '/auth/redirect', '/auth', '/auth/login', '/login', '/signup', '/onboarding', '/precios'];

// APIs públicas que NO requieren autenticación (reducido a mínimo)
const PUBLIC_API_PREFIXES = [
  '/api/auth/hash',        // Magic link token processing
  '/api/auth/logout',      // Logout
  '/api/auth/check-email', // Pre-signup email existence check (no auth required)
  '/api/turnstile',        // CAPTCHA validation
  '/api/health',           // Health checks
  '/api/heartbeat',        // Monitoring
  '/api/chat',             // AI chat endpoint
  '/api/warmup',           // Model warmup
  '/api/chat/clear',       // Clear chat history
];

// APIs que requieren autenticación (proteger explícitamente)
const PROTECTED_API_PREFIXES = [
  '/api/credits',        // Credit management
  '/api/usage',          // Usage tracking
  '/api/profile',        // Profile updates
  '/api/audit',          // Audit logs
  '/api/paypal',         // Payment processing
  '/api/reports',        // Report generation
  '/api/admin',          // Admin endpoints (role check done in API route)
];

// Rutas protegidas por middleware
const PROTECTED_ROUTES = ['/dashboard', '/settings', '/vynl', '/pay'];

// Rutas admin (role check done in the route itself via DB query)
const ADMIN_ROUTES = ['/admin'];

/**
 * Apply security headers to all responses
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy (ajustar según necesidades)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co https://*.github.dev https://challenges.cloudflare.com wss://*.supabase.co; " +
    "frame-src 'self' https://challenges.cloudflare.com;"
  );

  // Strict Transport Security (HTTPS only)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection (legacy but good for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy (restrict features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  );

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 301 redirects to root for legacy/invalid paths
  if (pathname === '/en' || pathname === '/es' || pathname === '/$') {
    return NextResponse.redirect(new URL('/', request.url), 301);
  }

  // Helper local para trazas (solo dev) sin exponer info sensible
  const trace = (stage: string, extra: Record<string, any> = {}) => {
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('[MW]', stage, JSON.stringify({
          path: pathname,
          ...extra
        }));
      } catch {}
    }
  };

  // Helper: normalize Codespaces host (strip :port only for .github.dev; preserve elsewhere)
  function normalizeRedirectUrl(u: URL) {
    if (u.hostname.endsWith('.github.dev') && u.host.includes(':')) {
      const withoutPort = u.host.split(':')[0];
      u.host = withoutPort;
    }
    return u;
  }
  
  // Archivos estáticos y Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/public')) {
    trace('static-pass');
    const resp = NextResponse.next();
    resp.headers.set('X-Middleware-Trace', 'static');
    return resp;
  }
  
  // Simple session check using Supabase SSR
  let authValid = false;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );
    const { data: { session } } = await supabase.auth.getSession();
    authValid = !!session;
  } catch (e) {
    authValid = false;
  }
  
  const isApiRoute = pathname.startsWith('/api');
  trace('init', { isApiRoute, authValid });
  
  // === API ROUTE PROTECTION ===
  if (isApiRoute) {
    const isPublicApi = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
    if (isPublicApi) {
      trace('api-public-allow');
      const response = NextResponse.next();
      response.headers.set('X-Middleware-Trace', 'api-public');
      return addSecurityHeaders(response);
    }
    
    if (!authValid) {
      trace('api-unauthorized');
      const response = NextResponse.json(
        { error: 'Unauthorized - Invalid or expired session' },
        { status: 401 }
      );
      response.headers.set('X-Middleware-Trace', 'api-401');
      return response;
    }
    
    const isProtectedApi = PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
    if (isProtectedApi) {
      trace('api-protected-allow');
      const response = NextResponse.next();
      response.headers.set('X-Middleware-Trace', 'api-protected');
      return addSecurityHeaders(response);
    }
    
    trace('api-default-allow');
    const response = NextResponse.next();
    response.headers.set('X-Middleware-Trace', 'api-default');
    return addSecurityHeaders(response);
  }
  
  // === PAGE ROUTE PROTECTION ===
  if (PUBLIC_ROUTES.includes(pathname)) {
    trace('page-public-allow');
    const response = NextResponse.next();
    response.headers.set('X-Middleware-Trace', 'page-public');
    return addSecurityHeaders(response);
  }
  
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
  if (isAdminRoute) {
    if (!authValid) {
      trace('admin-redirect');
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      normalizeRedirectUrl(url);
      const resp = NextResponse.redirect(url);
      resp.headers.set('X-Middleware-Trace', 'admin-redirect');
      return resp;
    }
    trace('admin-allow');
    const response = NextResponse.next();
    response.headers.set('X-Middleware-Trace', 'admin-allow');
    return addSecurityHeaders(response);
  }
  
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  if (isProtectedRoute) {
    if (!authValid) {
      trace('protected-redirect');
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      normalizeRedirectUrl(url);
      const resp = NextResponse.redirect(url);
      resp.headers.set('X-Middleware-Trace', 'protected-redirect');
      return resp;
    }
    trace('protected-allow');
  }
  
  trace('page-default-allow');
  const response = NextResponse.next();
  response.headers.set('X-Middleware-Trace', 'page-default');
  return addSecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};