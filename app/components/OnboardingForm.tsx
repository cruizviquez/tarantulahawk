"use client";

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
  const [giro, setGiro] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);           // Magic link enviado
  const [isNewSignup, setIsNewSignup] = useState(false);   // Nuevo registro creado
  const [existingUserPrompt, setExistingUserPrompt] = useState(false); // Mostrar caja "usuario ya existente"
  const [userNotFound, setUserNotFound] = useState(false); // Modo login, usuario no existe
  const [loginLinkSent, setLoginLinkSent] = useState(false); // Magic link de login enviado
  const [checkingEmail, setCheckingEmail] = useState(false); // Verificando email en background

  // Helper to compute Python backend URL (for Codespaces and local dev)
  const computeBackendUrl = (): string => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host.includes('github.dev')) {
        return `https://${host.replace('-3000.app', '-8000.app')}`;
      }
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:8000';
      }
    }
    return process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
  };

  // Función para verificar email cuando pierde el foco (onBlur)
  const handleEmailBlur = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Solo verificar si hay email y estamos en signup mode
    if (!normalizedEmail || currentMode !== 'signup') {
      return;
    }

    // Validar formato básico de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return;
    }

    setCheckingEmail(true);
    const backendUrl = computeBackendUrl();

    try {
      const resp = await fetch(`${backendUrl}/api/auth/check-email`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ email: normalizedEmail }),
        credentials: 'include',
      });
      
      if (resp.ok) {
        const data = await resp.json();
        if (data.exists) {
          // Email ya existe - mostrar aviso anticipado
          setExistingUserPrompt(true);
        }
      }
    } catch (checkErr: any) {
      console.warn('[ONBOARDING] Error verificando email en onBlur:', checkErr?.message);
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    setIsNewSignup(false);
    setExistingUserPrompt(false);
    setUserNotFound(false);

    // Validate CAPTCHA
    if (!captchaToken) {
      setError('Por favor completa la verificación de seguridad.');
      setLoading(false);
      return;
    }

    // Validate company name and giro for SIGNUP only
    if (currentMode === 'signup' && !company.trim()) {
      setError('El campo empresa es obligatorio.');
      setLoading(false);
      return;
    }
    if (currentMode === 'signup' && !giro) {
      setError('El campo Giro de Negocio es obligatorio.');
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
      
      const normalizedEmail = email.trim().toLowerCase();

      // Pre-chequeo explícito de existencia en Supabase (no confiar en mensaje de error)
      // (Ya puede estar hecho por onBlur, pero lo hacemos de nuevo por seguridad)
      const backendUrl = computeBackendUrl();

      let emailExiste = false;
      try {
        // Usar endpoint backend que consulta con service role
        const resp = await fetch(`${backendUrl}/api/auth/check-email`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ email: normalizedEmail }),
          credentials: 'include',
        });
        if (resp.ok) {
          const data = await resp.json();
          emailExiste = !!data.exists;
        } else {
          // fallback: no bloquear si falla
          console.warn('[ONBOARDING] check-email backend respondió', resp.status);
        }
      } catch (checkErr: any) {
        console.warn('[ONBOARDING] Excepción verificando email existente (backend):', checkErr?.message);
      }

      // Flujo si modo signup y ya existe → mostrar prompt y abortar antes de enviar créditos
      if (currentMode === 'signup' && emailExiste) {
        setExistingUserPrompt(true);
        setLoading(false);
        return;
      }

      // Flujo login y no existe → ofrecer registro
      if (currentMode === 'login' && !emailExiste) {
        setUserNotFound(true);
        setLoading(false);
        return;
      }

      // Ejecutar envío de Magic Link acorde al modo
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: currentMode === 'signup',
          data: currentMode === 'signup' ? {
            name,
            company,
            giro_negocio: giro,
            fraccion_lfpiorpi: (() => {
              const map: Record<string,string> = {
                'Venta de vehículos': 'VIII_vehiculos',
                'Inmobiliaria': 'V_inmuebles',
                'Casas de cambio': 'III_cheques_viajero',
                'Joyeria / Metales': 'VI_joyeria_metales',
                'Servicios generales': 'servicios_generales',
                'Servicios profesionales': 'XI_servicios_profesionales',
                'Activos virtuales / Cripto': 'XVI_activos_virtualos'
              };
              return map[giro] || 'servicios_generales';
            })(),
            balance: 500.0,
          } : undefined,
        },
      });

      if (signInError) {
        // Si ocurre algún error inesperado del proveedor, mostrarlo
        throw signInError;
      }

      // Audit logging happens server-side in auth callback (requires service role key)
      // Client-side audit calls are skipped to avoid exposing service credentials

      // Éxito creación / envío de magic link
      // Marcar nuevo signup sólo si modo signup y no existía previamente
      setIsNewSignup(currentMode === 'signup' && !emailExiste);
      setSuccess(true);
      setLoading(false);

      // Persist profile metadata via backend service (so we have sector/fraccion)
      if (currentMode === 'signup') {
        try {
          await fetch(`${computeBackendUrl()}/api/auth/save-profile`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              email: normalizedEmail,
              sector_actividad: giro,
              fraccion_lfpiorpi: (() => {
                const map: Record<string,string> = {
                  'Venta de vehículos': 'VIII_vehiculos',
                  'Inmobiliaria': 'V_inmuebles',
                  'Casas de cambio': 'III_cheques_viajero',
                  'Joyeria / Metales': 'VI_joyeria_metales',
                  'Servicios generales': 'servicios_generales',
                  'Servicios profesionales': 'XI_servicios_profesionales',
                  'Activos virtuales / Cripto': 'XVI_activos_virtualos'
                };
                return map[giro] || 'servicios_generales';
              })(),
            }),
          });
        } catch (err) {
          console.warn('[ONBOARDING] No se pudo persistir perfil en backend:', err);
        }
      }
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
        {existingUserPrompt ? (
          <div className="text-center py-8 flex flex-col justify-center items-center h-full">
            <div className="text-yellow-400 text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-2 text-yellow-400">Usuario ya existente</h2>
            <p className="text-gray-400 mb-4">El correo ya está registrado. ¿Deseas recibir un Magic Link para ingresar?</p>
            <p className="text-white font-semibold mb-4 bg-gray-800 rounded-lg p-3">{email}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setExistingUserPrompt(false); onClose(); }} className="flex-1 px-6 py-3 bg-gray-700 rounded-lg font-semibold hover:bg-gray-600 transition">Cancelar</button>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { error: loginError } = await supabase.auth.signInWithOtp({
                      email,
                      options: { emailRedirectTo: `${window.location.origin}/auth/redirect`, shouldCreateUser: false }
                    });
                    if (loginError) throw loginError;
                    setExistingUserPrompt(false);
                    setLoginLinkSent(true);
                    setSuccess(true);
                    setCurrentMode('login');
                  } catch (err: any) {
                    setError(err.message || 'Error enviando Magic Link.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold hover:from-blue-700 hover:to-emerald-600 transition"
              >Ingresar</button>
            </div>
          </div>
        ) : userNotFound ? (
          <div className="text-center py-8 flex flex-col justify-center items-center h-full">
            <div className="text-blue-400 text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold mb-2 text-blue-400">Usuario no registrado</h2>
            <p className="text-gray-400 mb-4">No encontramos una cuenta con este correo.</p>
            <p className="text-white font-semibold mb-4 bg-gray-800 rounded-lg p-3">{email}</p>
            <p className="text-gray-400 text-sm mb-6">¿Deseas crear una cuenta nueva?</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setUserNotFound(false); setError(''); }} className="flex-1 px-6 py-3 bg-gray-700 rounded-lg font-semibold hover:bg-gray-600 transition">
                Cancelar
              </button>
              <button onClick={() => { setCurrentMode('signup'); setUserNotFound(false); setError(''); }} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold hover:from-blue-700 hover:to-emerald-600 transition">
                Registrarme
              </button>
            </div>
          </div>
        ) : success ? (
          <div className="text-center py-8 flex flex-col justify-center items-center h-full">
            <div className="text-green-500 text-5xl mb-4">✔️</div>
            <h2 className="text-2xl font-bold mb-2 text-green-400">{loginLinkSent ? '¡Magic Link de Ingreso Enviado!' : '¡Magic Link Enviado!'}</h2>
            <p className="text-gray-400 mb-4">Hemos enviado un enlace seguro a:</p>
            <p className="text-white font-semibold mb-4 bg-gray-800 rounded-lg p-3">{email}</p>
            {isNewSignup && !loginLinkSent && (
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
            
            {/* Caja informativa de login removida a petición del usuario */}
            
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
                onChange={e => {
                  setEmail(e.target.value);
                  // Limpiar prompt de usuario existente al editar
                  if (existingUserPrompt) {
                    setExistingUserPrompt(false);
                  }
                }}
                onBlur={handleEmailBlur}
                required 
                className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-emerald-500 outline-none"
              />
              <p className="text-gray-500 text-xs mt-1">📧 Cualquier dominio de email es aceptado</p>
              {checkingEmail && (
                <p className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                  <span className="animate-pulse">⏳</span> Verificando disponibilidad...
                </p>
              )}
            </div>

            {currentMode === 'signup' && (
              <div>
                <label className="text-gray-400 text-sm">Giro de Negocio</label>
                <select
                  value={giro}
                  onChange={e => setGiro(e.target.value)}
                  required
                  className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-emerald-500 outline-none"
                >
                  <option value="">Selecciona el giro de negocio</option>
                  <option>Venta de vehículos</option>
                  <option>Inmobiliaria</option>
                  <option>Casas de cambio</option>
                  <option>Joyeria / Metales</option>
                  <option>Servicios generales</option>
                  <option>Servicios profesionales</option>
                  <option>Activos virtuales / Cripto</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">Selecciona el giro que mejor describa tu negocio. Este dato es obligatorio.</p>
              </div>
            )}
            
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
