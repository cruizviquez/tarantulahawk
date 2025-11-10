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
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    // Pad base64 if needed
    const pad = payload.length % 4;
    const b64 = pad ? payload + '='.repeat(4 - pad) : payload;
    const json = atob(b64);
    return JSON.parse(json) as JWTPayload;
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
    let accessToken: string | null = null;
    try {
      const cookieData = JSON.parse(authCookie.value);
      accessToken = (cookieData && (cookieData.access_token as string)) || null;
    } catch {
      // Some deployments may store raw token; treat value as token
      accessToken = authCookie.value;
    }
    
    if (typeof accessToken !== 'string') {
      return null;
    }

    const payload = parseJWT(accessToken);
    if (!payload || !payload.sub) {
      // If we cannot parse but cookie exists, allow non-expired assumption
      // Actual auth will be enforced in API routes
      return { userId: 'unknown', isExpired: false };
    }

    return {
      userId: payload.sub,
      isExpired: isTokenExpired(payload),
    };
  } catch {
    // Fallback: cookie present but unreadable; allow and defer to API checks
    return { userId: 'unknown', isExpired: false };
  }
}

/**
 * Lightweight presence check for Supabase auth cookie
 */
export function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
}
