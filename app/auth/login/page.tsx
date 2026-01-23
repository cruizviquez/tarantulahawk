'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '../../lib/supabaseClient';
import OnboardingForm from '../../components/OnboardingForm';

const TarantulaHawkLogo = ({ className = "w-16 h-16" }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#065f46'}} />
        <stop offset="50%" style={{stopColor: '#10b981'}} />
        <stop offset="100%" style={{stopColor: '#34d399'}} />
      </linearGradient>
      <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#00CED1'}} />
        <stop offset="50%" style={{stopColor: '#20B2AA'}} />
        <stop offset="100%" style={{stopColor: '#48D1CC'}} />
      </linearGradient>
    </defs>
    <circle cx="200" cy="200" r="190" fill="none" stroke="url(#tealGrad)" strokeWidth="3" opacity="0.4"/>
    <ellipse cx="200" cy="230" rx="35" ry="85" fill="#0A0A0A"/>
    <ellipse cx="200" cy="170" rx="18" ry="20" fill="#0F0F0F"/>
    <ellipse cx="200" cy="145" rx="32" ry="35" fill="#0F0F0F"/>
    <ellipse cx="200" cy="110" rx="22" ry="20" fill="#0A0A0A"/>
    <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#orangeGrad)" opacity="0.95"/>
    <ellipse cx="200" cy="245" rx="30" ry="9" fill="url(#orangeGrad)" opacity="0.9"/>
    <ellipse cx="200" cy="270" rx="27" ry="8" fill="url(#orangeGrad)" opacity="0.85"/>
    <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
    <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
    <path d="M 200 305 L 197 330 L 200 350 L 203 330 Z" fill="url(#orangeGrad)"/>
    <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1"/>
    <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1"/>
  </svg>
);

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginMode, setLoginMode] = useState<'signup' | 'login'>('login');

  const returnTo = searchParams?.get('returnTo') || '/dashboard';
  const authRequired = searchParams?.get('auth') === 'required';

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.push(returnTo);
        } else {
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setIsCheckingAuth(false);
      }
    };
    checkSession();
  }, [router, returnTo]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <TarantulaHawkLogo className="w-20 h-20 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400 text-lg">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8 shadow-2xl">
              <div className="text-center mb-8">
                <TarantulaHawkLogo className="w-20 h-20 mx-auto mb-6" />
                {authRequired ? (
                  <>
                    <div className="mb-4">
                      <div className="inline-block p-3 bg-yellow-500/10 rounded-full mb-4">
                        <svg className="w-12 h-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">Acceso Restringido</h1>
                    <p className="text-gray-400 mb-2">Esta página requiere autenticación</p>
                    <p className="text-sm text-gray-500 mb-6">Intentaste acceder a: <span className="text-emerald-400 font-mono">{returnTo}</span></p>
                  </>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold text-white mb-3">Iniciar Sesión</h1>
                    <p className="text-gray-400 mb-6">Accede a tu cuenta de TarantulaHawk</p>
                  </>
                )}
              </div>
              <div className="space-y-4">
                <button
                  onClick={() => { setLoginMode('login'); setShowOnboarding(true); }}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold hover:from-blue-700 hover:to-emerald-600 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Iniciar Sesión con Magic Link
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-900 text-gray-500">o</span>
                  </div>
                </div>
                <button
                  onClick={() => { setLoginMode('signup'); setShowOnboarding(true); }}
                  className="w-full py-4 bg-gray-800 border border-gray-700 rounded-lg font-semibold hover:bg-gray-750 transition flex items-center justify-center gap-2 text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Crear Cuenta Nueva
                </button>
                <div className="mt-6 text-center">
                  <a href="/" className="text-sm text-gray-400 hover:text-emerald-400 transition inline-flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Volver al inicio
                  </a>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-700">
                <div className="flex items-start gap-3 text-xs text-gray-500">
                  <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p><strong className="text-gray-400">Seguridad sin contraseñas:</strong> Usamos Magic Links enviados por email. Sin contraseñas = sin riesgo de phishing o filtración.</p>
                </div>
              </div>
              <p className="text-center text-gray-600 text-xs mt-6">TarantulaHawk © 2025 • Cumplimiento LFPIORPI</p>
            </div>
          </div>
          {showOnboarding && (
            <OnboardingForm
              mode={loginMode}
              onClose={() => setShowOnboarding(false)}
            />
          )}
        </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <TarantulaHawkLogo className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Cargando página de login...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
