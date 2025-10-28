'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

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
    
    const hash = window.location.hash;
    
    // Check for error in hash first (expired/invalid magic link)
    if (hash.includes('error=access_denied') || hash.includes('otp_expired') || hash.includes('error_code')) {
      console.warn('[AUTH] Magic link expired or invalid');
      
      // Force logout and clear everything
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name.startsWith('sb-')) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      });
      
      // Clean hash and redirect to home with error message
      window.history.replaceState(null, '', window.location.pathname);
      window.location.replace('/?auth_error=link_expired');
      return;
    }
    
    // Check for hash params (Supabase magic link tokens)
    if (!hash || hash.length < 10) return;

    try {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      
      if (!accessToken || !refreshToken) return;

      console.log('[AUTH] Processing magic link tokens...');
      
      // Clean hash from URL FIRST (hide tokens immediately)
      window.history.replaceState(null, '', window.location.pathname);
      
      // Process auth silently via API
      const next = encodeURIComponent('/dashboard');
      const at = encodeURIComponent(accessToken);
      const rt = encodeURIComponent(refreshToken);
      
      // Direct replacement to auth endpoint (no intermediate page)
      window.location.replace(`/api/auth/hash?access_token=${at}&refresh_token=${rt}&next=${next}`);
    } catch (error) {
      // Silent failure - don't disrupt landing page
      console.warn('[AUTH] Silent redirect failed:', error);
    }
  }, [router]);

  return null;
}
