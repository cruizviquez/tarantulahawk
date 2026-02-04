'use client';

import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import OnboardingForm from './OnboardingForm';
import AIChat from './AIChat';
import { 
  Shield, 
  Zap, 
  Brain, 
  Lock, 
  BarChart3, 
  Users, 
  FileText, 
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Database,
  Cpu,
  Network,
  AlertTriangle,
  Eye,
  Clock
} from 'lucide-react';

type AuthError =
  | 'timeout'
  | 'link_expired'
  | 'invalid_request'
  | 'access_denied'
  | 'server_error'
  | 'unverified_email'
  | 'unknown'
  | string;

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



export default function TarantulaHawkWebsite({ authError }: { authError?: AuthError }) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'signup' | 'login'>('signup');

  const seo = useMemo(() => ({
    title: 'TarantulaHawk | El Sistema PLD Más Avanzado del Mundo – IA + Compliance México',
    description: 'Sistema PLD de próxima generación con 3 modelos de IA, análisis en tiempo real y cumplimiento automático LFPIORPI. KYC, monitoreo transaccional, reportes UIF y detección de anomalías con machine learning.',
    keywords: 'sistema PLD México, inteligencia artificial lavado dinero, LFPIORPI automático, KYC avanzado, detección anomalías ML, reportes UIF, compliance automatizado, actividades vulnerables',
    canonical: 'https://tarantulahawk.ai/',
  }), []);

  return (
    <>
      <Head>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords} />
        <link rel="canonical" href={seo.canonical} />
      </Head>

      {showOnboarding && (
        <OnboardingForm 
          mode={onboardingMode} 
          onClose={() => setShowOnboarding(false)} 
        />
      )}

      <div className="min-h-screen bg-black text-white">
        {/* NAVIGATION */}
        <nav className="fixed top-0 w-full bg-black/95 backdrop-blur-sm border-b border-gray-800 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="flex items-center gap-3">
                <TarantulaHawkLogo />
                <span className="text-xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  TARANTULAHAWK
                </span>
              </a>

              <div className="flex items-center gap-8">
                <nav className="hidden md:flex items-center gap-6">
                  <a href="#tecnologia" className="text-gray-300 hover:text-emerald-400 transition">Tecnología</a>
                  <a href="#plataforma" className="text-gray-300 hover:text-emerald-400 transition">Plataforma</a>
                  <a href="#precio" className="text-gray-300 hover:text-emerald-400 transition">Precio</a>
                  <a href="/blog" className="text-gray-300 hover:text-emerald-400 transition">Blog</a>
                </nav>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setOnboardingMode('login'); setShowOnboarding(true); }}
                    className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition"
                  >
                    Ingresar
                  </button>
                  <button
                    onClick={() => { setOnboardingMode('signup'); setShowOnboarding(true); }}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold text-sm hover:from-emerald-600 hover:to-emerald-400 transition"
                  >
                    Prueba Gratis
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="pt-32 pb-20 px-6 relative overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500 rounded-full filter blur-3xl animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full filter blur-3xl animate-pulse delay-1000"></div>
          </div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-8">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-semibold">Tecnología de próxima generación</span>
              </div>

              <h1 className="text-6xl md:text-8xl font-black mb-6 leading-tight">
                <span className="bg-gradient-to-r from-white via-emerald-200 to-cyan-200 bg-clip-text text-transparent">
                  El Sistema PLD
                  <br />
                  Más Avanzado
                  <br />
                  del Mundo
                </span>
              </h1>

              <p className="text-2xl md:text-3xl text-gray-300 max-w-4xl mx-auto mb-8 font-light">
                Inteligencia artificial de nivel empresarial que detecta lavado de dinero 
                con <span className="text-emerald-400 font-semibold">99.7% de precisión</span>
              </p>

              <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-12">
                Triple motor de IA + análisis en tiempo real + cumplimiento automático LFPIORPI. 
                La única plataforma que combina machine learning supervisado, detección de anomalías 
                y explicabilidad con LLM en un solo sistema.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                <button
                  onClick={() => { setOnboardingMode('signup'); setShowOnboarding(true); }}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-emerald-400 transition shadow-xl shadow-emerald-500/20"
                >
                  Comenzar Ahora →
                </button>
                <button className="px-8 py-4 border-2 border-emerald-500 rounded-xl font-bold text-lg hover:bg-emerald-500/10 transition">
                  Ver Demo en Vivo
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
                <div className="text-center">
                  <div className="text-4xl font-black text-emerald-400 mb-2">3</div>
                  <div className="text-sm text-gray-400">Modelos de IA</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-blue-400 mb-2">&lt;100ms</div>
                  <div className="text-sm text-gray-400">Análisis Tiempo Real</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-cyan-400 mb-2">99.7%</div>
                  <div className="text-sm text-gray-400">Precisión Detección</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-black text-purple-400 mb-2">100%</div>
                  <div className="text-sm text-gray-400">Compliance LFPIORPI</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TECNOLOGÍA */}
        <section id="tecnologia" className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Arquitectura de IA sin Precedentes
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Lo que ningún otro sistema PLD tiene: tres motores de inteligencia artificial trabajando en conjunto
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-16">
              {/* Modelo 1 */}
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-2xl p-8 hover:border-blue-400/50 transition">
                <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mb-6">
                  <Brain className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-blue-400">Modelo Supervisado</h3>
                <p className="text-gray-300 mb-4">
                  Clasificación automática de operaciones en tiempo real. Detecta patrones conocidos de lavado con precisión quirúrgica.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>Clasificación en &lt;100ms</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>Entrenado con +1M operaciones</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span>Actualización continua</span>
                  </li>
                </ul>
              </div>

              {/* Modelo 2 */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/30 rounded-2xl p-8 hover:border-emerald-400/50 transition">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
                  <Network className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-emerald-400">Detección de Anomalías</h3>
                <p className="text-gray-300 mb-4">
                  Descubre patrones nunca antes vistos. El sistema aprende el comportamiento normal y detecta desviaciones automáticamente.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>Clustering inteligente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>Perfil transaccional por cliente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span>Detección de nuevas amenazas</span>
                  </li>
                </ul>
              </div>

              {/* Modelo 3 */}
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-2xl p-8 hover:border-purple-400/50 transition">
                <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6">
                  <Sparkles className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-purple-400">LLM Explicabilidad</h3>
                <p className="text-gray-300 mb-4">
                  Lenguaje natural que explica cada decisión. Auditoría transparente con justificación automática de alertas.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>Reportes en lenguaje humano</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>Evidencia auditable</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>Chat con tus datos PLD</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* EBR - Escala Basada en Riesgo */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-10">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-bold mb-3">EBR Automático con Machine Learning</h3>
                  <p className="text-gray-300 mb-6">
                    Nuestro sistema calcula la Escala Basada en Riesgo utilizando <strong>7 factores clave</strong> como features 
                    para un modelo de ensemble que detecta anomalías de comportamiento en tiempo real.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                      <div>
                        <div className="font-semibold text-emerald-400">Listas Negras (5 fuentes)</div>
                        <div className="text-sm text-gray-400">OFAC, CSNU, UIF, 69B, PEPs</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                      <div>
                        <div className="font-semibold text-emerald-400">Sector de Actividad</div>
                        <div className="text-sm text-gray-400">16 actividades vulnerables Art. 17</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                      <div>
                        <div className="font-semibold text-emerald-400">Tipo de Persona</div>
                        <div className="text-sm text-gray-400">Física/Moral + estructura corporativa</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                      <div>
                        <div className="font-semibold text-emerald-400">Origen de Recursos</div>
                        <div className="text-sm text-gray-400">Documentación y verificación</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                      <div>
                        <div className="font-semibold text-emerald-400">Ubicación Geográfica</div>
                        <div className="text-sm text-gray-400">Análisis de riesgo por estado</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                      <div>
                        <div className="font-semibold text-emerald-400">Monto Mensual Estimado</div>
                        <div className="text-sm text-gray-400">Umbrales dinámicos en UMAs</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                      <div>
                        <div className="font-semibold text-emerald-400">Historial Transaccional</div>
                        <div className="text-sm text-gray-400">Comportamiento 6 meses</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLATAFORMA - Screenshots */}
        <section id="plataforma" className="py-20 px-6 bg-black">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Plataforma Completa de Compliance
                </span>
              </h2>
              <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                Todo lo que necesitas para cumplir con LFPIORPI desde un solo lugar
              </p>
            </div>

            <div className="space-y-20">
              {/* Dashboard */}
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full mb-4">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-blue-400 font-semibold">Dashboard Regulatorio</span>
                  </div>
                  <h3 className="text-3xl font-bold mb-4">Métricas de Cumplimiento en Tiempo Real</h3>
                  <p className="text-gray-400 mb-6">
                    Visualiza tu compliance score, alertas pendientes, próximo reporte UIF y distribución de riesgo 
                    de tus clientes. Todo actualizado al segundo.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Score de cumplimiento 0-100 con alertas automáticas</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Distribución de clientes por nivel de riesgo (EBR)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Clasificación automática de operaciones</span>
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                  <img 
                    src="/Dashboard.webp" 
                    alt="Dashboard TarantulaHawk"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Clientes & KYC */}
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                  <img 
                    src="/Clientes KYC.webp" 
                    alt="Clientes y KYC"
                    className="w-full"
                  />
                </div>
                <div className="order-1 md:order-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-4">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-semibold">Clientes & KYC</span>
                  </div>
                  <h3 className="text-3xl font-bold mb-4">Expedientes Digitales con Validación Automática</h3>
                  <p className="text-gray-400 mb-6">
                    OCR de INE/Pasaporte, búsqueda en 5 listas negras, cálculo automático de EBR y gestión 
                    completa de documentos. Todo en un solo expediente digital.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">OCR automático de datos (nombre, RFC, CURP)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Verificación en OFAC, CSNU, UIF, 69B, PEPs</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">EBR calculado por IA con 7 factores</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Operaciones */}
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full mb-4">
                    <TrendingUp className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-purple-400 font-semibold">Monitoreo Transaccional</span>
                  </div>
                  <h3 className="text-3xl font-bold mb-4">Registro y Análisis en Tiempo Real</h3>
                  <p className="text-gray-400 mb-6">
                    Cada operación se analiza al momento con 3 modelos de IA. Acumulación automática 6 meses, 
                    validación de umbrales UMAs y alertas instantáneas.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Análisis ML en &lt;100ms por operación</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Validación automática de umbrales en UMAs</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Histórico acumulado y perfil transaccional</span>
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                  <img 
                    src="/Editar Operaciones.webp" 
                    alt="Operaciones"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Reportes UIF */}
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 rounded-xl overflow-hidden border border-gray-800 shadow-2xl">
                  <img 
                    src="/Reportes UIF.webp" 
                    alt="Reportes UIF"
                    className="w-full"
                  />
                </div>
                <div className="order-1 md:order-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full mb-4">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-cyan-400 font-semibold">Reportes UIF</span>
                  </div>
                  <h3 className="text-3xl font-bold mb-4">Generación Automática de XML UIF</h3>
                  <p className="text-gray-400 mb-6">
                    Selecciona el periodo, revisa las operaciones relevantes y genera el XML oficial 
                    para el SAT en un solo click. Cumplimiento garantizado.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">XML compatible con portal SPPLD del SAT</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Avisos mensuales y avisos 24 horas</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">Historial completo de reportes enviados</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CARACTERÍSTICAS ÚNICAS */}
        <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Lo Que Nos Hace Únicos
                </span>
              </h2>
              <p className="text-xl text-gray-400">Capacidades que ningún otro sistema PLD en el mundo ofrece</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-emerald-500/50 transition">
                <Clock className="w-10 h-10 text-emerald-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">Análisis en &lt;100ms</h3>
                <p className="text-gray-400 text-sm">
                  Cada operación se analiza en tiempo real. No hay esperas, no hay batches. Resultados instantáneos.
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-emerald-500/50 transition">
                <Eye className="w-10 h-10 text-blue-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">Explicabilidad Total</h3>
                <p className="text-gray-400 text-sm">
                  LLM genera explicación en lenguaje natural de cada alerta. Auditoría transparente y justificada.
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-emerald-500/50 transition">
                <Network className="w-10 h-10 text-purple-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">Detección Predictiva</h3>
                <p className="text-gray-400 text-sm">
                  El sistema aprende y detecta amenazas nunca antes vistas. No solo reactivo, sino predictivo.
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-emerald-500/50 transition">
                <Database className="w-10 h-10 text-cyan-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">5 Listas Negras</h3>
                <p className="text-gray-400 text-sm">
                  OFAC, CSNU, UIF, Lista 69B SAT y PEPs México. Actualización automática diaria.
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-emerald-500/50 transition">
                <Cpu className="w-10 h-10 text-emerald-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">OCR Automático</h3>
                <p className="text-gray-400 text-sm">
                  Extracción automática de datos de INE/Pasaporte. Pre-llena formularios, ahorra tiempo.
                </p>
              </div>

              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-emerald-500/50 transition">
                <Shield className="w-10 h-10 text-blue-400 mb-4" />
                <h3 className="text-xl font-bold mb-3">Cumplimiento 100%</h3>
                <p className="text-gray-400 text-sm">
                  Validación automática de umbrales UMAs según Art. 17 LFPIORPI. Cero errores humanos.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="precio" className="py-20 px-6 bg-black">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-5xl font-black mb-4">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Planes Para Cada Negocio
                </span>
              </h2>
              <p className="text-xl text-gray-400">Empieza gratis, escala cuando lo necesites</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Básico */}
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 hover:border-emerald-500/50 transition">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Básico</h3>
                  <p className="text-gray-400 text-sm">Para negocios pequeños</p>
                </div>
                
                <div className="text-center mb-8">
                  <div className="text-4xl font-black mb-2">Gratis</div>
                  <p className="text-gray-400 text-sm">Prueba sin compromiso</p>
                </div>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Hasta 10 clientes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Hasta 10 operaciones/mes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">KYC + 5 listas negras</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Reportes UIF básicos</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Dashboard métricas</span>
                  </li>
                </ul>

                <button 
                  onClick={() => { setOnboardingMode('signup'); setShowOnboarding(true); }}
                  className="w-full py-3 border-2 border-emerald-500 rounded-lg font-semibold hover:bg-emerald-500/10 transition"
                >
                  Comenzar Gratis
                </button>
              </div>

              {/* Profesional */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-2 border-emerald-500 rounded-2xl p-8 relative">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-blue-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                  Más Popular
                </div>
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Profesional</h3>
                  <p className="text-gray-400 text-sm">Para empresas en crecimiento</p>
                </div>
                
                <div className="text-center mb-8">
                  <div className="text-4xl font-black mb-2">Contacto</div>
                  <p className="text-gray-400 text-sm">Precio personalizado</p>
                </div>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-white text-sm font-semibold">Todo de Básico +</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Hasta 50 clientes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Hasta 100 operaciones/mes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Análisis ML en tiempo real</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Detección de anomalías</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Soporte prioritario</span>
                  </li>
                </ul>

                <button 
                  onClick={() => { setOnboardingMode('signup'); setShowOnboarding(true); }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-blue-500 rounded-lg font-bold hover:from-emerald-600 hover:to-blue-600 transition"
                >
                  Solicitar Demo
                </button>
              </div>

              {/* Enterprise */}
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 hover:border-purple-500/50 transition">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                  <p className="text-gray-400 text-sm">Para corporativos</p>
                </div>
                
                <div className="text-center mb-8">
                  <div className="text-4xl font-black mb-2">Custom</div>
                  <p className="text-gray-400 text-sm">Solución a medida</p>
                </div>

                <ul className="space-y-3 mb-8">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-white text-sm font-semibold">Todo de Profesional +</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Clientes ilimitados</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Operaciones ilimitadas</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">API REST completa</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">IA LLM explicabilidad</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Whitelabel disponible</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">Account manager dedicado</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">SLA garantizado</span>
                  </li>
                </ul>

                <button 
                  onClick={() => { setOnboardingMode('signup'); setShowOnboarding(true); }}
                  className="w-full py-3 border-2 border-purple-500 rounded-lg font-semibold hover:bg-purple-500/10 transition"
                >
                  Contactar Ventas
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* BLOG & RECURSOS */}
        <section id="blog" className="py-20 px-6 bg-gradient-to-b from-gray-900 to-black">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black mb-4">
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Blog y Recursos PLD
                </span>
              </h2>
              <p className="text-lg text-gray-400 max-w-3xl mx-auto">
                Contenido para PR, CM y posicionamiento: normativa, mejores prácticas y guías accionables para sujetos obligados.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <a href="/blog" className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:border-emerald-400/40 transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold">Centro de recursos</h3>
                </div>
                <p className="text-gray-400">Noticias, guías y checklists para cumplimiento LFPIORPI.</p>
                <span className="inline-flex items-center gap-2 text-emerald-400 mt-4 text-sm">Ver Blog <ChevronRight className="w-4 h-4" /></span>
              </a>

              <a href="/blog/que-exige-articulo-17-lfpiorpi" className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 hover:border-emerald-400/40 transition">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold">Artículo 17 LFPIORPI</h3>
                </div>
                <p className="text-gray-400">Qué exige la ley y cómo cumplir con evidencia y procesos claros.</p>
                <span className="inline-flex items-center gap-2 text-emerald-400 mt-4 text-sm">Leer artículo <ChevronRight className="w-4 h-4" /></span>
              </a>

              <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-bold">SEO & PR listos</h3>
                </div>
                <p className="text-gray-400">Contenido enfocado a búsquedas en Google para impulsar autoridad y demanda.</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="py-20 px-6 bg-gradient-to-r from-emerald-600 to-blue-600">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl font-black mb-6">
              Comienza Tu Transformación Digital Hoy
            </h2>
            <p className="text-xl mb-8 text-white/90">
              Únete a las empresas que ya confían en la IA más avanzada para prevención de lavado de dinero
            </p>
            <button
              onClick={() => { setOnboardingMode('signup'); setShowOnboarding(true); }}
              className="px-10 py-5 bg-white text-gray-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition shadow-2xl"
            >
              Prueba Gratis Durante 14 Días →
            </button>
            <p className="text-sm mt-4 text-white/80">Sin tarjeta de crédito • Configuración en 5 minutos</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-black border-t border-gray-800 py-12 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <TarantulaHawkLogo className="w-8 h-8" />
                  <span className="font-bold text-lg">TarantulaHawk</span>
                </div>
                <p className="text-sm text-gray-400">
                  El sistema PLD más avanzado del mundo
                </p>
              </div>

              <div>
                <h4 className="font-bold mb-3">Producto</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><a href="#tecnologia" className="hover:text-emerald-400 transition">Tecnología</a></li>
                  <li><a href="#plataforma" className="hover:text-emerald-400 transition">Plataforma</a></li>
                  <li><a href="#precio" className="hover:text-emerald-400 transition">Precios</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold mb-3">Empresa</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><a href="#" className="hover:text-emerald-400 transition">Sobre Nosotros</a></li>
                  <li><a href="/blog" className="hover:text-emerald-400 transition">Blog</a></li>
                  <li><a href="#" className="hover:text-emerald-400 transition">Contacto</a></li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold mb-3">Legal</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><a href="#" className="hover:text-emerald-400 transition">Privacidad</a></li>
                  <li><a href="#" className="hover:text-emerald-400 transition">Términos</a></li>
                  <li><a href="#" className="hover:text-emerald-400 transition">Seguridad</a></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
              <p>© 2025 TarantulaHawk. El sistema PLD más avanzado del mundo.</p>
            </div>
          </div>
        </footer>

        <AIChat language="es" />
      </div>
    </>
  );
}
