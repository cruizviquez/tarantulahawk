'use client';

/**
 * TarantulaHawkPortal.tsx - VERSIÓN CORREGIDA
 * Con todas las funcionalidades del original:
 * ✅ Progress tracking detallado (4 stages)
 * ✅ Upload con XMLHttpRequest (fix Codespaces)
 * ✅ Validación de columnas compacta
 * ✅ Tab Admin (en lugar de API)
 * ✅ StatusMessage integrado
 * ✅ FilePreview integrado
 */

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { calculateTieredCost } from '../lib/pricing';
import { Upload, FileSpreadsheet, Download, User, Clock, Shield, CreditCard, Menu, X, Zap, LogOut, BarChart3 } from 'lucide-react';

// Componentes modulares
import AnalysisHistoryPanel from './AnalysisHistoryPanel';
import MLProgressTracker from './MLProgressTracker';
import ProfileModal from './ProfileModal';
import AdminDashboard from './AdminDashboard';
import TransactionCard from './TransactionCard';
import AnalysisSummary from './AnalysisSummary';
import StatusMessage from './StatusMessage';
import FilePreview from './FilePreview';

// Tipos
import type { UserData, PendingPayment, HistoryItem, ApiKey, ResultadosAnalisis } from './types_portal';
import type { StatusMessageProps } from './StatusMessage';
import type { FileStats } from './FilePreview';

// Logo Component
const TarantulaHawkLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#065f46'}} />
        <stop offset="50%" style={{stopColor: '#047857'}} />
        <stop offset="100%" style={{stopColor: '#10B981'}} />
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
    <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#emeraldGrad)" opacity="0.95"/>
    <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#emeraldGrad)" opacity="0.9"/>
    <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#emeraldGrad)" opacity="0.9"/>
    <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1"/>
    <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1"/>
  </svg>
);

interface TarantulaHawkPortalProps {
  user: UserData;
}

