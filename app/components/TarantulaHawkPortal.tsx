'use client';

/**
 * TarantulaHawkPortal.tsx - VERSIÓN MEJORADA (UI/UX)
 * ✅ Layout estable: no “jump”, no scrollbar fantasma
 * ✅ Área de tracker/status con altura reservada
 * ✅ Main con scroll interno (h-screen)
 * ✅ Tracker compacto en móvil (usando MLProgressTracker variant)
 * ✅ Wizard steps para navegabilidad
 * ✅ CSV preview amigable en móvil + descarga real
 * ✅ Tracker solo en Upload; en otras tabs se muestra banner discreto si hay análisis corriendo
 */

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';
import { calculateTieredCost } from '../lib/pricing';
import {
  Upload,
  FileSpreadsheet,
  Download,
  User,
  Clock,
  Shield,
  CreditCard,
  Users,
  Activity,
  FileText,
  Menu,
  X,
  Zap,
  LogOut,
  BarChart3,
} from 'lucide-react';

// Componentes modulares
import AnalysisHistoryPanel from './AnalysisHistoryPanel';
import MLProgressTracker from './MLProgressTracker';
import ProfileModal from './ProfileModal';
import AdminDashboard from './AdminDashboard';
import TransactionCard from './TransactionCard';
import AnalysisSummary from './AnalysisSummary';
import StatusMessage from './StatusMessage';
import FilePreview from './FilePreview';
import GlobalStatusBar from './GlobalStatusBar';
import KYCModule from './kyc/KYCModule';
import MonitoringModule from './monitoring/MonitoringModule';
import UIFReportModule from './reportes-uif/UIFReportModule';
import RegulatoryDashboard from './dashboard/RegulatoryDashboard';

// Tipos
import type { UserData, PendingPayment, HistoryItem, ResultadosAnalisis } from './types_portal';
import type { StatusMessageProps } from './StatusMessage';
import type { FileStats } from './FilePreview';

// ---------- Helpers ----------
function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < breakpointPx);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [breakpointPx]);
  return isMobile;
}

