import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Turnstile } from '@marsidev/react-turnstile';

// Inline logo for modal consistency
const TarantulaHawkLogo = ({ className = "w-10 h-10 mb-4 mx-auto" }) => (
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

interface OnboardingFormProps {
  onClose: () => void;
  mode?: 'signup' | 'login'; // signup = new users, login = existing users
}

export default function OnboardingForm({ onClose, mode = 'signup' }: OnboardingFormProps) {
  const [currentMode, setCurrentMode] = useState<'signup' | 'login'>(mode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [userExists, setUserExists] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // Validate CAPTCHA
    if (!captchaToken) {
      setError('Por favor completa la verificación de seguridad.');
      setLoading(false);
      return;
    }

    // Validate company name for SIGNUP only
    if (currentMode === 'signup' && !company.trim()) {
      setError('El campo empresa es obligatorio.');
      setLoading(false);
      return;
    }

    // Validate name for SIGNUP only
    if (currentMode === 'signup' && !name.trim()) {
      setError('El campo nombre es obligatorio.');
      setLoading(false);
      return;
    }

    try {
      // Server-side verify Turnstile token
      const verifyRes = await fetch('/api/turnstile/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: captchaToken }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error('Verificación de seguridad fallida. Por favor intenta de nuevo.');
      }

      // Send Magic Link via Supabase OTP
      // Build the public base URL for email redirects
      function computePublicBaseUrl(): string {
        // Client-side preferred (captures actual host as seen by user)
        if (typeof window !== 'undefined') {
          const { origin } = window.location; // e.g. https://<id>-3000.app.github.dev or http://tarantulahawk:3000
          try {
            const u = new URL(origin);
            // Only strip :port on Codespaces hosts; preserve ports elsewhere (e.g., tarantulahawk:3000)
            if (u.hostname.endsWith('.github.dev')) {
              const hostNoPort = u.host.split(':')[0];
              return `${u.protocol}//${hostNoPort}`;
            }
            return origin;
          } catch {
            return origin;
          }
        }

        // Server-side: check env
        const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
        if (fromEnv) {
          try {
            const u = new URL(fromEnv);
            return u.origin;
          } catch {
            // Malformed; continue to fallback
          }
        }

        // Fallback production domain
        return 'https://tarantulahawk.cloud';
      }

      const baseUrl = computePublicBaseUrl();
      const redirectUrl = `${baseUrl.replace(/\/$/, '')}/auth/redirect`;
      
      console.log('[ONBOARDING] emailRedirectTo:', redirectUrl);
      
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: currentMode === 'signup',
          data: currentMode === 'signup' ? {
            name,
            company,
            balance: 500.0,
          } : undefined,
        },
      });

      if (signInError) {
        // Si el usuario ya existe y se intenta signup, mostrar como login exitoso
        const lowerMsg = signInError.message.toLowerCase();
        if (currentMode === 'signup' && (
          lowerMsg.includes('already registered') ||
          lowerMsg.includes('already exists') ||
          lowerMsg.includes('signups not allowed') ||
          lowerMsg.includes('duplicate') ||
          lowerMsg.includes('email rate limit')
        )) {
          // Enviar Magic Link de login
          const { error: loginError } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: redirectUrl,
              shouldCreateUser: false,
            },
          });
          
          if (loginError) {
            throw loginError;
          }
          
          // Mostrar éxito pero sin mencionar créditos (es login, no signup)
          setSuccess(true);
          setUserExists(false); // No mostrar warning de "ya existe"
          setLoading(false);
          // Forzar modo login para el mensaje correcto
          setCurrentMode('login');
          return;
        }
        // Check if user doesn't exist (solo login)
        if (currentMode === 'login' && (
          lowerMsg.includes('user not found') || 
          lowerMsg.includes('signups not allowed') ||
          lowerMsg.includes('signup disabled')
        )) {
          setError('Usuario no registrado');
          setLoading(false);
          // Show signup option
          setTimeout(() => {
            if (window.confirm('Usuario no registrado. ¿Deseas crear una cuenta nueva con este email?')) {
              setCurrentMode('signup');
              setError('');
            }
          }, 100);
          return;
        }
        throw signInError;
      }

      // Audit logging happens server-side in auth callback (requires service role key)
      // Client-side audit calls are skipped to avoid exposing service credentials

      setSuccess(true);
      setLoading(false);
    } catch (error: any) {
      setError(error.message || 'Error al procesar tu solicitud. Por favor intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-6" onClick={onClose}>
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl max-w-md w-full shadow-2xl relative flex flex-col" style={{ minHeight: '400px', maxHeight: '95vh', overflowY: 'auto', padding: '2rem 1rem' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-6 text-gray-500 hover:text-white text-2xl z-10">×</button>
        <TarantulaHawkLogo />
        {userExists ? (
          <div className="text-center py-8 flex flex-col justify-center items-center h-full">
            <div className="text-yellow-400 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-2 text-yellow-400">Usuario ya registrado</h2>
            <p className="text-gray-400 mb-4">Este correo ya tiene una cuenta. Hemos enviado un Magic Link para iniciar sesión sin contraseña.</p>
            <p className="text-white font-semibold mb-4 bg-gray-800 rounded-lg p-3">{email}</p>
            <button onClick={onClose} className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-lg font-semibold hover:from-teal-600 hover:to-emerald-600 transition w-full mt-4">
              Entendido
            </button>
          </div>
        ) : success ? (
          <div className="text-center py-8 flex flex-col justify-center items-center h-full">
            <div className="text-green-500 text-5xl mb-4">✔️</div>
            <h2 className="text-2xl font-bold mb-2 text-green-400">¡Magic Link Enviado!</h2>
            <p className="text-gray-400 mb-4">Hemos enviado un enlace seguro a:</p>
            <p className="text-white font-semibold mb-4 bg-gray-800 rounded-lg p-3">{email}</p>
            {currentMode === 'signup' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                <h3 className="text-green-400 font-semibold mb-2">🎁 $500 USD en Créditos Virtuales</h3>
                <ul className="text-gray-400 text-sm text-left space-y-1">
                  <li>✅ Créditos inmediatos al activar tu cuenta</li>
                  <li>✅ Prueba todo el poder del análisis IA hasta por 30 días</li>
                </ul>
              </div>
            )}
            <p className="text-gray-500 text-sm mb-6">
              <strong>Paso siguiente:</strong> Revisa tu bandeja de entrada y haz clic en el Magic Link.<br />
              ⏱️ <strong>El enlace expira en 10 minutos</strong> y solo puede usarse una vez por seguridad.
            </p>
            <button onClick={onClose} className="px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold hover:from-blue-700 hover:to-emerald-600 transition w-full mt-4">
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-blue-400 text-center text-sm">
                <div className="font-semibold mb-1">❌ Error</div>
                {error}
              </div>
            )}
            
            {currentMode === 'signup' && (
              <>
                <div>
                  <input 
                    type="text" 
                    placeholder="Nombre Completo" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-emerald-500 outline-none" 
                  />
                </div>
                
                <div>
                  <input 
                    type="text" 
                    placeholder="Empresa / Organización" 
                    value={company} 
                    onChange={e => setCompany(e.target.value)} 
                    required 
                    className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-emerald-500 outline-none" 
                  />
                  <p className="text-gray-500 text-xs mt-1">� Solo para uso empresarial</p>
                </div>
              </>
            )}
            
            <div>
              <input 
                type="email" 
                placeholder="Correo Electrónico" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                    className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-emerald-500 outline-none"
              />
              <p className="text-gray-500 text-xs mt-1">� Cualquier dominio de email es aceptado</p>
            </div>
            
            {/* CAPTCHA */}
            <div className="flex justify-center">
              <Turnstile
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                onSuccess={(token) => setCaptchaToken(token)}
                onError={() => {
                  setCaptchaToken(null);
                  setError('Error en verificación de seguridad. Por favor recarga la página.');
                }}
                options={{ theme: 'dark' }}
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading || !captchaToken || (currentMode === 'signup' && (!name.trim() || !company.trim()))}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold hover:from-blue-700 hover:to-emerald-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando Magic Link...' : currentMode === 'signup' ? '✨ Crear Cuenta y Obtener $500 USD' : '🔐 Enviar Enlace de Acceso'}
            </button>
            
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-2">
                🛡️ Sin contraseñas = Sin riesgo de phishing. Recibirás un enlace seguro por email (válido 10 min).
              </p>
              {currentMode === 'signup' ? (
                <p className="text-gray-400 text-sm">
                  ¿Ya tienes cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => { setCurrentMode('login'); setError(''); }}
                    className="text-teal-400 hover:text-teal-300 underline"
                  >
                    Inicia sesión aquí
                  </button>
                </p>
              ) : (
                <p className="text-gray-400 text-sm">
                  ¿No tienes cuenta?{' '}
                  <button
                    type="button"
                    onClick={() => { setCurrentMode('signup'); setError(''); }}
                    className="text-teal-400 hover:text-teal-300 underline"
                  >
                    Regístrate aquí
                  </button>
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
