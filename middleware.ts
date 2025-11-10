import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserFromCookies } from './app/lib/middleware-auth';

// Rutas públicas que NO requieren autenticación
const PUBLIC_ROUTES = ['/', '/auth/callback', '/auth/redirect', '/auth', '/login', '/signup'];

// APIs públicas que NO requieren autenticación (reducido a mínimo)
const PUBLIC_API_PREFIXES = [
  '/api/auth/hash',      // Magic link generation
  '/api/auth/logout',    // Logout
  '/api/turnstile',      // CAPTCHA validation
  '/api/health',         // Health checks
  '/api/heartbeat',      // Monitoring
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
    "connect-src 'self' https://*.supabase.co https://*.github.dev wss://*.supabase.co; " +
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

  // Helper: normalize Codespaces host (strip :port only for .github.dev; preserve elsewhere)
  function normalizeRedirectUrl(u: URL) {
    // Only strip :port on Codespaces (.github.dev hosts); preserve ports on other hosts (e.g., tarantulahawk:3000)
    if (u.hostname.endsWith('.github.dev') && u.host.includes(':')) {
      const withoutPort = u.host.split(':')[0];
      u.host = withoutPort;
    }
    return u;
  }
  
  // Archivos estáticos y Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/public')) {
    return NextResponse.next();
  }
  
  // Get user info from cookies (includes role and expiry check)
  const userInfo = getUserFromCookies(request);
  
  // Check if path is API route
  const isApiRoute = pathname.startsWith('/api');
  
  // === API ROUTE PROTECTION ===
  if (isApiRoute) {
    // Allow public APIs
    const isPublicApi = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
    if (isPublicApi) {
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }
    
    // Block if no valid session
    if (!userInfo || userInfo.isExpired) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired session' },
        { status: 401 }
      );
    }
    
    // Protected APIs require valid auth (role check done in API route via DB)
    const isProtectedApi = PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix));
    if (isProtectedApi) {
      // Auth validated, role checks happen in API route
      const response = NextResponse.next();
      return addSecurityHeaders(response);
    }
    
    // Default: allow other APIs if authenticated
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
  
  // === PAGE ROUTE PROTECTION ===
  
  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
  
  // Admin routes require valid auth (role check done in page component via DB)
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
  if (isAdminRoute) {
    if (!userInfo || userInfo.isExpired) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'required');
      normalizeRedirectUrl(url);
      return NextResponse.redirect(url);
    }
    
    // Allow through - role check happens in page component
    const response = NextResponse.next();
    return addSecurityHeaders(response);
  }
  
  // Protected routes require valid auth
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  if (isProtectedRoute) {
    if (!userInfo || userInfo.isExpired) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'required');
      normalizeRedirectUrl(url);
      return NextResponse.redirect(url);
    }
  }
  
  // Default: allow through with security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};