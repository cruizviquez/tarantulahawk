'use client';

import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import OnboardingForm from './OnboardingForm';
import AIChat from './AIChat';
import { Shield, Zap, CheckCircle } from 'lucide-react';

const TarantulaHawkLogo = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="TarantulaHawk logo">
    <defs>
      <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#3b82f6' }} />
        <stop offset="50%" style={{ stopColor: '#06b6d4' }} />
        <stop offset="100%" style={{ stopColor: '#10b981' }} />
      </linearGradient>
      <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#00CED1' }} />
        <stop offset="50%" style={{ stopColor: '#20B2AA' }} />
        <stop offset="100%" style={{ stopColor: '#48D1CC' }} />
      </linearGradient>
    </defs>
    <circle cx="200" cy="200" r="190" fill="none" stroke="url(#tealGrad)" strokeWidth="3" opacity="0.4" />
    <ellipse cx="200" cy="230" rx="35" ry="85" fill="#0A0A0A" />
    <ellipse cx="200" cy="170" rx="18" ry="20" fill="#0F0F0F" />
    <ellipse cx="200" cy="145" rx="32" ry="35" fill="#0F0F0F" />
    <ellipse cx="200" cy="110" rx="22" ry="20" fill="#0A0A0A" />
    <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#orangeGrad)" opacity="0.95" />
    <ellipse cx="200" cy="245" rx="30" ry="9" fill="url(#orangeGrad)" opacity="0.9" />
    <ellipse cx="200" cy="270" rx="27" ry="8" fill="url(#orangeGrad)" opacity="0.85" />
    <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#orangeGrad)" opacity="0.9" />
    <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#orangeGrad)" opacity="0.9" />
    <path d="M 200 305 L 197 330 L 200 350 L 203 330 Z" fill="url(#orangeGrad)" />
    <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1" />
    <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1" />
  </svg>
);

type AuthError =
  | 'timeout'
  | 'link_expired'
  | 'link_used'
  | 'link_invalid'
  | 'signin_failed'
  | string;

