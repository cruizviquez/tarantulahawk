import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas públicas que NO requieren autenticación
const PUBLIC_ROUTES = ['/', '/auth/callback', '/auth/redirect', '/auth', '/login', '/signup'];

// APIs públicas que NO requieren autenticación
const PUBLIC_API_PREFIXES = ['/api/auth/hash', '/api/auth/logout', '/api/turnstile', '/api/excel'];

// Rutas protegidas por middleware (incluye dashboard para mayor seguridad)
const PROTECTED_ROUTES = ['/admin', '/settings', '/dashboard'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Archivos estáticos y Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }
  
  // APIs públicas: no verificar auth
  if (PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Verificación rápida solo con cookies (sin llamadas externas)
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    const sessionCookie = request.cookies.getAll().find(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    
    if (!sessionCookie || !sessionCookie.value) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'required');
      return NextResponse.redirect(url);
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};