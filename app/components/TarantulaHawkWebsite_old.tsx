'use client';

import React, { useEffect, useState } from 'react';
import OnboardingForm from './OnboardingForm';
import AIChat from './AIChat';
import { Globe, Shield, Zap, TrendingUp, CheckCircle, Brain, Mail } from 'lucide-react';

const TarantulaHawkLogo = ({ className = "w-12 h-12" }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#3b82f6'}} />
        <stop offset="50%" style={{stopColor: '#06b6d4'}} />
        <stop offset="100%" style={{stopColor: '#10b981'}} />
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

export default function TarantulaHawkWebsite({ authError }: { authError?: string }) {
  const [language, setLanguage] = useState<'en' | 'es'>('es');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<'signup' | 'login'>('signup');
  const [showAuthError, setShowAuthError] = useState(!!authError);
  
  // Mensajes de error según tipo
  const getErrorMessage = () => {
    if (!authError) return null;
    
    const messages: Record<string, { title: { es: string; en: string }, message: { es: string; en: string } }> = {
      timeout: {
        title: { es: 'Sesión expirada por inactividad', en: 'Session expired due to inactivity' },
        message: { es: 'Por seguridad, tu sesión se cerró tras 15 minutos sin actividad. Inicia sesión de nuevo para continuar.', en: 'For your security, your session ended after 15 minutes of inactivity. Please log in again.' }
      },
      link_expired: {
        title: { es: 'Magic Link Expirado', en: 'Magic Link Expired' },
        message: { es: 'El enlace de autenticación ha expirado. Por favor, solicita un nuevo enlace.', en: 'The authentication link has expired. Please request a new link.' }
      },
      link_used: {
        title: { es: 'Magic Link Ya Utilizado', en: 'Magic Link Already Used' },
        message: { es: 'Este enlace ya fue utilizado anteriormente. Por seguridad, solicita un nuevo enlace.', en: 'This link was already used. For security, please request a new link.' }
      },
      link_invalid: {
        title: { es: 'Magic Link Inválido', en: 'Invalid Magic Link' },
        message: { es: 'El enlace de autenticación es inválido. Verifica el link o solicita uno nuevo.', en: 'The authentication link is invalid. Verify the link or request a new one.' }
      },
      signin_failed: {
        title: { es: 'Error de Autenticación', en: 'Authentication Error' },
        message: { es: 'No se pudo completar la autenticación. Intenta de nuevo.', en: 'Could not complete authentication. Please try again.' }
      }
    };
    
    return messages[authError] || messages.link_expired;
  };
  
  const errorInfo = getErrorMessage();
  
  // ...existing code...

  return (
    <>
    {/* Auth Error Toast */}
    {showAuthError && errorInfo && (
      <div className="fixed top-20 right-6 z-[9999] animate-fade-in">
        <div className="bg-emerald-500/90 backdrop-blur-sm border border-emerald-400 rounded-lg p-4 shadow-2xl max-w-md">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🔒</div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">
                {errorInfo.title[language]}
              </h3>
              <p className="text-sm text-white/90">
                {errorInfo.message[language]}
              </p>
              <div className="mt-3">
                <button
                  onClick={() => {
                    setOnboardingMode('login');
                    setShowOnboarding(true);
                  }}
                  className="px-4 py-2 bg-black/20 border border-white/30 rounded-lg text-sm font-semibold hover:bg-black/30 text-white"
                >
                  {language === 'en' ? 'Log in' : 'Iniciar sesión'}
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowAuthError(false)}
              className="text-white/80 hover:text-white text-xl leading-none"
            >
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
            <div className="flex items-center gap-3">
              <TarantulaHawkLogo />
              <span className="text-xl font-black bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                TARANTULAHAWK
              </span>
            </div>

            <div className="flex items-center gap-8">
              <nav className="hidden md:flex items-center gap-6">
                <a href="#solutions" className="text-gray-300 hover:text-white transition">
                  {language === 'en' ? 'Solutions' : 'Soluciones'}
                </a>
                <a href="#services" className="text-gray-300 hover:text-white transition">
                  {language === 'en' ? 'Services' : 'Servicios'}
                </a>
                <a href="#how-it-works" className="text-gray-300 hover:text-white transition">
                  {language === 'en' ? 'How It Works' : 'Cómo Funciona'}
                </a>
                <a href="#about" className="text-gray-300 hover:text-white transition">
                  {language === 'en' ? 'About' : 'Acerca de'}
                </a>
                <button 
                  onClick={() => {
                    const chatButton = document.querySelector('[role="chat-button"]') as HTMLButtonElement;
                    if (chatButton) chatButton.click();
                  }} 
                  className="text-gray-300 hover:text-white transition"
                >
                  {language === 'en' ? 'Chat' : 'Contáctanos'}
                </button>
              </nav>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 hover:border-teal-500 transition"
                >
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">{language === 'en' ? 'ES' : 'EN'}</span>
                </button>
                <button
                  className="px-4 py-2 border border-gray-700 rounded-lg font-semibold hover:bg-gray-800 transition"
                  onClick={() => {
                    setOnboardingMode('login');
                    setShowOnboarding(true);
                  }}
                >
                  {language === 'en' ? 'Login' : 'Ingresar'}
                </button>
                <button
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold hover:from-emerald-700 hover:to-emerald-500 transition"
                  onClick={() => {
                    setOnboardingMode('signup');
                    setShowOnboarding(true);
                  }}
                >
                  {language === 'en' ? 'Try Free' : 'Registrarse Gratis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      // ...existing code...

      <section id="hero" className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-600/20 rounded-full mb-8">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-cyan-400">{language === 'en' ? 'AI-Powered • Pay-as-you-go • Instant Reports' : 'AI-Powered • Pago por uso • Reportes instantáneos'}</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black mb-6">
              <span className="bg-gradient-to-r from-blue-900 via-blue-500 to-teal-400 bg-clip-text text-transparent">
                {language === 'en' ? 'AI-Powered AML Compliance System' : 'Plataforma IA para Análisis de PLD'}
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-12">
              {language === 'en' 
                ? 'Simply upload your transactions and get instant AML compliance reports. Or through secure API if you are a large corporation. Pay-as-you-go pricing perfect for fintechs and small businesses. AI-powered dashboard with real-time alerts.'
                : 'Simplemente sube tus transacciones y obten reportes de cumplimiento PLD al instante. O a través de API segura si eres una gran corporación. Precios por uso perfectos para fintechs y pequeñas empresas. Panel con IA y alertas en tiempo real.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold text-lg hover:from-emerald-700 hover:to-emerald-500 transition"
                onClick={() => {
                  setOnboardingMode('signup');
                  setShowOnboarding(true);
                }}
              >
                {language === 'en' ? 'Start Free Trial - Get $500 USD' : 'Registrarse - Obtén $500 USD Gratis'}
              </button>
              <button 
                onClick={() => {
                  // Trigger the AI chat to open
                  const chatButton = document.querySelector('[role="chat-button"]') as HTMLButtonElement;
                  if (chatButton) chatButton.click();
                }} 
                className="px-8 py-4 border-2 border-teal-500 rounded-lg font-bold text-lg hover:bg-teal-500/10 transition"
              >
                {language === 'en' ? 'Chat with us' : 'Chat con nosotros'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20">
            <div className="text-center">
              <div className="text-4xl font-black text-blue-500 mb-2">&lt;100ms</div>
              <div className="text-gray-400">Transaction Scoring</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-emerald-500 mb-2">&gt;95%</div>
              <div className="text-gray-400">Detection Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-teal-400 mb-2">3-Layer</div>
              <div className="text-gray-400">ML Architecture</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-teal-400 mb-2">24/7</div>
              <div className="text-gray-400">Monitoring</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Simple 3-Step Process */}
      <section id="how-it-works" className="py-20 px-6 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">
              {language === 'en' ? 'How It Works' : 'Cómo Funciona'}
            </h2>
            <p className="text-xl text-gray-400">
              {language === 'en' ? 'Three simple steps to AML compliance' : 'Tres pasos simples para cumplimiento PLD'}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-black text-white">1</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">
                {language === 'en' ? 'Connect Your Data' : 'Conecta Tus Datos'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Upload transaction files or connect directly through our secure API. Deploy on your own servers for maximum security.'
                  : 'Sube archivos de transacciones o conéctate directamente a través de nuestra API segura. Despliega en tus propios servidores para máxima seguridad.'}
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-black text-white">2</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">
                {language === 'en' ? 'AI-Powered Analysis' : 'Análisis AI-Powered'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Advanced AI algorithms detect suspicious patterns, flag risky activities, and generate compliance reports in real-time.'
                  : 'Algoritmos avanzados de IA detectan patrones sospechosos, marcan actividades riesgosas y generan reportes de cumplimiento en tiempo real.'}
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-black text-white">3</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">
                {language === 'en' ? 'Get Reports & Alerts' : 'Obtener Reportes y Alertas'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Receive instant compliance reports and real-time alerts through your personalized dashboard.'
                  : 'Recibe reportes de cumplimiento instantáneos y alertas en tiempo real a través de tu panel personalizado.'}
              </p>
            </div>
          </div>

          <div className="mt-16 text-center">
            <div className="inline-flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-600/30 rounded-2xl">
              <span className="text-2xl">💳</span>
              <div className="text-left">
                <div className="font-bold text-green-400">
                  {language === 'en' ? 'Pay-as-you-go Pricing' : 'Precios de Pago por Uso'}
                </div>
                <div className="text-sm text-gray-400">
                  {language === 'en' 
                    ? 'Perfect for fintechs & small businesses. No setup fees, no minimums.'
                    : 'Perfecto para fintechs y pequeñas empresas. Sin tarifas de configuración, sin mínimos.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">
              <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                {language === 'en' ? 'Solutions for Every Business Size' : 'Soluciones para Cada Tamaño de Empresa'}
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto mb-12">
              {language === 'en' 
                ? 'From small fintechs to large corporations, access our market-leading AI models through secure API integration running on your own servers. The most powerful AML detection technology available.'
                : 'Desde pequeñas fintechs hasta grandes corporaciones, accede a nuestros modelos de IA líderes del mercado con tan sólo subir un archivo de Excel o a través de integración API segura ejecutándose en tus propios servidores. La tecnología de detección PLD más poderosa que existe.'}
            </p>
          </div>
        </div>
      </section>

      {/* 3 AI Models Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">
              <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                {language === 'en' ? 'Market-Leading AI Models' : 'Modelos de IA Líderes del Mercado'}
              </span>
            </h2>
            <p className="text-xl text-gray-400">
              {language === 'en' 
                ? 'Our trained models are the most powerful in the market. The only AML platform combining supervised, unsupervised, and reinforcement learning for unmatched detection accuracy.'
                : 'Nuestros modelos entrenados son los más potentes del mercado. La única plataforma PLD que combina aprendizaje supervisado, no supervisado y por refuerzo para precisión de detección inigualable.'}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-black text-white">S</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-blue-400">
                {language === 'en' ? 'Supervised Learning' : 'Aprendizaje Supervisado'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Trained on known money laundering patterns to identify similar suspicious activities with high accuracy.'
                  : 'Entrenado en patrones conocidos de lavado de dinero para identificar actividades sospechosas similares con alta precisión.'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-600 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-black text-white">U</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-green-400">
                {language === 'en' ? 'Unsupervised Learning' : 'Aprendizaje No Supervisado'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Discovers new and evolving money laundering schemes by detecting anomalies in transaction patterns.'
                  : 'Descubre esquemas de lavado de dinero nuevos y en evolución detectando anomalías en patrones de transacciones.'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-black text-white">R</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-emerald-400">
                {language === 'en' ? 'Reinforcement Learning' : 'Aprendizaje por Refuerzo'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Continuously improves detection accuracy by learning from investigator feedback and regulatory updates.'
                  : 'Mejora continuamente la precisión de detección aprendiendo de retroalimentación de investigadores y actualizaciones regulatorias.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Shield className="w-16 h-16 text-teal-400 mx-auto mb-6" />
            <h2 className="text-4xl font-black mb-4">
              {language === 'en' ? 'AML Compliance Services' : 'Servicios de Cumplimiento PLD'}
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* US AML Section */}
            <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-800/30 rounded-2xl p-8">
              <h3 className="text-3xl font-bold mb-6 text-blue-400">
                {language === 'en' ? 'US AML Compliance' : 'Cumplimiento PLD Estados Unidos'}
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">Bank Secrecy Act (BSA)</h4>
                    <p className="text-gray-300 text-sm">
                      {language === 'en' ? 'Compliance with federal anti-money laundering regulations and reporting requirements.' : 'Cumplimiento con regulaciones federales anti-lavado y requisitos de reporte.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">USA PATRIOT Act</h4>
                    <p className="text-gray-300 text-sm">
                      {language === 'en' ? 'Enhanced due diligence and customer identification program compliance.' : 'Debida diligencia reforzada y cumplimiento del programa de identificación de clientes.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">SAR Filing</h4>
                    <p className="text-gray-300 text-sm">
                      {language === 'en' ? 'Suspicious Activity Reports generation and submission to authorities.' : 'Generación y envío de Reportes de Actividad Sospechosa a las autoridades.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mexico AML Section */}
            <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/10 border border-emerald-800/30 rounded-2xl p-8">
              <h3 className="text-3xl font-bold mb-6 text-emerald-400">
                {language === 'en' ? 'Mexico LFPIORPI Compliance' : 'Cumplimiento LFPIORPI México'}
              </h3>

              {/* Responsive Table */}
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Mobile: Stack format */}
                  <div className="block md:hidden space-y-4">
                    <div className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-emerald-500">
                      <h4 className="font-semibold text-emerald-400 mb-2">
                        {language === 'en' ? 'Transactions Monitoring' : 'Monitoreo de Transacciones'}
                      </h4>
                      <p className="text-gray-300 text-sm mb-3">
                        {language === 'en' 
                          ? 'AI-Powered Transactions Analysis'
                          : 'Análisis de Transacciones con IA'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 font-bold">✓</span>
                        <span className="text-xs text-gray-400">
                          {language === 'en' ? 'Solved' : 'Resuelto'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-emerald-500">
                      <h4 className="font-semibold text-emerald-400 mb-2">
                        {language === 'en' ? 'XML Reports' : 'Reportes XML'}
                      </h4>
                      <p className="text-gray-300 text-sm mb-3">
                        {language === 'en' 
                          ? 'Official format-ready for SHCP'
                          : 'Formato oficial listo para SHCP'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 font-bold">✓</span>
                        <span className="text-xs text-gray-400">
                          {language === 'en' ? 'Solved' : 'Resuelto'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-emerald-500">
                      <h4 className="font-semibold text-emerald-400 mb-2">
                        {language === 'en' ? '10-Year Storage' : 'Custodia 10 años'}
                      </h4>
                      <p className="text-gray-300 text-sm mb-3">
                        {language === 'en' 
                          ? 'Encrypted retention'
                          : 'Retención cifrada'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 font-bold">✓</span>
                        <span className="text-xs text-gray-400">
                          {language === 'en' ? 'Solved' : 'Resuelto'}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4 border-l-4 border-emerald-500">
                      <h4 className="font-semibold text-emerald-400 mb-2">
                        {language === 'en' ? 'Audit and Reporting' : 'Auditoría y Reportes'}
                      </h4>
                      <p className="text-gray-300 text-sm mb-3">
                        {language === 'en' 
                          ? 'Dashboards and documents, KPI ready for audit'
                          : 'Dashboards y documentos, KPI listos para auditoría'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-teal-400 font-bold">✓</span>
                        <span className="text-xs text-gray-400">
                          {language === 'en' ? 'Solved' : 'Resuelto'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop: Table format */}
                  <div className="hidden md:block">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-emerald-600 to-emerald-600">
                          <th className="px-4 py-3 text-left font-bold text-black text-sm rounded-l-lg">
                            {language === 'en' ? 'Law Obligation' : 'Obligación Legal'}
                          </th>
                          <th className="px-4 py-3 text-left font-bold text-black text-sm">
                            {language === 'en' ? 'TarantulaHawk' : 'TarantulaHawk'}
                          </th>
                          <th className="px-4 py-3 text-center font-bold text-black text-sm rounded-r-lg">
                            {language === 'en' ? 'Solved' : 'Resuelto'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-gray-800/30 hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-emerald-400 border-l-2 border-emerald-500 text-sm">
                            {language === 'en' ? 'Transactions Monitoring' : 'Monitoreo de Transacciones'}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {language === 'en' 
                              ? 'AI-Powered Transactions Analysis'
                              : 'Análisis de Transacciones con IA'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-teal-400 font-bold">✓</span>
                          </td>
                        </tr>
                        <tr className="bg-gray-800/30 hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-emerald-400 border-l-2 border-emerald-500 text-sm">
                            {language === 'en' ? 'XML Reports' : 'Reportes XML'}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {language === 'en' 
                              ? 'Official format-ready for SHCP'
                              : 'Formato oficial listo para SHCP'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-teal-400 font-bold">✓</span>
                          </td>
                        </tr>
                        <tr className="bg-gray-800/30 hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-emerald-400 border-l-2 border-emerald-500 text-sm">
                            {language === 'en' ? '10-Year Storage' : 'Custodia 10 años'}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {language === 'en' 
                              ? 'Encrypted retention'
                              : 'Retención cifrada'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-teal-400 font-bold">✓</span>
                          </td>
                        </tr>
                        <tr className="bg-gray-800/30 hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-emerald-400 border-l-2 border-emerald-500 text-sm">
                            {language === 'en' ? 'Audit and Reporting' : 'Auditoría y Reportes'}
                          </td>
                          <td className="px-4 py-3 text-gray-300 text-sm">
                            {language === 'en' 
                              ? 'Dashboards and documents, KPI ready for audit'
                              : 'Dashboards y documentos, KPI listos para auditoría'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-teal-400 font-bold">✓</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              {language === 'en' ? 'Mexico LFPIORPI Compliance' : 'Cumplimiento LFPIORPI México'}
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto mb-4">
              {language === 'en'
                ? 'AI-powered solution for Mexican institutions to assist in compliance with Article 18 obligations under LFPIORPI (reformed July 2025):'
                : 'Solución potenciada por IA para instituciones mexicanas para asistir en el cumplimiento de las obligaciones del Artículo 18 bajo LFPIORPI (reformado julio 2025):'}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/10 border border-emerald-600/30 rounded-full mb-8">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">
                {language === 'en' ? 'Institutions Remain Legally Responsible for the whole process' : 'Las Instituciones Mantienen la Responsabilidad Legal de todo el proceso'}
              </span>
            </div>
          </div>

          <div className="mb-12 max-w-5xl mx-auto">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 text-white">
                {language === 'en' ? 'LFPIORPI Article 18 - TH Solution Capabilities' : 'LFPIORPI Articulo 18 - Capacidades de Solución TH'}
              </h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">
                    {language === 'en' ? 'TH AI-Powered Solution' : 'Solución IA TH'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300">
                    {language === 'en' ? 'Partially TH Solved' : 'Parcialmente Resuelto por TH'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-gray-300">
                    {language === 'en' ? 'Manual Process Institution Responsibility' : 'Proceso Manual Responsabilidad Institución'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              { num: 'I', titleEN: 'Customer ID & KYC Verification', titleES: 'Identificacion de Clientes y Verificacion KYC', descEN: 'Document storage, OCR extraction, API validation (INE/RENAPO)', descES: 'Almacenamiento de docs, extraccion OCR, validacion API (INE/RENAPO)', color: 'gray' },
              { num: 'II', titleEN: 'Business Relationship Data Management', titleES: 'Gestion de Datos de Relacion Comercial', descEN: 'Activity data storage, SAT RFC lookup integration', descES: 'Almacenamiento de datos de actividad, consulta RFC SAT', color: 'gray' },
              { num: 'III', titleEN: 'Beneficial Ownership Identification', titleES: 'Identificacion de Beneficiario Controlador', descEN: 'Corporate structure visualization, ownership analysis tools', descES: 'Visualizacion de estructura corporativa, herramientas de analisis', color: 'gray' },
              { num: 'IV', titleEN: '10-Year Document Custody & Retention', titleES: 'Custodia y Retencion de Documentos 10 Anos', descEN: 'Encrypted cloud storage, automatic retention, audit trails', descES: 'Almacenamiento encriptado en nube, retencion automatica, trazabilidad', color: 'blue' },
              { num: 'IV Bis', titleEN: 'Registry in Padron SAT', titleES: 'Registro en Padron SAT', descEN: 'Checklist and guide provided, FI registers with SAT directly', descES: 'Lista de verificacion y guia, IF se registra directamente con SAT', color: 'gray' },
              { num: 'V', titleEN: 'Facilitate SHCP Verification', titleES: 'Facilitar Verificacion SHCP', descEN: 'Pre-built audit reports, document packages for SHCP inspections', descES: 'Reportes de auditoria, paquetes de documentos para inspecciones SHCP', color: 'blue' },
              { num: 'VI', titleEN: 'Present Avisos & Reports to SHCP', titleES: 'Presentar Avisos e Informes a SHCP', descEN: 'XML generation for SHCP, automated submission if allowed', descES: 'Generacion XML para SHCP, envio automatizado si permitido', color: 'green' },
              { num: 'VII', titleEN: 'Risk Assessment & EBR Analysis', titleES: 'Evaluacion de Riesgo y Analisis EBR', descEN: 'Core platform: ML-powered risk scoring and classification', descES: 'Funcion principal: scoring de riesgo con ML y clasificacion', color: 'green' },
              { num: 'VIII', titleEN: 'AML Policy Manual Management', titleES: 'Gestión de Manual de Políticas PLD', descEN: 'Template library, version control, FI customization', descES: 'Biblioteca de plantillas, control de versiones, personalización IF', color: 'gray' },
              { num: 'IX', titleEN: 'Personnel Training & Certification', titleES: 'Capacitación y Certificación de Personal', descEN: 'Online AML courses, materials, LMS with certification tracking', descES: 'Cursos PLD online, materiales, LMS con seguimiento de certificaciones', color: 'gray' },
              { num: 'X', titleEN: 'Automated Transaction Monitoring', titleES: 'Monitoreo Automatizado de Transacciones', descEN: 'Core platform: Real-time 3-layer ML monitoring, alerts', descES: 'Funcion principal: Monitoreo ML de 3 capas en tiempo real, alertas', color: 'green' },
              { num: 'XI', titleEN: 'AML Audit Management & Reporting', titleES: 'Gestión de Auditorías PLD e Informes', descEN: 'Compliance reports, audit dashboards, KPI tracking', descES: 'Reportes de cumplimiento, dashboards de auditoría, seguimiento KPIs', color: 'green' },
            ].map((item, idx) => (
              <div key={idx} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.color === 'green' ? 'from-green-600 to-teal-500' : item.color === 'blue' ? 'from-blue-600 to-blue-500' : 'from-blue-600 to-emerald-500'} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-black text-lg">{item.num}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white mb-2">
                      {language === 'en' ? item.titleEN : item.titleES}
                    </h3>
                    <p className="text-sm text-gray-400 mb-3">
                      {language === 'en' ? item.descEN : item.descES}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 bg-${item.color}-500 rounded-full`}></div>
                      <span className="text-xs text-gray-400">
                        {item.color === 'green' ? (language === 'en' ? 'TH AI-Powered Solution' : 'Solución IA TH') :
                         item.color === 'blue' ? (language === 'en' ? 'Partially TH Solved' : 'Parcialmente Resuelto por TH') :
                         (language === 'en' ? 'Manual Process Institution Responsibility' : 'Proceso Manual Responsabilidad Institución')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold mb-3 text-cyan-400">
              {language === 'en' ? 'Important Legal Disclaimer - LFPIORPI Compliance' : 'Aviso Legal Importante - Cumplimiento LFPIORPI'}
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              {language === 'en'
                ? 'TarantulaHawk is an AML technology platform that facilitates compliance processes for financial institutions. The Financial Institution remains fully and solely responsible for compliance with LFPIORPI, BSA, and all regulatory obligations in US and Mexico. This platform does not provide legal advice and does not assume liability for regulatory compliance outcomes. Always consult with qualified legal counsel and compliance experts for AML matters.'
                : 'TarantulaHawk es una plataforma tecnológica de PLD que facilita procesos de cumplimiento para instituciones financieras. La Institución Financiera permanece total y únicamente responsable del cumplimiento con LFPIORPI, BSA y todas las obligaciones regulatorias en Estados Unidos y México. Esta plataforma no proporciona asesoría legal y no asume responsabilidad por resultados de cumplimiento regulatorio. Siempre consulte con asesoría legal calificada y expertos en cumplimiento para asuntos de Prevención de Lavado de Dinero.'}
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-6">
            {language === 'en' ? 'About TarantulaHawk' : 'Acerca de TarantulaHawk'}
          </h2>
          <p className="text-xl text-gray-400 mb-12">
            {language === 'en'
              ? 'TarantulaHawk is a technology platform that provides an AML AI-powered solution to assist full compliance with US and Mexican regulations and authorities.'
              : 'TarantulaHawk es una plataforma tecnológica que proporciona una solución PLD potenciada por IA para asistir en el cumplimiento total con las regulaciones y autoridades de Estados Unidos y México.'}
          </p>

          <div className="bg-black border border-gray-800 rounded-2xl p-8">
            <h3 className="text-2xl font-bold mb-6">{language === 'en' ? 'What Makes TarantulaHawk Unique for AML' : 'Lo Que Hace Único a TarantulaHawk para PLD'}</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en' 
                    ? 'Only AML platform combining supervised, unsupervised, and reinforcement learning models'
                    : 'Única plataforma PLD que combina modelos de aprendizaje supervisado, no supervisado y por refuerzo'}
                </span>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en'
                    ? 'Dual compliance for US (BSA) and Mexico (LFPIORPI, SHCP, CNBV)'
                    : 'Cumplimiento dual para US (BSA) y México (LFPIORPI, SHCP, CNBV)'}
                </span>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en' ? 'Sub-100 millisecond real-time transaction risk scoring and AML monitoring' : 'Scoring de riesgo de transacciones en tiempo real en menos de 100 milisegundos y monitoreo PLD'}
                </span>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en' ? 'Self-improving AI system that continuously learns from compliance investigations' : 'Plataforma IA auto-mejorable que aprende continuamente de investigaciones de cumplimiento'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-black mb-4">
            {language === 'en' ? 'Ready to Transform Your AML Compliance?' : '¿Listo para Transformar tu Cumplimiento PLD?'}
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            {language === 'en' ? 'Start monitoring transactions and detecting money laundering in minutes' : 'Comienza a monitorear transacciones y detectar lavado de dinero en minutos'}
          </p>
          <button 
            onClick={() => {
              // Open login modal instead of signup for this CTA
              setOnboardingMode('login');
              setShowOnboarding(true);
            }}
            className="px-12 py-5 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold text-xl hover:from-emerald-700 hover:to-emerald-600 transition shadow-2xl shadow-emerald-500/50"
          >
            {language === 'en' ? 'Access AML Platform' : 'Acceder a Plataforma PLD'}
          </button>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-500">
          <p>{language === 'en' ? '2025 TarantulaHawk, Inc. All rights reserved.' : '2025 TarantulaHawk, Inc. Todos los derechos reservados.'}</p>
          <p className="mt-2 text-sm">
            {language === 'en' ? 'US-Based AML Technology Platform | Secure Data Centers in US and Mexico' : 'Plataforma Tecnológica PLD con Sede en Estados Unidos | Centros de Datos Seguros en Estados Unidos y México'}
          </p>
          <p className="mt-1 text-sm">
            {language === 'en' ? 'Compliant with BSA (USA) and LFPIORPI (Mexico) | Anti-Money Laundering Platform' : 'Cumple con BSA (Estados Unidos) y LFPIORPI (México) | Plataforma de Prevención de Lavado de Dinero'}
          </p>
        </div>
      </footer>
    </div>

    <AIChat language={language} />
    
    {showOnboarding && (
      <OnboardingForm onClose={() => setShowOnboarding(false)} mode={onboardingMode} />
    )}
    </>
  );
}