export default function TarantulaHawkWebsite({ authError }: { authError?: AuthError }) {
  // Enfoque 100% México: dejamos el sitio en ES (SEO + claridad para sujetos obligados)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'signup' | 'login'>('signup');
  const [showAuthError, setShowAuthError] = useState(!!authError);

  const errorInfo = useMemo(() => {
    if (!authError) return null;

    const messages: Record<
      string,
      { title: string; message: string }
    > = {
      timeout: {
        title: 'Sesión expirada por inactividad',
        message: 'Por seguridad, tu sesión se cerró tras 15 minutos sin actividad. Inicia sesión de nuevo para continuar.',
      },
      link_expired: {
        title: 'Magic Link expirado',
        message: 'El enlace de autenticación expiró. Solicita uno nuevo para ingresar.',
      },
      link_used: {
        title: 'Magic Link ya utilizado',
        message: 'Este enlace ya fue utilizado. Por seguridad, solicita uno nuevo.',
      },
      link_invalid: {
        title: 'Magic Link inválido',
        message: 'El enlace es inválido. Verifica el link o solicita uno nuevo.',
      },
      signin_failed: {
        title: 'Error de autenticación',
        message: 'No se pudo completar la autenticación. Intenta de nuevo.',
      },
    };

    return messages[authError] || messages.link_expired;
  }, [authError]);

  const openChat = () => {
    const chatButton = document.querySelector('[role="chat-button"]') as HTMLButtonElement | null;
    if (chatButton) chatButton.click();
  };

  const seo = useMemo(() => {
    const title =
      'TarantulaHawk | Sistema PLD para Sujetos Obligados (LFPIORPI Art. 17) – México';
    const description =
      'Software PLD (Prevención de Lavado de Dinero) para sujetos obligados en México. Automatiza monitoreo de operaciones, evaluación de riesgo, reportes/expedientes y preparación de avisos conforme a la LFPIORPI (Artículo 17).';
    const canonical = 'https://tarantulahawk.cloud/';
    const keywords = [
      'sistema plD',
      'prevención de lavado de dinero',
      'software pld méxico',
      'lfpiorpi',
      'artículo 17 lfpiorpi',
      'sujetos obligados',
      'actividades vulnerables',
      'avisos pld shcp',
      'monitoreo de operaciones',
      'cumplimiento pld',
      'plataforma pld',
      'auditoría pld',
    ].join(', ');

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'TarantulaHawk',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        description: 'Registro gratuito y uso por consumo (según plan).',
      },
      description,
      keywords,
      audience: {
        '@type': 'Audience',
        audienceType: 'Sujetos obligados y responsables de cumplimiento en México (LFPIORPI).',
      },
      url: canonical,
      publisher: {
        '@type': 'Organization',
        name: 'TarantulaHawk',
        url: canonical,
      },
    };

    return { title, description, canonical, keywords, jsonLd };
  }, []);

  const capabilityLegend = useMemo(
    () => [
      { key: 'green', label: 'Automatizado por TarantulaHawk', dot: 'bg-green-500' },
      { key: 'blue', label: 'Parcial (asistencia + trazabilidad)', dot: 'bg-blue-500' },
      { key: 'gray', label: 'Proceso interno del sujeto obligado', dot: 'bg-gray-500' },
    ],
    []
  );

  const colorDotClass = (color: 'green' | 'blue' | 'gray') => {
    if (color === 'green') return 'bg-green-500';
    if (color === 'blue') return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const colorTileGradient = (color: 'green' | 'blue' | 'gray') => {
    if (color === 'green') return 'from-green-600 to-teal-500';
    if (color === 'blue') return 'from-blue-600 to-blue-500';
    return 'from-blue-600 to-emerald-500';
  };

  const lfpiorpiCapabilities = useMemo(
    () =>
      [
        {
          num: '1',
          title: 'Identificación y expediente de clientes',
          desc: 'Centraliza y resguarda evidencia y documentación por cliente/operación (trazabilidad y control).',
          color: 'blue',
        },
        {
          num: '2',
          title: 'Monitoreo de operaciones y señales de riesgo',
          desc: 'Detecta patrones y comportamientos relevantes para PLD con reglas + IA (alertas y priorización).',
          color: 'green',
        },
        {
          num: '3',
          title: 'Perfilamiento y evaluación de riesgo',
          desc: 'Scoring de riesgo por cliente y por operación con explicabilidad para auditoría interna.',
          color: 'green',
        },
        {
          num: '4',
          title: 'Evidencia lista para auditoría / visita de verificación',
          desc: 'Expedientes, bitácoras, KPIs y reportes para facilitar revisiones y controles.',
          color: 'green',
        },
        {
          num: '5',
          title: 'Conservación y custodia de información y reportes',
          desc: 'Retención cifrada, control de acceso y trazabilidad (alineado a conservación de información).',
          color: 'blue',
        },
        {
          num: '6',
          title: 'Preparación de avisos y reportes',
          desc: 'Tarantulahawk genera en automático el reporte XML para la UIF; integra validaciones y controles previos.',
          color: 'blue',
        },
      ] as const,
    []
  );

  return (
    <>
      <Head>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords} />
        <link rel="canonical" href={seo.canonical} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={seo.canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(seo.jsonLd) }} />
      </Head>

      {/* Auth Error Toast */}
      {showAuthError && errorInfo && (
        <div className="fixed top-20 right-6 z-[9999] animate-fade-in">
          <div className="bg-emerald-500/90 backdrop-blur-sm border border-emerald-400 rounded-lg p-4 shadow-2xl max-w-md">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔒</div>
              <div className="flex-1">
                <h3 className="font-bold text-white mb-1">{errorInfo.title}</h3>
                <p className="text-sm text-white/90">{errorInfo.message}</p>
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setOnboardingMode('login');
                      setShowOnboarding(true);
                    }}
                    className="px-4 py-2 bg-black/20 border border-white/30 rounded-lg text-sm font-semibold hover:bg-black/30 text-white"
                  >
                    Iniciar sesión
                  </button>
                </div>
              </div>
              <button onClick={() => setShowAuthError(false)} className="text-white/80 hover:text-white text-xl leading-none">
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-black text-white">
        <nav className="fixed top-0 w-full bg-black/95 backdrop-blur-sm border-b border-gray-800 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <a href="/" aria-label="TarantulaHawk home" className="flex items-center gap-3">
                <TarantulaHawkLogo />
                <span className="text-xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                  TARANTULAHAWK
                </span>
              </a>

              <div className="flex items-center gap-8">
                <nav className="hidden md:flex items-center gap-6">
                  <a
                    href="/sistema-prevencion-lavado-dinero-lfpiopri#sujetos-obligados"
                    className="text-gray-300 hover:text-white lg:pl-0 lg:border-l-0 lg:border-0 transition lg:duration-150"
                  >
                    Sujetos obligados
                  </a>
                  <span className="hidden md:inline lg:hidden text-gray-500">•</span>
                  <a href="#solucion" className="text-gray-300 hover:text-white lg:pl-4 lg:border-l lg:border-gray-800 lg:hover:border-teal-400 lg:transition-colors">
                    Solución
                  </a>
                  <span className="hidden md:inline lg:hidden text-gray-500">•</span>
                  <a href="#como-funciona" className="text-gray-300 hover:text-white lg:pl-4 lg:border-l lg:border-gray-800 lg:hover:border-teal-400 lg:transition-colors">
                    Cómo funciona
                  </a>
                  <span className="hidden md:inline lg:hidden text-gray-500">•</span>
                  <a href="#lfpiorpi" className="text-gray-300 hover:text-white lg:pl-4 lg:border-l lg:border-gray-800 lg:hover:border-teal-400 lg:transition-colors">
                    LFPIORPI
                  </a>
                  <span className="hidden md:inline lg:hidden text-gray-500">•</span>
                  <a href="#about" className="text-gray-300 hover:text-white lg:pl-4 lg:border-l lg:border-gray-800 lg:hover:border-teal-400 lg:transition-colors">
                    Acerca de
                  </a>
                  <span className="hidden md:inline lg:hidden text-gray-500">•</span>
                  <button onClick={openChat} className="text-gray-300 hover:text-white lg:pl-4 lg:border-l lg:border-gray-800 lg:hover:border-teal-400 lg:transition-colors">
                    Chat
                  </button>
                </nav>

                <div className="flex items-center gap-4">
                  <button
                    className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold text-sm hover:from-emerald-700 hover:to-emerald-500 transition"
                    onClick={() => {
                      setOnboardingMode('login');
                      setShowOnboarding(true);
                    }}
                  >
                    Ingresar
                  </button>
                  <button
                    className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold text-sm hover:from-emerald-700 hover:to-emerald-500 transition"
                    onClick={() => {
                      setOnboardingMode('signup');
                      setShowOnboarding(true);
                    }}
                  >
                    Registrarse
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section id="hero" className="pt-32 pb-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-600/20 rounded-full mb-8">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-cyan-400">PLD con IA • Evidencia auditable • Implementación rápida</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-black mb-6">
                <span className="text-white">
                  Sistema de Prevención de Lavado de Dinero
                  <br />
                  para Sujetos Obligados (LFPIORPI)
                </span>
              </h1>

              <h2 className="text-2xl md:text-3xl text-white font-bold mb-6">
                Cumple con el Artículo 17 con automatización, trazabilidad y control
              </h2>

              <p className="text-xl text-gray-400 max-w-4xl mx-auto mb-12">
                TarantulaHawk es un <strong>software PLD para México</strong> diseñado para sujetos obligados.
                Centraliza información, <strong>monitorea operaciones</strong>, evalúa <strong>riesgo PLD</strong> y
                genera expedientes y reportes para auditoría interna y visitas de verificación.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold text-lg hover:from-emerald-700 hover:to-emerald-500 transition"
                  onClick={() => {
                    setOnboardingMode('signup');
                    setShowOnboarding(true);
                  }}
                >
                  Registrarse gratis
                </button>
                <button
                  onClick={openChat}
                  className="px-8 py-4 border-2 border-teal-500 rounded-lg font-bold text-lg hover:bg-teal-500/10 transition"
                >
                  Agenda una demo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20">
              <div className="text-center">
                <div className="text-4xl font-black text-blue-500 mb-2">&lt;100ms</div>
                <div className="text-gray-400">Tiempo de procesamiento</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-emerald-500 mb-2">&gt;99%</div>
                <div className="text-gray-400">Precisión de detección</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-teal-400 mb-2">3-Capas</div>
                <div className="text-gray-400">Architectura de IA</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black text-teal-400 mb-2">24/7</div>
                <div className="text-gray-400">Soporte y Monitoreo</div>
              </div>
            </div>
          </div>

          {/* SEO helper content (hidden, helps long-tail search without afectar el diseño) */}
          <div className="sr-only">
            <h2>Sistema PLD México para LFPIORPI</h2>
            <p>
              TarantulaHawk es un sistema de prevención de lavado de dinero (PLD) para México. Enfocado a sujetos obligados y
              actividades vulnerables para cumplir LFPIORPI, Artículo 17, con monitoreo de operaciones, evaluación de riesgo y
              expedientes auditables.
            </p>
          </div>
        </section>

        {/* SOLUCIÓN */}
        <section id="solucion" className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black mb-4">
                <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                  Una plataforma PLD clara, práctica y lista para auditoría
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-4xl mx-auto mb-10">
                Diseñada para el mercado mexicano y para el trabajo real del oficial de cumplimiento: datos en orden, riesgos explicables,
                evidencia trazable y reportes consistentes.
              </p>

              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 flex items-center justify-center">
                      <span className="font-black">1</span>
                    </div>
                    <h3 className="text-lg font-bold">Monitoreo + alertas útiles</h3>
                  </div>
                  <p className="text-gray-400">
                    Detección y priorización de señales de riesgo para reducir ruido y enfocar investigación interna.
                  </p>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
                      <span className="font-black">2</span>
                    </div>
                    <h3 className="text-lg font-bold">Expedientes y evidencia</h3>
                  </div>
                  <p className="text-gray-400">
                    Bitácoras, historial y documentos organizados por cliente/operación para auditoría y visitas de verificación.
                  </p>
                </div>

                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center">
                      <span className="font-black">3</span>
                    </div>
                    <h3 className="text-lg font-bold">Implementación rápida</h3>
                  </div>
                  <p className="text-gray-400">
                    Empieza con archivo (Excel/CSV) o integra por API. Diseñado para crecer contigo sin proyectos eternos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section id="como-funciona" className="py-20 px-6 bg-gray-900/50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black mb-4">Cómo funciona</h2>
              <p className="text-xl text-gray-400">Tres pasos simples para operar PLD con orden y evidencia</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <span className="text-2xl font-black text-white">1</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Centraliza tus datos</h3>
                <p className="text-gray-400">
                  Carga operaciones (Excel/CSV) o conecta por API. Estandariza campos, valida consistencia y crea historial por cliente.
                </p>
              </div>

              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <span className="text-2xl font-black text-white">2</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Evalúa riesgo PLD</h3>
                <p className="text-gray-400">
                  El sistema identifica señales, patrones y anomalías, asigna puntajes de riesgo y recomienda priorización de casos.
                </p>
              </div>

              <div className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <span className="text-2xl font-black text-white">3</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">Genera evidencia y reportes</h3>
                <p className="text-gray-400">
                  Expide reportes y expedientes auditablemente: bitácoras, KPIs, documentación y paquetes listos para revisión.
                </p>
              </div>
            </div>

            <div className="mt-16 text-center">
              <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-600/30 rounded-2xl">
                <span className="text-2xl">⚡</span>
                <div className="text-left">
                  <div className="font-bold text-green-400">Implementación sin fricción</div>
                  <div className="text-sm text-gray-400">Empieza con archivo hoy. Integra por API cuando estés listo.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MODELOS IA */}
        <section className="py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-black mb-4">
                <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                  IA aplicada a PLD (sin perder explicabilidad)
                </span>
              </h2>
              <p className="text-xl text-gray-400">
                Modelos que ayudan a priorizar riesgo, reducir falsos positivos y mantener trazabilidad para auditoría.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-black text-white">S</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-blue-400">Aprendizaje supervisado</h3>
                <p className="text-gray-400">
                  Aprende de casos históricos (etiquetados) para identificar comportamientos similares con consistencia.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-black text-white">U</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-green-400">Aprendizaje no supervisado</h3>
                <p className="text-gray-400">
                  Detecta anomalías y patrones emergentes para fortalecer controles sin depender solo de reglas estáticas.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-black text-white">R</span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-emerald-400">Aprendizaje por refuerzo</h3>
                <p className="text-gray-400">
                  Mejora con retroalimentación del equipo de cumplimiento (investigación interna) para afinar priorización.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* LFPIORPI */}
        <section id="lfpiorpi" className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-black mb-4">Cumplimiento LFPIORPI (Artículo 17)</h2>
              <p className="text-xl text-gray-400 max-w-4xl mx-auto mb-4">
                TarantulaHawk facilita el trabajo operativo del sujeto obligado: ordena información, automatiza análisis y genera evidencia.
                La plataforma está pensada para apoyar procesos internos de cumplimiento PLD con enfoque en auditoría.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-600/30 rounded-full mb-8">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">
                  El sujeto obligado mantiene la responsabilidad legal del cumplimiento y de sus decisiones
                </span>
              </div>
            </div>

            <div className="mb-10 max-w-5xl mx-auto">
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                <h3 className="text-lg font-bold mb-4 text-white">Capacidades (enfoque Art. 17)</h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  {capabilityLegend.map((x) => (
                    <div key={x.key} className="flex items-center gap-3">
                      <div className={`w-3 h-3 ${x.dot} rounded-full`} />
                      <span className="text-gray-300">{x.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {lfpiorpiCapabilities.map((item, idx) => (
                <div key={idx} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={`w-12 h-12 bg-gradient-to-br ${colorTileGradient(item.color)} rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <span className="text-white font-black text-lg">{item.num}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-sm text-gray-400 mb-3">{item.desc}</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${colorDotClass(item.color)} rounded-full`} />
                        <span className="text-xs text-gray-400">
                          {item.color === 'green'
                            ? 'Automatizado por TarantulaHawk'
                            : item.color === 'blue'
                            ? 'Parcial (asistencia + trazabilidad)'
                            : 'Proceso interno del sujeto obligado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-6 mb-8">
              <h3 className="text-lg font-bold mb-3 text-cyan-400">Aviso legal importante</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                TarantulaHawk es una plataforma tecnológica de PLD que facilita procesos operativos de cumplimiento. El sujeto obligado
                permanece total y únicamente responsable del cumplimiento con la LFPIORPI y de todas las obligaciones aplicables. Esta
                plataforma no proporciona asesoría legal y no asume responsabilidad por resultados de cumplimiento. Consulta con tu
                equipo legal y expertos de cumplimiento para decisiones regulatorias.
              </p>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-black mb-6">Acerca de TarantulaHawk</h2>
            <p className="text-xl text-gray-400 mb-12">
              TarantulaHawk es un sistema de prevención de lavado de dinero diseñado para el mercado mexicano. Nuestro enfoque es hacer
              el cumplimiento más claro y eficiente: menos trabajo manual, mejor evidencia y decisiones con trazabilidad.
            </p>

            <div className="bg-black border border-gray-800 rounded-2xl p-8">
              <h3 className="text-2xl font-bold mb-6">Lo que nos hace diferentes</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-3 text-left">
                  <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <span className="text-gray-300">Enfoque 100% México: LFPIORPI, sujetos obligados y actividades vulnerables.</span>
                </div>
                <div className="flex items-start gap-3 text-left">
                  <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <span className="text-gray-300">Evidencia y trazabilidad para auditoría (bitácoras, expedientes, KPIs).</span>
                </div>
                <div className="flex items-start gap-3 text-left">
                  <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <span className="text-gray-300">Alertas priorizadas y explicables para reducir ruido operativo.</span>
                </div>
                <div className="flex items-start gap-3 text-left">
                  <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                  <span className="text-gray-300">Arranque rápido: archivo hoy, API mañana (cuando tu operación lo requiera).</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl font-black mb-4">¿Listo para ordenar tu operación PLD?</h2>
            <p className="text-xl text-gray-400 mb-8">
              Empieza en minutos. Si quieres, hacemos una demo enfocada a tu actividad vulnerable y tu operación real.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  setOnboardingMode('login');
                  setShowOnboarding(true);
                }}
                className="px-10 py-5 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold text-xl hover:from-emerald-700 hover:to-emerald-600 transition shadow-2xl shadow-emerald-500/50"
              >
                Acceder a la plataforma
              </button>
              <button
                onClick={openChat}
                className="px-10 py-5 border-2 border-teal-500 rounded-lg font-bold text-xl hover:bg-teal-500/10 transition"
              >
                Hablar con un especialista
              </button>
            </div>
          </div>
        </section>

        <footer className="border-t border-gray-800 py-12 px-6">
          <div className="max-w-7xl mx-auto text-center text-gray-500">
            <p>2025 TarantulaHawk. Todos los derechos reservados.</p>
            <p className="mt-2 text-sm">
              Sistema PLD México | Software de Prevención de Lavado de Dinero | LFPIORPI Artículo 17 | Sujetos obligados
            </p>
            <div className="mt-4">
              <a
                href="/sistema-prevencion-lavado-dinero-lfpiopri"
                className="text-sm text-teal-400 hover:text-teal-300 hover:underline"
              >
                Guía: Sistema PLD para Sujetos Obligados (LFPIORPI Artículo 17)
              </a>
            </div>
            <p className="mt-1 text-sm">Evidencia auditable • Monitoreo de operaciones • Evaluación de riesgo • Expedientes</p>
          </div>
        </footer>
      </div>

      <AIChat language={'es'} />

      {showOnboarding && <OnboardingForm onClose={() => setShowOnboarding(false)} mode={onboardingMode} />}
    </>
  );
}
