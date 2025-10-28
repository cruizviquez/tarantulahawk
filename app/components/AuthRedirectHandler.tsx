'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Clean authentication redirect handler
 * Intercepts Supabase hash-based auth tokens and processes them silently
 * No visible errors or intermediate pages shown to user
 */
export default function AuthRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Check for hash params (Supabase magic link tokens)
    const hash = window.location.hash;
    if (!hash || hash.length < 10) return;

    try {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      
      if (!accessToken || !refreshToken) return;

      // Process auth silently via API immediately (no delay)
      const next = encodeURIComponent('/dashboard');
      const at = encodeURIComponent(accessToken);
      const rt = encodeURIComponent(refreshToken);
      
      // Direct replacement (no intermediate page) - do this FIRST
      window.location.replace(`/api/auth/hash?access_token=${at}&refresh_token=${rt}&next=${next}`);
    } catch (error) {
      // Silent failure - don't disrupt landing page
      console.warn('[AUTH] Silent redirect failed:', error);
    }
  }, [router]);

  return null;
}
