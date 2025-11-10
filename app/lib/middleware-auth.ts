/**
 * middleware-auth.ts
 * Auth helpers for Edge middleware (no Node.js APIs)
 */

import { NextRequest } from 'next/server';

interface JWTPayload {
  sub: string;
  email?: string;
  role?: string;
  exp?: number;
  iat?: number;
}

/**
 * Parse JWT without verifying signature (for quick checks in middleware)
 * Note: Only use for non-critical role/expiry checks; real validation happens in API routes
 */
export function parseJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    );
    
    return decoded as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Check if JWT is expired
 */
export function isTokenExpired(payload: JWTPayload): boolean {
  if (!payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

/**
 * Extract user info from Supabase auth cookie
 * Note: Role is stored in profiles table, not in JWT. 
 * Middleware only validates auth presence/expiry. 
 * Role checks must be done in API routes via database query.
 */
export function getUserFromCookies(request: NextRequest): { userId: string; isExpired: boolean } | null {
  // Supabase stores JWT in cookie like: sb-<project-ref>-auth-token
  const authCookie = request.cookies.getAll().find(c => 
    c.name.startsWith('sb-') && c.name.includes('-auth-token')
  );
  
  if (!authCookie || !authCookie.value) {
    return null;
  }

  try {
    // Supabase cookie value is a JSON object with access_token
    const cookieData = JSON.parse(authCookie.value);
    const accessToken = cookieData.access_token || cookieData;
    
    if (typeof accessToken !== 'string') {
      return null;
    }

    const payload = parseJWT(accessToken);
    if (!payload || !payload.sub) {
      return null;
    }

    return {
      userId: payload.sub,
      isExpired: isTokenExpired(payload),
    };
  } catch {
    return null;
  }
}