function downloadTextFile(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type UploadStep = 'select' | 'validated' | 'processing' | 'results';

// Logo Component
const TarantulaHawkLogo = ({ className = 'w-10 h-10' }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#065f46' }} />
        <stop offset="50%" style={{ stopColor: '#047857' }} />
        <stop offset="100%" style={{ stopColor: '#10B981' }} />
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
    <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#emeraldGrad)" opacity="0.95" />
    <path
      d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z"
      fill="url(#emeraldGrad)"
      opacity="0.9"
    />
    <path
      d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z"
      fill="url(#emeraldGrad)"
      opacity="0.9"
    />
    <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1" />
    <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1" />
  </svg>
);

interface TarantulaHawkPortalProps {
  user: UserData;
}

const TarantulaHawkPortal = ({ user: initialUser }: TarantulaHawkPortalProps) => {
  const isMobile = useIsMobile(768);

  // Estado básico
  const [user, setUser] = useState<UserData>(initialUser);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'kyc' | 'monitoring' | 'reportes-uif' | 'history' | 'admin' | 'billing'>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Estado de archivo
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<FileStats | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Estado de procesamiento
  const [processingStage, setProcessingStage] = useState<string>(''); // '', 'uploading', ...
  const [progress, setProgress] = useState(0);

  // Estado de resultados
  const [currentAnalysis, setCurrentAnalysis] = useState<ResultadosAnalisis | null>(null);
  const [currentCsvText, setCurrentCsvText] = useState<string | null>(null);
  const [filterClassification, setFilterClassification] = useState<'all' | 'preocupante' | 'inusual' | 'relevante'>(
    'all'
  );

  // Estado de datos
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);

  // Estado de mensajes
  const [statusMessage, setStatusMessage] = useState<Omit<StatusMessageProps, 'onClose'> | null>(null);

  // Supabase client (singleton)
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  // Cargar datos iniciales
  useEffect(() => {
    fetchHistory();
    fetchPendingPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        console.error('No session found');
        return;
      }
      const token = data.session.access_token;

      const response = await fetch('/api/portal/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.historial || []);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const fetchPendingPayments = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        console.error('No session found');
        return;
      }
      const token = data.session.access_token;

      const response = await fetch('/api/portal/pending-payments', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingPayments(data.pending_payments || []);
      }
    } catch (error) {
      console.error('Error fetching pending payments:', error);
    }
  };

  const isProcessing = !!processingStage && processingStage !== '' && processingStage !== 'complete';

  // Wizard step (para navegabilidad)
  const uploadStep: UploadStep = useMemo(() => {
    const hasResults = !!currentAnalysis || !!currentCsvText;
    if (hasResults) return 'results';
    if (isProcessing) return 'processing';
    if (file && fileStats && statusMessage?.type === 'success' && estimatedCost > 0 && estimatedCost <= user.balance) return 'validated';
    return 'select';
  }, [currentAnalysis, currentCsvText, isProcessing, file, fileStats, statusMessage?.type, estimatedCost, user.balance]);

  // Parsear y validar archivo
  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentAnalysis(null);
    setCurrentCsvText(null);
    setProgress(0);
    setProcessingStage('');
    setStatusMessage({ type: 'info', message: 'Analizando archivo...' });

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatusMessage({ type: 'error', message: 'No se pudo obtener el token de autenticación.' });
        return;
      }
      const token = data.session.access_token;

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/portal/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const errorMsg = result?.error || result?.detail || 'Error al procesar el archivo';
        setStatusMessage({ type: 'error', message: `Validación fallida: ${errorMsg}` });
        setFile(null);
        setFileStats(null);
        return;
      }

      // ✅ Compatibilidad con backend: rowCount (nuevo) o row_count (legacy)
      const rowCount = result.rowCount ?? result.row_count ?? 0;
      const columns = result.columns || [];
      setDetectedColumns(columns.map((c: string) => c.toLowerCase().trim()));

      const cost = calculateTieredCost(rowCount);
      setEstimatedCost(cost);

      setFileStats({
        rows: rowCount,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        columns,
      });

      const requiredColumns = ['monto', 'fecha', 'tipo_operacion', 'cliente_id'];
      const missingColumns = requiredColumns.filter(
        (col) => !columns.some((c: string) => c.toLowerCase().trim() === col.toLowerCase())
      );

      if (missingColumns.length > 0) {
        setStatusMessage({ type: 'error', message: `Faltan columnas requeridas: ${missingColumns.join(', ')}` });
        return;
      }

      if (cost > user.balance) {
        setStatusMessage({
          type: 'error',
          message: `Saldo insuficiente. Necesitas $${(cost - user.balance).toFixed(2)} USD adicionales.`,
        });
        return;
      }

      setStatusMessage({
        type: 'success',
        message: `✓ Archivo validado: ${rowCount.toLocaleString()} transacciones — Costo estimado: $${cost.toFixed(2)} USD`,
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      setStatusMessage({ type: 'error', message: 'Error al procesar el archivo. Por favor intenta de nuevo.' });
      setFile(null);
      setFileStats(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileStats(null);
    setDetectedColumns([]);
    setEstimatedCost(0);
    setStatusMessage(null);
    setProcessingStage('');
    setProgress(0);
    setCurrentAnalysis(null);
    setCurrentCsvText(null);
  };

  const handleFileUpload = async () => {
    if (!file || !fileStats) return;

    if (estimatedCost > user.balance) {
      setStatusMessage({ type: 'error', message: 'Saldo insuficiente para procesar este análisis.' });
      return;
    }

    const requiredColumns = ['monto', 'fecha', 'tipo_operacion', 'cliente_id'];
    const missingColumns = requiredColumns.filter((col) => !detectedColumns.includes(col.toLowerCase()));
    if (missingColumns.length > 0) {
      setStatusMessage({ type: 'error', message: `No se puede procesar: faltan columnas ${missingColumns.join(', ')}` });
      return;
    }

    setProcessingStage('uploading');
    setProgress(0);
    setStatusMessage({ type: 'info', message: 'Subiendo archivo...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setStatusMessage({ type: 'error', message: 'No se pudo obtener el token de autenticación.' });
        setProcessingStage('');
        return;
      }
      const token = data.session.access_token;

      const uploadData = await new Promise<{ analysis_id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/portal/upload', true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.onload = function () {
          if (xhr.status === 200) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      // Progreso simulado (mejor UX con estados)
      setProgress(30);
      setProcessingStage('ml_supervised');
      setStatusMessage({ type: 'info', message: '🤖 Ejecutando modelo supervisado...' });
      await new Promise((r) => setTimeout(r, 500));

      setProgress(45);
      setProcessingStage('ml_unsupervised');
      setStatusMessage({ type: 'info', message: '🔍 Ejecutando modelo no supervisado...' });
      await new Promise((r) => setTimeout(r, 500));

      setProgress(75);
      setProcessingStage('ml_reinforcement');
      setStatusMessage({ type: 'info', message: '🎯 Ejecutando refuerzo (Q-Learning)...' });
      await new Promise((r) => setTimeout(r, 500));

      setProgress(90);
      setProcessingStage('generating_report');
      setStatusMessage({ type: 'info', message: '📄 Generando reporte...' });
      await new Promise((r) => setTimeout(r, 300));

      // Poll para resultados
      let pollAttempts = 0;
      const maxAttempts = 150; // 5 min
      const analysisId = uploadData.analysis_id;

      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !sessionData.session) {
            clearInterval(pollInterval);
            setProcessingStage('');
            setStatusMessage({ type: 'error', message: 'Sesión expirada' });
            return;
          }
          const token = sessionData.session.access_token;
          
          const res = await fetch(`/api/portal/analysis/${analysisId}/result`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const csvText = await res.text();
            clearInterval(pollInterval);

            setCurrentCsvText(csvText);
            setCurrentAnalysis(null);
            setProgress(100);
            setProcessingStage('complete');
            setStatusMessage({ type: 'success', message: '✓ Análisis completado: archivo procesado disponible.' });

            // Actualizar balance
            fetch('/api/portal/balance', { 
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            })
              .then((balanceResponse) => (balanceResponse.ok ? balanceResponse.json() : null))
              .then((balanceData) => {
                if (balanceData && balanceData.balance !== undefined) {
                  setUser((prev) => ({ ...prev, balance: balanceData.balance }));
                }
              });
          } else if (pollAttempts >= maxAttempts) {
            clearInterval(pollInterval);
            setProcessingStage('');
            setStatusMessage({
              type: 'error',
              message: 'No se encontró el archivo procesado. El análisis puede haber fallado o estar en proceso.',
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
        message: error instanceof Error ? error.message : 'Error procesando el archivo. Por favor intenta de nuevo.',
      });
      setProcessingStage('');
      setProgress(0);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const filteredTransactions =
    currentAnalysis?.transacciones.filter((txn) => {
      if (filterClassification === 'all') return true;
      return txn.clasificacion_final.resultado === filterClassification;
    }) || [];

  const canAnalyze = fileStats !== null && estimatedCost <= user.balance && detectedColumns.length >= 5 && !isProcessing;

  const isAdmin = user.subscription_tier === 'enterprise';

  const WizardSteps = () => {
    const steps: { key: UploadStep; label: string }[] = [
      { key: 'select', label: 'Cargar' },
      { key: 'validated', label: 'Validación' },
      { key: 'processing', label: 'Análisis' },
      { key: 'results', label: 'Resultados' },
    ];

    const currentIndex = steps.findIndex((s) => s.key === uploadStep);

    return (
      <div className="w-full rounded-lg border border-gray-700 bg-gray-800/40 p-3">
        <div className="flex items-center justify-between gap-2">
          {steps.map((s, idx) => {
            const active = idx === currentIndex;
            const done = idx < currentIndex;
            return (
              <div key={s.key} className="flex items-center gap-2 flex-1">
                <div
                  className={[
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border',
                    done ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : '',
                    active ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : '',
                    !done && !active ? 'bg-gray-700/40 text-gray-300 border-gray-600' : '',
                  ].join(' ')}
                >
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-gray-200 truncate">{s.label}</div>
                </div>
                {idx !== steps.length - 1 && <div className="h-px bg-gray-700 flex-1" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ---------- RENDER ----------
  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-emerald-500/20 sticky top-0 z-50 shrink-0">
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
                onClick={() => setActiveTab('kyc')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'kyc'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Clientes & KYC
              </button>

              <button
                onClick={() => setActiveTab('reportes-uif')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'reportes-uif'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                Reportes UIF
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
                  onClick={() => {
                    setActiveTab('dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    setActiveTab('kyc');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <Users className="w-4 h-4" />
                  Clientes & KYC
                </button>

                <button
                  onClick={() => {
                    setActiveTab('reportes-uif');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <FileText className="w-4 h-4" />
                  Reportes UIF
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setActiveTab('admin');
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                )}
                <button
                  onClick={() => {
                    setActiveTab('billing');
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white"
                >
                  <CreditCard className="w-4 h-4" />
                  Billing
                </button>
                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-red-400">
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* ✅ NUEVO: Global Status Bar */}
      <GlobalStatusBar
        isProcessing={isProcessing}
        progress={progress}
        processingStage={processingStage}
        onViewDetails={() => setActiveTab('monitoring')}
        statusMessage={activeTab !== 'monitoring' ? statusMessage : null}
      />

      {/* Main with internal scroll */}
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Status Message (para tabs activos con análisis) */}
          {(activeTab === 'monitoring' || activeTab === 'dashboard') && (
            <div className="mb-6 min-h-[56px]">
              {statusMessage ? (
                <StatusMessage
                  {...statusMessage}
                  onClose={() => setStatusMessage(null)}
                  autoClose={statusMessage.type !== 'error'}
                  duration={statusMessage.type === 'success' ? 5000 : 10000}
                />
              ) : (
                <div className="text-xs text-gray-500 px-2 py-4"> </div>
              )}
            </div>
          )}

          {/* Tab: Historial */}
          {activeTab === 'history' && (
            <AnalysisHistoryPanel
              history={history}
              onSelectAnalysis={async (analysisId) => {
                try {
                  const { data, error } = await supabase.auth.getSession();
                  if (error || !data.session) {
                    alert('No se pudo obtener el token de autenticación.');
                    return;
                  }
                  const token = data.session.access_token;

                  const res = await fetch(`/api/portal/analysis/${analysisId}/result`, {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                    },
                  });

                  if (res.ok) {
                    const csvText = await res.text();
                    setCurrentAnalysis(null);
                    setCurrentCsvText(csvText);
                    setActiveTab('monitoring');
                  } else {
                    throw new Error('No se pudo obtener el archivo procesado');
                  }
                } catch (err) {
                  setCurrentAnalysis(null);
                  setCurrentCsvText(null);
                  alert('Error al obtener el archivo procesado: ' + err);
                }
              }}
            />
          )}

          {activeTab === 'kyc' && <KYCModule />}
          {activeTab === 'monitoring' && <MonitoringModule />}
          {activeTab === 'reportes-uif' && <UIFReportModule />}
          {activeTab === 'dashboard' && <RegulatoryDashboard />}

          {/* Tab: Admin */}
          {activeTab === 'admin' && isAdmin && <AdminDashboard />}

          {/* Tab: Billing */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-6">Balance y facturación</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Balance actual</p>
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
                  <h3 className="text-lg font-semibold text-yellow-400 mb-4">Pagos pendientes</h3>
                  <div className="space-y-3">
                    {pendingPayments.map((payment) => (
                      <div key={payment.payment_id} className="bg-gray-900/50 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="text-white font-medium">${payment.amount.toFixed(2)} USD</p>
                          <p className="text-sm text-gray-400">Análisis: {payment.analysis_id}</p>
                        </div>
                        <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all">
                          Pagar ahora
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

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
