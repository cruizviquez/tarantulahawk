"use client";

import { useEffect } from 'react';

export default function AuthCapturePage() {
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;

      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
      const params = new URLSearchParams(hash);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (access_token && refresh_token) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        const at = encodeURIComponent(access_token);
        const rt = encodeURIComponent(refresh_token);

        // Clean the hash from the current URL so it doesn't persist
        try { window.history.replaceState({}, '', window.location.pathname + window.location.search); } catch {}

        // Hand off to server to set cookies; then it will redirect to the protected page
        window.location.replace(`/api/auth/hash?access_token=${at}&refresh_token=${rt}&next=${next}`);
        return;
      }
    } catch {}

    // If no tokens, send to landing with auth prompt
    window.location.replace('/?auth=required');
  }, []);

  return null;
}
