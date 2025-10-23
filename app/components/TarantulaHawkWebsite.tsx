'use client';

import React, { useState } from 'react';
import OnboardingForm from './OnboardingForm';
import AIChat from './AIChat';
import { Globe, Shield, Zap, TrendingUp, CheckCircle, Brain, Mail } from 'lucide-react';

const TarantulaHawkLogo = ({ className = "w-12 h-12" }) => (
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

export default function TarantulaHawkWebsite() {
  const [language, setLanguage] = useState('en');
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <>
    <div className="min-h-screen bg-black text-white">
      <nav className="fixed top-0 w-full bg-black/95 backdrop-blur-sm border-b border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TarantulaHawkLogo />
              <span className="text-xl font-black bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">
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
                  {language === 'en' ? 'Chat' : 'Chat'}
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
                  onClick={() => window.open('#', '_blank')}
                >
                  {language === 'en' ? 'Login' : 'Ingresar'}
                </button>
                <button
                  className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition"
                  onClick={() => setShowOnboarding(true)}
                >
                  {language === 'en' ? 'Try Free' : 'Probar Gratis'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <section id="hero" className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-600/10 border border-red-600/20 rounded-full mb-8">
              <Zap className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-400">{language === 'en' ? 'AI-Detection • Pay-as-you-go • Instant Reports' : 'IA-Detección • Pago por uso • Reportes instantáneos'}</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black mb-6">
              <span className="bg-gradient-to-r from-red-500 via-orange-500 to-teal-400 bg-clip-text text-transparent">
                {language === 'en' ? 'AI-Powered AML Compliance Platform' : 'Plataforma de Cumplimiento AML con IA'}
              </span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-3xl mx-auto mb-12">
              {language === 'en' 
                ? 'Simply upload your transactions and get instant AML compliance reports. Pay-as-you-go pricing perfect for fintechs and small businesses. AI-powered dashboard with real-time alerts.'
                : 'Simplemente carga tus transacciones y obtén reportes de cumplimiento AML al instante. Precios por uso perfecto para fintechs y pequeñas empresas. Panel con IA y alertas en tiempo real.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className="px-8 py-4 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-bold text-lg hover:from-red-700 hover:to-orange-600 transition"
                onClick={() => setShowOnboarding(true)}
              >
                {language === 'en' ? 'Start Free Trial' : 'Comenzar Prueba Gratis'}
              </button>
              <button 
                onClick={() => {
                  // Trigger the AI chat to open
                  const chatButton = document.querySelector('[role="chat-button"]') as HTMLButtonElement;
                  if (chatButton) chatButton.click();
                }} 
                className="px-8 py-4 border-2 border-teal-500 rounded-lg font-bold text-lg hover:bg-teal-500/10 transition"
              >
                {language === 'en' ? 'Ask AI Assistant' : 'Preguntar a IA'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20">
            <div className="text-center">
              <div className="text-4xl font-black text-red-500 mb-2">&lt;100ms</div>
              <div className="text-gray-400">Transaction Scoring</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-black text-orange-500 mb-2">&gt;95%</div>
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
              {language === 'en' ? 'Three simple steps to AML compliance' : 'Tres pasos simples para cumplimiento AML'}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-black text-white">1</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">
                {language === 'en' ? 'Connect Your Data' : 'Conecta Tus Datos'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Upload transaction files or connect directly through our secure API. Deploy on your own servers for maximum security.'
                  : 'Carga archivos de transacciones o conéctate directamente a través de nuestra API segura. Despliega en tus propios servidores para máxima seguridad.'}
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <span className="text-2xl font-black text-white">2</span>
              </div>
              <h3 className="text-2xl font-bold mb-4">
                {language === 'en' ? 'AI-Detection' : 'IA-Detección'}
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
                  {language === 'en' ? 'Pay-as-you-go Pricing' : 'Precios por Uso'}
                </div>
                <div className="text-sm text-gray-400">
                  {language === 'en' 
                    ? 'Perfect for fintechs & small businesses. No setup fees, no minimums.'
                    : 'Perfecto para fintechs y pequeñas empresas. Sin costos de configuración, sin mínimos.'}
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
              <span className="bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">
                {language === 'en' ? 'Solutions for Every Business Size' : 'Soluciones para Cada Tamaño de Empresa'}
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto mb-12">
              {language === 'en' 
                ? 'From small fintechs to large corporations, access our market-leading AI models through secure API integration running on your own servers. The most powerful AML detection technology available.'
                : 'Desde pequeñas fintechs hasta grandes corporaciones, accede a nuestros modelos de IA líderes del mercado a través de integración API segura ejecutándose en tus propios servidores. La tecnología de detección AML más poderosa disponible.'}
            </p>
          </div>
        </div>
      </section>

      {/* 3 AI Models Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">
              <span className="bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">
                {language === 'en' ? 'Market-Leading AI Models' : 'Modelos de IA Líderes del Mercado'}
              </span>
            </h2>
            <p className="text-xl text-gray-400">
              {language === 'en' 
                ? 'Our trained models are the most powerful in the market. The only AML platform combining supervised, unsupervised, and reinforcement learning for unmatched detection accuracy.'
                : 'Nuestros modelos entrenados son los más potentes del mercado. La única plataforma AML que combina aprendizaje supervisado, no supervisado y por refuerzo para precisión de detección inigualable.'}
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
                  : 'Descubre esquemas de lavado de dinero nuevos y evolutivos detectando anomalías en patrones de transacciones.'}
              </p>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-black text-white">R</span>
              </div>
              <h3 className="text-2xl font-bold mb-4 text-orange-400">
                {language === 'en' ? 'Reinforcement Learning' : 'Aprendizaje por Refuerzo'}
              </h3>
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'Continuously improves detection accuracy by learning from investigator feedback and regulatory updates.'
                  : 'Mejora continuamente la precisión de detección aprendiendo de comentarios de investigadores y actualizaciones regulatorias.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-3xl p-12">
            <div className="text-center mb-12">
              <Shield className="w-16 h-16 text-teal-400 mx-auto mb-6" />
              <h2 className="text-4xl font-black mb-4">
                {language === 'en' ? 'US & Mexico AML Compliance Platform' : 'Plataforma de Cumplimiento Anti-Lavado de EEUU y México'}
              </h2>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-6 text-center text-teal-400">
                {language === 'en' ? 'Your AML Obligations & How We Help' : 'Tus Obligaciones AML y Cómo Te Ayudamos'}
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-teal-600 to-blue-600">
                      <th className="px-6 py-4 text-left font-bold text-black rounded-l-lg">
                        {language === 'en' ? 'Obligation' : 'Obligación'}
                      </th>
                      <th className="px-6 py-4 text-left font-bold text-black">
                        {language === 'en' ? 'Description' : 'Descripción'}
                      </th>
                      <th className="px-6 py-4 text-center font-bold text-black rounded-r-lg">
                        {language === 'en' ? 'TarantulaHawk.ai helps?' : '¿TarantulaHawk.ai te ayuda?'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="space-y-2">
                    <tr className="bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-teal-400 rounded-l-lg border-l-4 border-teal-500">
                        {language === 'en' ? 'Customer Identification' : 'Identificación del cliente'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {language === 'en' ? 'Verify identity, RFC and beneficial owner' : 'Verificar identidad, RFC y beneficiario controlador'}
                      </td>
                      <td className="px-6 py-4 text-center rounded-r-lg">
                        <span className="text-orange-500 font-bold">✗</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {language === 'en' ? 'Obligated Subject Responsibility' : 'Responsabilidad del sujeto obligado'}
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-teal-400 rounded-l-lg border-l-4 border-teal-500">
                        {language === 'en' ? 'Operations Monitoring' : 'Monitoreo de operaciones'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {language === 'en' ? 'Analyze unusual, relevant or concerning operations in real-time with automated systems' : 'Analizar operaciones inusuales, relevantes o preocupantes en tiempo real y con sistemas automatizados'}
                      </td>
                      <td className="px-6 py-4 text-center rounded-r-lg">
                        <span className="text-teal-400 font-bold">✓</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {language === 'en' ? 'AI detects patterns and risks automatically' : 'IA detecta patrones y riesgos automáticamente'}
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-teal-400 rounded-l-lg border-l-4 border-teal-500">
                        {language === 'en' ? 'Operations Reporting' : 'Reporte de operaciones'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {language === 'en' ? 'Generate XML reports according to official format' : 'Generar reportes XML conforme formato oficial'}
                      </td>
                      <td className="px-6 py-4 text-center rounded-r-lg">
                        <span className="text-teal-400 font-bold">✓</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {language === 'en' ? '>95% precision, reduces false positives' : 'Precisión >95%, reduce falsos positivos'}
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-teal-400 rounded-l-lg border-l-4 border-teal-500">
                        {language === 'en' ? 'File Conservation' : 'Conservación de expedientes'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {language === 'en' ? 'Maintain inviolable files for 10 years' : 'Mantener archivos inviolables durante 10 años'}
                      </td>
                      <td className="px-6 py-4 text-center rounded-r-lg">
                        <span className="text-teal-400 font-bold">✓</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {language === 'en' ? 'Encrypted blockchain, 100% auditable' : 'Blockchain cifrado, 100% auditable'}
                        </div>
                      </td>
                    </tr>
                    <tr className="bg-gray-800/50 hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-teal-400 rounded-l-lg border-l-4 border-teal-500">
                        {language === 'en' ? 'Annual Audit' : 'Auditoría anual'}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {language === 'en' ? 'Evidence and total traceability' : 'Evidencias y trazabilidad total'}
                      </td>
                      <td className="px-6 py-4 text-center rounded-r-lg">
                        <span className="text-teal-400 font-bold">✓</span>
                        <div className="text-xs text-gray-400 mt-1">
                          {language === 'en' ? 'Visual dashboards with clear metrics' : 'Dashboards visuales con métricas claras'}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                  <div className="text-4xl mb-2">🇺🇸</div>
                  <p className="text-gray-300 font-semibold text-sm">
                    {language === 'en' ? 'USA: BSA, FinCEN, Bank Secrecy Act, PATRIOT Act, SAR Filing' : 'USA: BSA, FinCEN, Ley de Secreto Bancario, PATRIOT Act, Presentación SAR'}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                  <div className="text-4xl mb-2">🇲🇽</div>
                  <p className="text-gray-300 font-semibold text-sm">
                    {language === 'en' ? 'Mexico: LFPIORPI, SHCP, CNBV, Avisos, Article 18' : 'México: LFPIORPI, SHCP, CNBV, Avisos, Artículo 18'}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-800/30 rounded-lg">
                  <div className="text-4xl mb-2">🌎</div>
                  <p className="text-gray-300 font-semibold text-sm">
                    {language === 'en' ? 'Cross-border AML monitoring for US-Mexico operations' : 'Monitoreo AML transfronterizo para operaciones EEUU-México'}
                  </p>
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
              {language === 'en' ? 'Mexico LFPIORPI Compliance Platform' : 'Plataforma de Cumplimiento LFPIORPI México'}
            </h2>
            <p className="text-xl text-gray-400 max-w-4xl mx-auto mb-4">
              {language === 'en'
                ? 'Complete technology solution for Mexican financial institutions to fulfill Article 18 obligations under LFPIORPI (reformed July 2025)'
                : 'Solucion tecnologica completa para instituciones financieras mexicanas para cumplir obligaciones del Articulo 18 bajo LFPIORPI (reforma julio 2025)'}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600/10 border border-orange-600/30 rounded-full mb-8">
              <Shield className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-400">
                {language === 'en' ? 'Technology Platform - Financial Institution Remains Legally Responsible' : 'Plataforma Tecnologica - Institucion Financiera Mantiene Responsabilidad Legal'}
              </span>
            </div>
          </div>

          <div className="mb-12 max-w-5xl mx-auto">
            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4 text-white">
                {language === 'en' ? 'LFPIORPI Article 18 - Platform Capabilities' : 'LFPIORPI Articulo 18 - Capacidades de la Plataforma'}
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-300">
                    {language === 'en' ? 'Full Automation - Platform handles end-to-end' : 'Automatizacion Total - Plataforma maneja todo'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-gray-300">
                    {language === 'en' ? 'Partial Support - Platform assists, FI completes' : 'Soporte Parcial - Plataforma asiste, IF completa'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-300">
                    {language === 'en' ? 'Advisory/Tools - We guide, FI executes' : 'Consultoria/Herramientas - Guiamos, IF ejecuta'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-gray-300">
                    {language === 'en' ? 'FI Manual Process - Outside platform scope' : 'Proceso Manual IF - Fuera del alcance'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              { num: 'I', titleEN: 'Customer ID & KYC Verification', titleES: 'Identificacion de Clientes y Verificacion KYC', descEN: 'Document storage, OCR extraction, API validation (INE/RENAPO)', descES: 'Almacenamiento de docs, extraccion OCR, validacion API (INE/RENAPO)', color: 'yellow' },
              { num: 'II', titleEN: 'Business Relationship Data Management', titleES: 'Gestion de Datos de Relacion Comercial', descEN: 'Activity data storage, SAT RFC lookup integration', descES: 'Almacenamiento de datos de actividad, consulta RFC SAT', color: 'yellow' },
              { num: 'III', titleEN: 'Beneficial Ownership Identification', titleES: 'Identificacion de Beneficiario Controlador', descEN: 'Corporate structure visualization, ownership analysis tools', descES: 'Visualizacion de estructura corporativa, herramientas de analisis', color: 'blue' },
              { num: 'IV', titleEN: '10-Year Document Custody & Retention', titleES: 'Custodia y Retencion de Documentos 10 Anos', descEN: 'Encrypted cloud storage, automatic retention, audit trails', descES: 'Almacenamiento encriptado en nube, retencion automatica, trazabilidad', color: 'green' },
              { num: 'IV Bis', titleEN: 'Registry in Padron SAT', titleES: 'Registro en Padron SAT', descEN: 'Checklist and guide provided, FI registers with SAT directly', descES: 'Lista de verificacion y guia, IF se registra directamente con SAT', color: 'gray' },
              { num: 'V', titleEN: 'Facilitate SHCP Verification', titleES: 'Facilitar Verificacion SHCP', descEN: 'Pre-built audit reports, document packages for SHCP inspections', descES: 'Reportes de auditoria, paquetes de documentos para inspecciones SHCP', color: 'blue' },
              { num: 'VI', titleEN: 'Present Avisos & Reports to SHCP', titleES: 'Presentar Avisos e Informes a SHCP', descEN: 'XML generation for SHCP, automated submission if allowed', descES: 'Generacion XML para SHCP, envio automatizado si permitido', color: 'yellow' },
              { num: 'VII', titleEN: 'Risk Assessment & EBR Analysis', titleES: 'Evaluacion de Riesgo y Analisis EBR', descEN: 'Core platform: ML-powered risk scoring and classification', descES: 'Funcion principal: scoring de riesgo con ML y clasificacion', color: 'green' },
              { num: 'VIII', titleEN: 'AML Policy Manual Management', titleES: 'Gestion de Manual de Politicas AML', descEN: 'Template library, version control, FI customization', descES: 'Biblioteca de plantillas, control de versiones, personalizacion IF', color: 'blue' },
              { num: 'IX', titleEN: 'Personnel Training & Certification', titleES: 'Capacitacion y Certificacion de Personal', descEN: 'Online AML courses, materials, LMS with certification tracking', descES: 'Cursos AML online, materiales, LMS con seguimiento de certificaciones', color: 'yellow' },
              { num: 'X', titleEN: 'Automated Transaction Monitoring', titleES: 'Monitoreo Automatizado de Transacciones', descEN: 'Core platform: Real-time 3-layer ML monitoring, alerts', descES: 'Funcion principal: Monitoreo ML de 3 capas en tiempo real, alertas', color: 'green' },
              { num: 'XI', titleEN: 'AML Audit Management & Reporting', titleES: 'Gestion de Auditorias AML e Informes', descEN: 'Compliance reports, audit dashboards, KPI tracking', descES: 'Reportes de cumplimiento, dashboards de auditoria, seguimiento KPIs', color: 'blue' },
            ].map((item, idx) => (
              <div key={idx} className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${item.color === 'green' ? 'from-green-600 to-teal-500' : 'from-red-600 to-orange-500'} rounded-lg flex items-center justify-center flex-shrink-0`}>
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
                        {item.color === 'green' ? (language === 'en' ? 'Full Automation' : 'Automatizacion Total') :
                         item.color === 'yellow' ? (language === 'en' ? 'Partial Support' : 'Soporte Parcial') :
                         item.color === 'blue' ? (language === 'en' ? 'Advisory/Tools' : 'Consultoria') :
                         (language === 'en' ? 'FI Manual Process' : 'Proceso Manual IF')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-red-900/10 border border-red-800/30 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold mb-3 text-red-400">
              {language === 'en' ? 'Important Legal Disclaimer - LFPIORPI Compliance' : 'Aviso Legal Importante - Cumplimiento LFPIORPI'}
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              {language === 'en'
                ? 'TarantulaHawk is an AML technology platform that facilitates compliance processes for financial institutions. The Financial Institution remains fully and solely responsible for compliance with LFPIORPI, BSA, FinCEN, and all regulatory obligations in US and Mexico. This platform does not provide legal advice and does not assume liability for regulatory compliance outcomes. Always consult with qualified legal counsel and compliance experts for AML matters.'
                : 'TarantulaHawk es una plataforma tecnológica de Anti-Lavado que facilita procesos de cumplimiento para instituciones financieras. La Institución Financiera permanece total y únicamente responsable del cumplimiento con LFPIORPI, BSA, FinCEN y todas las obligaciones regulatorias en EEUU y México. Esta plataforma no proporciona asesoría legal y no asume responsabilidad por resultados de cumplimiento regulatorio. Siempre consulte con asesoría legal calificada y expertos en cumplimiento para asuntos de Anti-Lavado de Dinero.'}
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-6">
            {language === 'en' ? 'US-Based AML Technology Company with DataCenter in US & Mexico for Sovereignty' : 'Empresa Tecnológica con Sede en EEUU con Data Centers en EEUU y México para la Soberania de Datos'}
          </h2>
          <p className="text-xl text-gray-400 mb-12">
            {language === 'en'
              ? 'TarantulaHawk is a United States-based financial technology and AML software company with secure data centers located in US and Mexico, ensuring full compliance with US and Mexican data sovereignty and privacy requirements under LFPIORPI regulations.'
              : 'TarantulaHawk es una empresa tecnológica de software para Anti-Lavado de Dinero con sede en Estados Unidos y centros de datos seguros ubicados en EEUU y México, garantizando el total cumplimiento con requisitos de soberanía de datos y privacidad mexicanos bajo regulaciones LFPIORPI.'}
          </p>

          <div className="bg-black border border-gray-800 rounded-2xl p-8">
            <h3 className="text-2xl font-bold mb-6">{language === 'en' ? 'What Makes TarantulaHawk Unique for AML' : 'Lo Que Hace Unico a TarantulaHawk para AML'}</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en' 
                    ? 'Only AML platform combining supervised, unsupervised, and reinforcement learning models'
                    : 'Unica plataforma AML que combina modelos de aprendizaje supervisado, no supervisado y por refuerzo'}
                </span>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en'
                    ? 'Dual compliance for US (BSA, FinCEN) and Mexico (LFPIORPI, SHCP, CNBV)'
                    : 'Cumplimiento dual para US (BSA, FinCEN) y México (LFPIORPI, SHCP, CNBV)'}
                </span>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en' ? 'Sub-100 millisecond real-time transaction risk scoring and AML monitoring' : 'Scoring de riesgo de transacciones en tiempo real en menos de 100 milisegundos y monitoreo AML'}
                </span>
              </div>
              <div className="flex items-start gap-3 text-left">
                <CheckCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                <span className="text-gray-300">
                  {language === 'en' ? 'Self-improving AI system that continuously learns from compliance investigations' : 'Sistema de IA auto-mejorable que aprende continuamente de investigaciones de cumplimiento'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-black mb-4">
            {language === 'en' ? 'Ready to Transform Your AML Compliance?' : 'Listo para Transformar tu Cumplimiento AML?'}
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            {language === 'en' ? 'Start monitoring transactions and detecting money laundering in minutes' : 'Comienza a monitorear transacciones y detectar lavado de dinero en minutos'}
          </p>
          <button className="px-12 py-5 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-bold text-xl hover:from-red-700 hover:to-orange-600 transition shadow-2xl shadow-red-500/50">
            {language === 'en' ? 'Access AML Platform' : 'Acceder a Plataforma AML'}
          </button>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center text-gray-500">
          <p>{language === 'en' ? '2025 TarantulaHawk, Inc. All rights reserved.' : '2025 TarantulaHawk, Inc. Todos los derechos reservados.'}</p>
          <p className="mt-2 text-sm">
            {language === 'en' ? 'US-Based AML Technology Company | Secure Data Centers in US and Mexico' : 'Empresa Tecnológica de Anti-Lavado de Dinero con Sede en EEUU | Centros de Datos Seguros en EEUU y México'}
          </p>
          <p className="mt-1 text-sm">
            {language === 'en' ? 'Compliant with FinCEN BSA (USA) and LFPIORPI (Mexico) | Anti-Money Laundering Software' : 'Cumple con FinCEN BSA (USA) y LFPIORPI (México) | Software Anti Lavado de Dinero'}
          </p>
        </div>
      </footer>
    </div>

    <AIChat language={language} />
    
    {showOnboarding && (
      <OnboardingForm onClose={() => setShowOnboarding(false)} />
    )}
    </>
  );
}