'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

/**
 * Handles Supabase links that redirect to the Site URL with URL hash params
 * like `#access_token=...&refresh_token=...`. Since the server cannot see the
 * hash, we parse it on the client, set the session, clean the URL, and
 * navigate to /dashboard.
 */
export default function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (!window.location.hash || window.location.hash.length < 2) return;

      const hash = window.location.hash.substring(1); // drop leading '#'
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (!access_token || !refresh_token) return;

      // Hand off to server to set secure cookies, then redirect to dashboard
      const next = encodeURIComponent('/dashboard');
      const at = encodeURIComponent(access_token);
      const rt = encodeURIComponent(refresh_token);

      // Clean URL (remove hash) before navigating
      try {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      } catch {}

      // Full navigation so server can set cookies
      window.location.assign(`/api/auth/hash?access_token=${at}&refresh_token=${rt}&next=${next}`);
    } catch {
      // swallow errors to avoid disrupting landing page
    }
  }, [router]);

  return null;
}
