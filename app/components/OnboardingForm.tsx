import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { logAuditEvent } from '../lib/audit-log';
import { Turnstile } from '@marsidev/react-turnstile';

// Inline logo for modal consistency
const TarantulaHawkLogo = ({ className = "w-10 h-10 mb-4 mx-auto" }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#CC3300'}} />
        <stop offset="50%" style={{stopColor: '#FF4500'}} />
        <stop offset="100%" style={{stopColor: '#FF6B00'}} />
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
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: currentMode === 'signup',
          data: currentMode === 'signup' ? {
            name,
            company,
            balance: 500.0,
          } : undefined,
        },
      });

      if (signInError) {
        // Check if user doesn't exist (only in login mode)
        if (currentMode === 'login' && (
          signInError.message.includes('User not found') || 
          signInError.message.includes('Signups not allowed') ||
          signInError.message.includes('signups not allowed')
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

      // Log audit event (only for signup)
      if (currentMode === 'signup') {
        try {
          await logAuditEvent({
            user_id: null, // User not created yet, will be created on Magic Link click
            action: 'registration',
            metadata: {
              email,
              company,
              registration_method: 'magic_link',
            },
            status: 'pending',
          });
        } catch (auditError) {
          // Non-critical error, continue with signup flow
          console.warn('Audit log failed:', auditError);
        }
      }

      setSuccess(true);
      setLoading(false);
    } catch (error: any) {
      setError(error.message || 'Error al procesar tu solicitud. Por favor intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-6 right-8 text-gray-500 hover:text-white text-2xl">×</button>
        <TarantulaHawkLogo />
        {currentMode === 'signup' ? (
          <>
            <h2 className="text-2xl font-black mb-2 text-center bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">
              Regístrate y Obtén $500 USD Gratis
            </h2>
            <p className="text-gray-400 text-center mb-6">
              Crea tu cuenta y recibe $500 USD en créditos virtuales para probar la plataforma de AML. Sin tarjeta de crédito.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black mb-4 text-center bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">
              TarantulaHawk
            </h2>
            {/* Login mode: we intentionally remove the descriptive subtitle for a cleaner look */}
          </>
        )}
        {success ? (
          <div className="text-center py-12">
            <div className="text-green-500 text-5xl mb-4">�</div>
              <h2 className="text-2xl font-bold mb-2 text-green-400">¡Magic Link Enviado!</h2>
              <p className="text-gray-400 mb-4">Hemos enviado un enlace seguro a:</p>
            <p className="text-white font-semibold mb-4 bg-gray-800 rounded-lg p-3">{email}</p>
            
            {currentMode === 'signup' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                <h3 className="text-green-400 font-semibold mb-2">🎁 $500 USD en Créditos Virtuales</h3>
                <ul className="text-gray-400 text-sm text-left space-y-1">
                  <li>✅ Créditos inmediatos al activar tu cuenta</li>
                  <li>✅ Prueba todas las funcionalidades de AML</li>
                  <li>✅ Sin compromiso ni tarjeta de crédito</li>
                  <li>✅ Análisis de transacciones ilimitados</li>
                </ul>
              </div>
            )}
            
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
              <h3 className="text-blue-400 font-semibold mb-2">🛡️ Seguridad Mejorada</h3>
              <ul className="text-gray-400 text-sm text-left space-y-1">
                <li>✅ Sin contraseñas - sin riesgo de phishing</li>
                <li>✅ Magic Link de un solo uso</li>
                <li>✅ Validación CAPTCHA contra bots</li>
                <li>✅ Acceso seguro en segundos</li>
              </ul>
            </div>
            
            <p className="text-gray-500 text-sm mb-6">
              <strong>Paso siguiente:</strong> Revisa tu bandeja de entrada y haz clic en el Magic Link.
              <br />
              ⏱️ <strong>El enlace expira en 10 minutos</strong> y solo puede usarse una vez por seguridad.
            </p>
            
            <button onClick={onClose} className="px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition w-full">
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-center text-sm">
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
                    className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-orange-500 outline-none" 
                  />
                </div>
                
                <div>
                  <input 
                    type="text" 
                    placeholder="Empresa / Organización" 
                    value={company} 
                    onChange={e => setCompany(e.target.value)} 
                    required 
                    className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-orange-500 outline-none" 
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
                className="w-full rounded-md bg-gray-800 border border-gray-700 text-white p-3 focus:border-orange-500 outline-none"
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
              className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-bold hover:from-red-700 hover:to-orange-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
