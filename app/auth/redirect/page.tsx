'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Página de redirección de autenticación
 * Procesa tokens de Supabase del hash sin exponer en URL
 * Evita el "rebote" Home → Dashboard
 */
export default function AuthRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash || '';
    
    // Detectar errores en el hash (magic link expirado/inválido)
    if (hash.includes('error=access_denied') || hash.includes('otp_expired') || hash.includes('error_code')) {
      console.warn('[AUTH REDIRECT] Magic link expired or invalid');
      window.history.replaceState(null, '', window.location.pathname);
      router.replace('/?auth_error=link_expired');
      return;
    }
    
    if (!hash || hash.length < 10) {
      // No hay tokens, redirigir a home
      router.replace('/');
      return;
    }

    // Procesar tokens de forma segura
    (async () => {
      try {
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        
        if (!access_token || !refresh_token) {
          router.replace('/?auth_error=missing_tokens');
          return;
        }

        // Limpiar hash INMEDIATAMENTE (no queda visible en URL)
        window.history.replaceState(null, '', window.location.pathname);

        console.log('[AUTH REDIRECT] Processing tokens via POST...');

        // Enviar tokens por POST (no query-string, más seguro)
        const response = await fetch('/api/auth/hash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ access_token, refresh_token })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[AUTH REDIRECT] Failed:', error);
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
          console.log('[AUTH REDIRECT] Success, redirecting to dashboard');
          router.replace('/dashboard');
        } else {
          throw new Error(result.error || 'Authentication failed');
        }
      } catch (error) {
        console.error('[AUTH REDIRECT] Exception:', error);
        router.replace('/?auth_error=signin_failed');
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg font-semibold">Estableciendo tu sesión…</p>
        <p className="text-gray-400 text-sm mt-2">Por favor espera un momento</p>
      </div>
    </div>
  );
}