const TarantulaHawkPortal = ({ user: initialUser }: TarantulaHawkPortalProps) => {
  // Estado básico
  const [user, setUser] = useState<UserData>(initialUser);
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'admin' | 'billing' | 'dashboard'>('upload');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Estado de archivo
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [estimatedCost, setEstimatedCost] = useState(0);
  
  // Estado de procesamiento
  const [processingStage, setProcessingStage] = useState<string>(''); // '', 'uploading', 'ml_supervised', ...
  const [progress, setProgress] = useState(0);
  
  // Estado de resultados
  const [currentAnalysis, setCurrentAnalysis] = useState<ResultadosAnalisis | null>(null);
  const [currentCsvText, setCurrentCsvText] = useState<string | null>(null);
  const [filterClassification, setFilterClassification] = useState<'all' | 'preocupante' | 'inusual' | 'relevante'>('all');
  
  // Estado de datos
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  
  // Estado de mensajes
  const [statusMessage, setStatusMessage] = useState<Omit<StatusMessageProps, 'onClose'> | null>(null);


  // Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // API_URL robusto (igual que complete_portal_ui)
  const [API_URL, setApiUrl] = useState<string>('');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (process.env.NEXT_PUBLIC_BACKEND_API_URL) {
        setApiUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL);
        console.log('[API_URL] Using environment variable:', process.env.NEXT_PUBLIC_BACKEND_API_URL);
      } else if (window.location.hostname.includes('github.dev')) {
        const backendHost = window.location.hostname.replace('-3000.app', '-8000.app');
        setApiUrl(`https://${backendHost}`);
        console.log('[API_URL] Codespaces detected:', `https://${backendHost}`);
      } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setApiUrl('');
        console.log('[API_URL] Production: using Next.js API routes (same origin)');
      } else {
        setApiUrl('http://localhost:8000');
        console.log('[API_URL] Local development: http://localhost:8000');
      }
    }
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    fetchHistory();
    fetchPendingPayments();
  }, []);

  // Fetch functions
  const fetchHistory = async () => {
    try {
      const url = API_URL ? `${API_URL}/api/portal/history` : '/api/portal/history';
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const url = API_URL ? `${API_URL}/api/portal/pending-payments` : '/api/portal/pending-payments';
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setPendingPayments(data.payments || []);
      }
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    }
  };

  // Parsear y validar archivo
  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setStatusMessage({ type: 'info', message: 'Analizando archivo...' });

    try {
      // Parsear archivo para obtener estadísticas
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const url = API_URL ? `${API_URL}/api/portal/validate` : '/api/portal/validate';
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result?.error || result?.detail || 'Error al procesar el archivo';
        setStatusMessage({
          type: 'error',
          message: `Validación fallida: ${errorMsg}`
        });
        setFile(null);
        return;
      }

      // Extraer información
      const rowCount = result.rowCount || 0;
      const columns = result.columns || [];
      
      setDetectedColumns(columns.map((c: string) => c.toLowerCase().trim()));
      
      // Calcular costo
      const cost = calculateTieredCost(rowCount);
      setEstimatedCost(cost);

      // Guardar stats
      setFileStats({
        rows: rowCount,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        columns
      });

      // Validar columnas requeridas
      const requiredColumns = ['monto', 'fecha', 'tipo_operacion', 'cliente_id', 'sector_actividad'];
      const missingColumns = requiredColumns.filter(col => 
        !columns.some((c: string) => c.toLowerCase().trim() === col.toLowerCase())
      );

      if (missingColumns.length > 0) {
        setStatusMessage({
          type: 'error',
          message: `Faltan columnas requeridas: ${missingColumns.join(', ')}`
        });
        return;
      }

      // Validar balance
      if (cost > user.balance) {
        setStatusMessage({
          type: 'error',
          message: `Saldo insuficiente. Necesitas $${(cost - user.balance).toFixed(2)} USD adicionales.`
        });
        return;
      }

      // Todo OK
      setStatusMessage({
        type: 'success',
        message: `✓ Archivo validado: ${rowCount.toLocaleString()} transacciones - Costo: $${cost.toFixed(2)} USD`
      });

    } catch (error) {
      console.error('Error parsing file:', error);
      setStatusMessage({
        type: 'error',
        message: 'Error al procesar el archivo. Por favor intenta de nuevo.'
      });
      setFile(null);
    }
  };

  // Limpiar archivo seleccionado
  const clearFile = () => {
    setFile(null);
    setFileStats(null);
    setDetectedColumns([]);
    setEstimatedCost(0);
    setStatusMessage(null);
  };

  // Upload y análisis

  const handleFileUpload = async () => {
    if (!file || !fileStats) return;

    // Validaciones finales
    if (estimatedCost > user.balance) {
      setStatusMessage({
        type: 'error',
        message: 'Saldo insuficiente para procesar este análisis.'
      });
      return;
    }

    const requiredColumns = ['monto', 'fecha', 'tipo_operacion', 'cliente_id', 'sector_actividad'];
    const missingColumns = requiredColumns.filter(col => 
      !detectedColumns.includes(col.toLowerCase())
    );

    if (missingColumns.length > 0) {
      setStatusMessage({
        type: 'error',
        message: `No se puede procesar: faltan columnas ${missingColumns.join(', ')}`
      });
      return;
    }


    setProcessingStage('uploading');
    setProgress(0);
    setStatusMessage({ type: 'info', message: 'Subiendo archivo...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Obtener token de Supabase para autenticación
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatusMessage({ type: 'error', message: 'No se pudo obtener el token de autenticación.' });
        setProcessingStage('');
        return;
      }
      const token = data.session.access_token;


      // Usar XMLHttpRequest y agregar headers de autenticación
      const uploadData = await new Promise<{ analysis_id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const uploadUrl = API_URL ? `${API_URL}/api/portal/upload` : '/api/portal/upload';
        xhr.open('POST', uploadUrl, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('X-User-ID', user.id);
        xhr.onload = function() {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              resolve(result);
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            console.error('Upload error:', xhr.status, xhr.responseText);
            reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      setProgress(30);
      setProcessingStage('ml_supervised');
      setStatusMessage({ type: 'info', message: '🤖 Ejecutando modelo supervisado...' });
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(45);
      setProcessingStage('ml_unsupervised');
      setStatusMessage({ type: 'info', message: '🔍 Ejecutando modelo no supervisado...' });
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(75);
      setProcessingStage('ml_reinforcement');
      setStatusMessage({ type: 'info', message: '🎯 Ejecutando refuerzo (Q-Learning)...' });
      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(90);
      setProcessingStage('generating_report');
      setStatusMessage({ type: 'info', message: '📄 Generando reporte XML...' });
      await new Promise(resolve => setTimeout(resolve, 300));


      // Poll para resultados
      let pollAttempts = 0;
      const maxAttempts = 150; // 5 minutos (2 seg × 150)
      const analysisId = uploadData.analysis_id;
      // Construir ruta robusta del archivo procesado (ajusta según tu convención)
      const processedPath = `${API_URL ? API_URL : ''}/outputs/enriched/processed/${analysisId}.csv`;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const res = await fetch(processedPath);
          if (res.ok) {
            const csvText = await res.text();
            clearInterval(pollInterval);
            setCurrentCsvText(csvText);
            setCurrentAnalysis(null);
            setProgress(100);
            setProcessingStage('complete');
            setStatusMessage({
              type: 'success',
              message: `✓ Análisis completado: archivo procesado disponible.`
            });
            // Actualizar balance
            const balanceUrl = API_URL ? `${API_URL}/api/portal/balance` : '/api/portal/balance';
            fetch(balanceUrl, { credentials: 'include' })
              .then(balanceResponse => balanceResponse.ok ? balanceResponse.json() : null)
              .then(balanceData => {
                if (balanceData && balanceData.balance !== undefined) {
                  setUser(prev => ({ ...prev, balance: balanceData.balance }));
                }
              });
          } else if (pollAttempts >= maxAttempts) {
            clearInterval(pollInterval);
            setProcessingStage('');
            setStatusMessage({
              type: 'error',
              message: 'No se encontró el archivo procesado. El análisis puede haber fallado o estar en proceso.'
            });
          }
        } catch (err) {
          clearInterval(pollInterval);
          setProcessingStage('');
          setStatusMessage({ type: 'error', message: 'Error al buscar el archivo procesado: ' + err });
        }
      }, 2000);

    } catch (error) {
      console.error('Error:', error);
      setStatusMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Error procesando el archivo. Por favor intenta de nuevo.'
      });
      setProcessingStage('');
      setProgress(0);
    }
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  // Filtrar transacciones
  const filteredTransactions = currentAnalysis?.transacciones.filter(txn => {
    if (filterClassification === 'all') return true;
    return txn.clasificacion_final.resultado === filterClassification;
  }) || [];

  // Validar si puede analizar
  const canAnalyze = fileStats !== null && 
    estimatedCost <= user.balance &&
    detectedColumns.length >= 5;

  // Verificar si es admin/enterprise
  const isAdmin = user.subscription_tier === 'enterprise';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-emerald-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <TarantulaHawkLogo className="w-10 h-10" />
              <div>
                <h1 className="text-xl font-bold text-white">TarantulaHawk</h1>
                <p className="text-xs text-gray-400">Portal PLD</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <nav className="hidden md:flex items-center gap-6">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'upload'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Upload className="w-4 h-4" />
                Analizar
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'history'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                Historial
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === 'admin'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admin
                </button>
              )}
              <button
                onClick={() => setActiveTab('billing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'billing'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Billing
              </button>
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-sm text-white font-medium">{user.name}</p>
                <p className="text-xs text-gray-400">${user.balance.toFixed(2)} USD</p>
              </div>
              <button
                onClick={() => setShowProfileModal(true)}
                className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
              >
                <User className="w-5 h-5 text-emerald-400" />
              </button>
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden w-10 h-10 flex items-center justify-center text-gray-400"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-700 py-4">
              <nav className="flex flex-col gap-2">
                <button
                  onClick={() => { setActiveTab('upload'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <Upload className="w-4 h-4" />
                  Analizar
                </button>
                <button
                  onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => { setActiveTab('history'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <Clock className="w-4 h-4" />
                  Historial
                </button>
                {isAdmin && (
                  <button
                    onClick={() => { setActiveTab('admin'); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                )}
                <button
                  onClick={() => { setActiveTab('billing'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <CreditCard className="w-4 h-4" />
                  Billing
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Message (solo para tabs que no sean upload) */}
        {activeTab !== 'upload' && statusMessage && (
          <div className="mb-6">
            <StatusMessage
              {...statusMessage}
              onClose={() => setStatusMessage(null)}
              autoClose={statusMessage.type !== 'error'}
              duration={statusMessage.type === 'success' ? 5000 : 10000}
            />
          </div>
        )}

        {/* Tab: Upload/Analizar */}
        {activeTab === 'upload' && (
          <div className="space-y-6 flex flex-col items-center">
            {/* Tracker siempre visible arriba */}
            <div className="w-full max-w-3xl mt-2 mx-auto">
              <MLProgressTracker 
                progress={progress}
                stage={processingStage}
              />
            </div>

            {/* Mensajes siempre debajo del tracker, ancho igual al tracker */}
            <div className="w-full max-w-3xl mt-2 mx-auto">
              <div className="bg-gray-900/80 border border-emerald-700/30 rounded-lg p-3 text-center text-sm text-gray-200 min-h-[48px] flex flex-col items-center justify-center">
                {statusMessage && (
                  <StatusMessage
                    {...statusMessage}
                    onClose={() => setStatusMessage(null)}
                    autoClose={statusMessage.type !== 'error'}
                    duration={statusMessage.type === 'success' ? 5000 : 10000}
                  />
                )}
                {/* Leyenda solo si hay archivo y estimado de cobro */}
                {file && fileStats && estimatedCost > 0 && (
                  <span className="block text-xs text-gray-400 mt-1">Al ejecutar análisis se descontará la cantidad estimada del saldo total de su cuenta.</span>
                )}
              </div>
            </div>

            {/* Caja de carga pequeña debajo del tracker */}
            {!currentAnalysis && (
              <div className="w-full max-w-xl mt-2">
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 flex flex-col items-center">
                  <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Upload className="w-5 h-5 text-emerald-400" />
                    Cargar Archivo para Análisis PLD
                  </h2>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-emerald-500/50 transition-all w-full max-w-xs mx-auto">
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (selectedFile) handleFileChange(selectedFile);
                      }}
                      className="hidden"
                      id="file-upload"
                      disabled={!!processingStage && processingStage !== '' && processingStage !== 'complete'}
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <FileSpreadsheet className="w-10 h-10 text-gray-400" />
                      <div>
                        <p className="text-white font-medium mb-1">
                          {file ? file.name : 'Selecciona un archivo CSV o Excel'}
                        </p>
                        <p className="text-gray-400 text-xs">
                          Formatos soportados: .csv, .xlsx (máx 50MB)
                        </p>
                      </div>
                    </label>
                  </div>
                  {/* File Preview */}
                  {fileStats && (
                    <FilePreview
                      fileStats={fileStats}
                      estimatedCost={estimatedCost}
                      userBalance={user.balance}
                      detectedColumns={detectedColumns}
                      onClear={clearFile}
                    />
                  )}
                  {/* Botón Ejecutar Análisis IA */}
                  {file && fileStats && (
                    <div className="flex flex-col items-center gap-2 mt-4">
                      <button
                        onClick={handleFileUpload}
                        disabled={!canAnalyze || (!!processingStage && processingStage !== '' && processingStage !== 'complete')}
                        className="px-8 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Zap className="w-5 h-5" />
                        {processingStage === 'uploading' ? 'Subiendo...' :
                         processingStage && processingStage !== '' && processingStage !== 'complete' ? 'Analizando...' :
                         'Ejecutar Análisis IA'}
                      </button>
                      <button
                        onClick={clearFile}
                        className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Results Section */}
            {/* Mostrar resultados del análisis JSON */}
            {currentAnalysis && (
              <div className="space-y-6">
                {/* Botón volver */}
                <button
                  onClick={() => {
                    setCurrentAnalysis(null);
                    clearFile();
                    setProgress(0);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2"
                >
                  ← Nuevo análisis
                </button>

                {/* Resumen */}
                <AnalysisSummary results={currentAnalysis} />

                {/* Filtros */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-gray-400 text-sm">Filtrar por:</span>
                    <div className="flex gap-2 flex-wrap">
                      {(['all', 'preocupante', 'inusual', 'relevante'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setFilterClassification(filter)}
                          className={`px-4 py-2 rounded-lg text-sm transition-all ${
                            filterClassification === filter
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-gray-700/50 text-gray-400 hover:text-white'
                          }`}
                        >
                          {filter === 'all' ? 'Todas' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                      ))}
                    </div>
                    <span className="text-gray-500 text-sm ml-auto">
                      {filteredTransactions.length} transacciones
                    </span>
                  </div>
                </div>

                {/* Lista de Transacciones */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-white">Detalle de Transacciones</h3>
                  {filteredTransactions.length > 0 ? (
                    <div className="grid gap-4">
                      {filteredTransactions.map((transaction, index) => (
                        <TransactionCard
                          key={transaction.datos_transaccion.id}
                          transaction={transaction}
                          index={index}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-8 text-center">
                      <p className="text-gray-400">No hay transacciones con este filtro</p>
                    </div>
                  )}
                </div>

                {/* Descargas */}
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Descargar Resultados</h3>
                  <div className="flex gap-4 flex-wrap">
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all">
                      <Download className="w-4 h-4" />
                      CSV Procesado
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-all">
                      <Download className="w-4 h-4" />
                      Reporte XML (LFPIORPI)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mostrar solo CSV si no hay análisis JSON */}
            {currentCsvText && !currentAnalysis && (
              <div className="space-y-6">
                <button
                  onClick={() => {
                    setCurrentCsvText(null);
                    clearFile();
                    setProgress(0);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-2"
                >
                  ← Nuevo análisis
                </button>
                <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">CSV Procesado</h3>
                  <pre className="overflow-x-auto text-xs text-gray-200 bg-gray-900 p-4 rounded-lg max-h-96 whitespace-pre-wrap">{currentCsvText}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Historial */}
        {activeTab === 'history' && (
          <AnalysisHistoryPanel 
            history={history}
            onSelectAnalysis={(analysisId) => {
              // Buscar el item en el historial
              const item = history.find(h => h.analysis_id === analysisId);
              if (item && item.processed_file_path) {
                // Fetch al archivo real procesado (CSV)
                fetch(item.processed_file_path)
                  .then(res => res.ok ? res.text() : Promise.reject('No se pudo obtener el archivo procesado'))
                  .then(csvText => {
                    setCurrentAnalysis(null);
                    setCurrentCsvText(csvText);
                    setActiveTab('upload');
                  })
                  .catch(err => {
                    setCurrentAnalysis(null);
                    setCurrentCsvText(null);
                    alert('Error al obtener el archivo procesado: ' + err);
                  });
              } else {
                setCurrentAnalysis(null);
                setCurrentCsvText(null);
                setActiveTab('upload');
              }
            }}
          />
        )}

        {/* Tab: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="w-full max-w-3xl mx-auto bg-gray-800/40 border border-gray-700 rounded-lg p-8 mt-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2 justify-center">
              <BarChart3 className="w-6 h-6 text-blue-400" />
              Dashboard
            </h2>
            <p className="text-gray-300">Aquí irá el dashboard de métricas y visualizaciones próximamente.</p>
          </div>
        )}

        {/* Tab: Admin */}
        {activeTab === 'admin' && isAdmin && (
          <AdminDashboard />
        )}

        {/* Tab: Billing */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-6">Balance y Facturación</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Balance Actual</p>
                  <p className="text-3xl font-bold text-emerald-400">${user.balance.toFixed(2)}</p>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Plan</p>
                  <p className="text-2xl font-bold text-blue-400">{user.subscription_tier.toUpperCase()}</p>
                </div>
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                  <p className="text-gray-400 text-sm mb-1">Análisis este mes</p>
                  <p className="text-3xl font-bold text-purple-400">{history.length}</p>
                </div>
              </div>
            </div>

            {pendingPayments.length > 0 && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-400 mb-4">Pagos Pendientes</h3>
                <div className="space-y-3">
                  {pendingPayments.map((payment) => (
                    <div key={payment.payment_id} className="bg-gray-900/50 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">${payment.amount.toFixed(2)} USD</p>
                        <p className="text-sm text-gray-400">Análisis: {payment.analysis_id}</p>
                      </div>
                      <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all">
                        Pagar Ahora
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onUpdate={(updatedUser) => {
            setUser(updatedUser);
            setShowProfileModal(false);
          }}
        />
      )}
    </div>
  );
};

export default TarantulaHawkPortal;