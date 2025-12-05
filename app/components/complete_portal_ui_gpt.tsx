'use client';

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { calculateTieredCost } from '../lib/pricing';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Database,
  User,
  Clock,
  BarChart3,
  CreditCard,
  Lock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  X,
  Menu,
  Zap,
  Key
} from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import MLProgressTracker from './MLProgressTracker';
import { DashboardTab } from './DashboardTab';
import TablaResultados from './TablaResultados';
import { mapApiResponseToRows, TransaccionRow } from './ml_mapper';
import { useAnalisisTransacciones } from './useAnalisisTransacciones';
import { HistoryTab } from './HistoryTab';
import { AdminTab } from './AdminTab';
import ProfileModal from './ProfileModal';

const TarantulaHawkLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{stopColor: '#065f46'}} />
        <stop offset="50%" style={{stopColor: '#10B981'}} />
        <stop offset="100%" style={{stopColor: '#34D399'}} />
      </linearGradient>
    </defs>
    <circle cx="200" cy="200" r="190" fill="none" stroke="url(#emeraldGrad)" strokeWidth="3" opacity="0.4"/>
    <ellipse cx="200" cy="230" rx="35" ry="85" fill="#0A0A0A"/>
    <ellipse cx="200" cy="170" rx="18" ry="20" fill="#0F0F0F"/>
    <ellipse cx="200" cy="145" rx="32" ry="35" fill="#0F0F0F"/>
    <ellipse cx="200" cy="110" rx="22" ry="20" fill="#0A0A0A"/>
    <ellipse cx="200" cy="215" rx="32" ry="10" fill="url(#emeraldGrad)" opacity="0.95"/>
    <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#emeraldGrad)" opacity="0.9"/>
    <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#emeraldGrad)" opacity="0.9"/>
    <ellipse cx="188" cy="108" rx="5" ry="4" fill="#10B981"/>
    <ellipse cx="212" cy="108" rx="5" ry="4" fill="#10B981"/>
  </svg>
);

interface UserData {
  id: string;
  email: string;
  name: string;
  company: string;
  balance: number;
  subscription_tier: string;
}

interface PendingPayment {
  payment_id: string;
  amount: number;
  analysis_id: string;
}

interface HistoryItem {
  analysis_id: string;
  file_name: string;
  total_transacciones: number;
  costo: number;
  pagado: boolean;
  created_at: string;
  resumen: {
    preocupante: number;
    inusual: number;
    relevante: number;
    estrategia: string;
  };
  original_file_path?: string;
  processed_file_path?: string;
  xml_path?: string;
}

interface ApiKey {
  key: string;
  created_at: string;
  requests_count: number;
  active: boolean;
}

interface TarantulaHawkPortalProps {
  user: UserData;
}

// Transactions produced by an analysis run
interface AnalysisTransaction {
  id: string;
  monto: number;
  fecha: string;
  tipo_operacion: string;
  sector_actividad: string;
  clasificacion: string;
  risk_score: number;
  razones?: string[];
  // 🆕 Campos de Explicabilidad
  score_ebr?: number;
  hora?: string;
  nivel_confianza?: 'alta' | 'media' | 'baja';
  explicacion_principal?: string;
  explicacion_detallada?: string;
  flags?: {
    requiere_revision_manual: boolean;
    sugerir_reclasificacion: boolean;
    alertas: Array<{
      tipo: string;
      severidad: 'info' | 'warning' | 'error';
      mensaje: string;
      de?: string;
      a?: string;
    }>;
  };
  contexto_regulatorio?: string;
  acciones_sugeridas?: string[];
  probabilidades?: Record<string, number>;
  origen?: string;
}

interface MockResults {
  resumen: {
    total_transacciones: number;
    preocupante: number;
    inusual: number;
    relevante: number;
    limpio: number;
    false_positive_rate: number;
    processing_time_ms: number;
    ai_nuevos_casos?: number;
  };
  transacciones: AnalysisTransaction[];
  costo: number;
  analysis_id: string;
  success?: boolean;
  xml_path?: string;
  file_name?: string;
}

const TarantulaHawkPortal = ({ user: initialUser }: TarantulaHawkPortalProps) => {
  // Supabase client for auth (using @supabase/ssr for compatibility)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // Helper to get auth token
  const getAuthToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error(language === 'es' 
          ? 'Sesión expirada. Por favor inicia sesión nuevamente.' 
          : 'Session expired. Please login again.');
      }
      return session.access_token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw error;
    }
  };
  
  // Backend API URL (set in useEffect to guarantee client-side only)
  const [API_URL, setApiUrl] = useState<string>('');
  const [language, setLanguage] = useState<'es' | 'en'>('es'); // Default: Spanish
  const [activeTab, setActiveTab] = useState('upload');
  const [user, setUser] = useState<UserData>(initialUser);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<MockResults | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [authToken, setAuthToken] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [estimatedTransactions, setEstimatedTransactions] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [skipNoSupervised, setSkipNoSupervised] = useState<boolean>(false);
  const [fileStats, setFileStats] = useState<{rows: number, fileName: string, fileSize: number} | null>(null);
  const [processingStage, setProcessingStage] = useState<string>(''); // '', 'uploading', 'validating', 'ml_supervised', 'ml_unsupervised', 'ml_reinforcement', 'generating_report', 'complete'
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [progressDetails, setProgressDetails] = useState<any>({});
  const [selectedAmount, setSelectedAmount] = useState<number>(500); // Default to $500
  const [fileReadyForAnalysis, setFileReadyForAnalysis] = useState<boolean>(false);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [fileUploaded, setFileUploaded] = useState<boolean>(false); // Track if file has been uploaded
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'info' | 'warning', message: string} | null>(null);
  const [classificationFilter, setClassificationFilter] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<string | null>(null);
  
  // Estado para modal de detalles de transacción
  const [selectedTransaction, setSelectedTransaction] = useState<AnalysisTransaction | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Initialize API URL (client-side only, in useEffect to avoid SSR)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Priority 1: Explicit environment variable (if backend is external Python service)
      if (process.env.NEXT_PUBLIC_BACKEND_API_URL) {
        setApiUrl(process.env.NEXT_PUBLIC_BACKEND_API_URL);
        console.log('[API_URL] Using environment variable:', process.env.NEXT_PUBLIC_BACKEND_API_URL);
      }
      // Priority 2: GitHub Codespaces detection
      else if (window.location.hostname.includes('github.dev')) {
        const backendHost = window.location.hostname.replace('-3000.app', '-8000.app');
        setApiUrl(`https://${backendHost}`);
        console.log('[API_URL] Codespaces detected:', `https://${backendHost}`);
      }
      // Priority 3: Production - use Next.js API routes (same origin)
      else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setApiUrl(''); // Empty string means same-origin API routes
        console.log('[API_URL] Production: using Next.js API routes (same origin)');
      }
      // Priority 4: Local development - try Python backend on localhost:8000
      else {
        setApiUrl('http://localhost:8000');
        console.log('[API_URL] Local development: http://localhost:8000');
      }
    }
  }, []);
  const [customAmount, setCustomAmount] = useState<string>(''); // For custom input

  // Update user state if props change
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  // Cache auth token for child components (e.g., History panel downloads)
  useEffect(() => {
    (async () => {
      try {
        const t = await getAuthToken();
        setAuthToken(t);
      } catch {
        // ignore; user may be logged out or session not ready yet
      }
    })();
  }, []);

  // Fetch role/tier to decide Admin tab visibility
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/api/admin/check-role', { credentials: 'same-origin' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.authenticated) {
            setUserRole(data.role || null);
            setUserTier(data.tier || null);
            setIsAdmin((data.role === 'admin') || (data.tier === 'enterprise'));
          } else {
            setIsAdmin(false);
          }
        }
      } catch (e) {
        setIsAdmin(false);
      }
    })();
  }, []);

  // Function to refresh user balance from server
  const refreshUserBalance = async () => {
    try {
      const response = await fetch('/api/usage');
      if (response.ok) {
        const data = await response.json();
        if (data.ok && typeof data.balanceUsd === 'number') {
          setUser(prev => ({
            ...prev,
            balance: data.balanceUsd
          }));
        }
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  };

  // Calculate cost based on transaction count (shared pricing util)
  // Note: uses $1/$0.75/$0.50 tiers and continues at $0.50 beyond 5,000
  // to ensure consistent per-transaction pricing for high volumes.
  const calculateCost = (numTransactions: number): number => calculateTieredCost(numTransactions);

  // Improved estimation: Parse file locally to count actual rows
  const estimateTransactionsFromFile = async (file: File): Promise<{rows: number, fileName: string, fileSize: number}> => {
    try {
      // Usar el endpoint de parsing para obtener count exacto
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/excel/parse', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        // Render pretty error in statusMessage box, not browser alert
        const errorMsg = (result && (result.error || result.detail)) || 'Error al procesar el archivo';
        setStatusMessage({
          type: 'error',
          message: language === 'es' 
            ? `Validación fallida: ${typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}`
            : `Validation failed: ${typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}`
        });
        throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
      }
      
      if (result.success && result.rowCount !== undefined) {
        if (Array.isArray(result.columns)) {
          const cols = (result.columns as string[]).map(c => c.toLowerCase().trim());
          setDetectedColumns(cols);
        }
        return {
          rows: result.rowCount,
          fileName: file.name,
          fileSize: file.size
        };
      }
      
      // Fallback: estimación por tamaño
      return {
        rows: Math.floor(file.size / 200),
        fileName: file.name,
        fileSize: file.size
      };
    } catch (e) {
      // Error: no estimar filas para evitar confusiones (p.ej., "47 transacciones")
      if (e instanceof Error) console.warn('estimateTransactionsFromFile error:', e.message);
      // Ensure file is not considered ready after parse/validation error
      setFileReadyForAnalysis(false);
      return {
        rows: 0,
        fileName: file.name,
        fileSize: file.size
      };
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFileStats(null);
    setEstimatedTransactions(0);
    setEstimatedCost(0);
    setInsufficientFunds(false);
    setProcessingStage('');
    setProcessingProgress(0);
    setDetectedColumns([]);
    setFileUploaded(false); // Re-enable upload button
    setFileReadyForAnalysis(false);
    setUploadedFileId(null);
    setStatusMessage(null);
    // Reset file input to allow re-uploading
    const input = document.getElementById('file-upload') as HTMLInputElement;
    if (input) input.value = '';
  };

  const handleFileUpload = async (file: File) => {
    // Wait for API_URL to be initialized
    if (API_URL === undefined) {
      alert(language === 'es' 
        ? 'Inicializando conexión con backend...' 
        : 'Initializing backend connection...');
      return;
    }
    
    // Check if backend is available (production without external backend)
    if (API_URL === '' && typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      alert(language === 'es'
        ? 'El backend de ML no está disponible actualmente. Por favor contacta al administrador.'
        : 'ML backend is not currently available. Please contact administrator.');
      return;
    }
    
    // Validate file size (500MB max)
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      alert(language === 'es' 
        ? `Archivo demasiado grande. Máximo permitido: 500MB. Tu archivo: ${(file.size / 1024 / 1024).toFixed(2)}MB`
        : `File too large. Maximum allowed: 500MB. Your file: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }
    
    // Reset state prior to starting a new validation flow
    setStatusMessage(null);
    setFileReadyForAnalysis(false);
    setUploadedFileId(null);
    setFileUploaded(false);

    setIsLoading(true);
    setSelectedFile(file);
    // Disable upload button immediately; will re-enable if validation fails
    setFileUploaded(true);
    
    // Stage 1: Uploading
    setProcessingStage('uploading');
    setProcessingProgress(5);
    
    // Estimate transactions and cost before upload (async now)
    const stats = await estimateTransactionsFromFile(file);
    setFileStats(stats);
    
    const txnCount = stats.rows;
    const cost = calculateCost(txnCount);
    setEstimatedTransactions(txnCount);
    setEstimatedCost(cost);
    
    // Check if user has sufficient funds
    if (cost > user.balance) {
      setInsufficientFunds(true);
      setIsLoading(false);
      setProcessingStage('');
      setProcessingProgress(0);
      return; // Don't show alert, show visual warning instead
    } else {
      setInsufficientFunds(false);
    }
    
    try {
      // Solo validar archivo (NO procesarlo aún)
      const formData = new FormData();
      formData.append('file', file);
      
      setProcessingStage('uploading');
      setProcessingProgress(50);
      
      console.log('📤 Validando archivo:', {
        fileName: file.name,
        size: file.size,
        userId: user.id
      });
      
      // Validate does NOT require auth; avoid custom headers to prevent CORS preflight
      const response = await fetch(`${API_URL}/api/portal/validate`, {
        method: 'POST',
        body: formData,
        // Include credentials so the GitHub Codespaces proxy authorizes the cross-port request
        credentials: 'include',
      });
      
      setProcessingProgress(100);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error ${response.status}`;
        let detailedError = null;
        
        try {
          const errorJson = JSON.parse(errorText);
          
          // Handle 400 error with missing columns detail
          if (response.status === 400 && errorJson.detail) {
            const detail = errorJson.detail;
            
            // If detail is an object with missing_columns
            if (typeof detail === 'object' && detail.missing_columns) {
              const missing = detail.missing_columns;
              const required = detail.required || [];
              
              errorMessage = language === 'es'
                ? `Archivo inválido - Faltan campos obligatorios: ${missing.join(', ')}`
                : `Invalid file - Missing required fields: ${missing.join(', ')}`;
              
              detailedError = {
                missing: missing,
                required: required
              };
            } 
            // If detail is a string
            else if (typeof detail === 'string') {
              errorMessage = detail;
            }
            // If detail has error property
            else if (detail.error) {
              errorMessage = detail.error;
              if (detail.missing_columns) {
                detailedError = {
                  missing: detail.missing_columns,
                  required: detail.required || []
                };
              }
            }
          } else {
            errorMessage = errorJson.detail || errorJson.error || errorJson.message || errorMessage;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        setStatusMessage({
          type: 'error',
          message: errorMessage
        });
        
        // Ensure analyze is disabled after validation failure
        setFileReadyForAnalysis(false);
        setUploadedFileId(null);
        setFileUploaded(false);
        setIsLoading(false);
        setProcessingStage('');
        setProcessingProgress(0);
        
        // Clear file stats to show 0 transactions
        setFileStats({
          rows: 0,
          fileName: file.name,
          fileSize: file.size
        });
        setEstimatedTransactions(0);
        setEstimatedCost(0);
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      
      console.log('✅ Archivo validado:', result);
      
      // Guardar columnas detectadas del Excel
      if (result.columns && Array.isArray(result.columns)) {
        setDetectedColumns(result.columns);
        console.log('📋 Columnas detectadas:', result.columns);
      }

      if (response.ok && result.success) {
        // Archivo listo para análisis - esperar confirmación del usuario
        setUploadedFileId(result.file_id);
        setFileReadyForAnalysis(true);
        setFileUploaded(true); // Disable upload button until file is cleared
        setProcessingStage('');
        setProcessingProgress(0);
        setIsLoading(false);
        
        console.log('🎯 Estado actualizado:', {
          fileReadyForAnalysis: true,
          uploadedFileId: result.file_id,
          estimatedTransactions: txnCount,
          estimatedCost: cost,
          insufficientFunds: false
        });
        
        setStatusMessage({
          type: 'success',
          message: language === 'es'
            ? `Archivo validado: ${txnCount} transacciones. Costo: $${cost.toFixed(2)}. Haz clic en "Analizar con IA" para continuar.`
            : `File validated: ${txnCount} transactions. Cost: $${cost.toFixed(2)}. Click "Analyze with AI" to continue.`
        });
        return; // No procesar todavía
      } else if (response.status === 402) {
        // Payment required (402 status from backend)
        const errorDetail = result.detail || result;
        setInsufficientFunds(true);
        setProcessingStage('');
        setProcessingProgress(0);
        setStatusMessage({
          type: 'error',
          message: language === 'es'
            ? `Fondos insuficientes. ${errorDetail.error || 'Saldo insuficiente.'}`
            : `Insufficient funds. ${errorDetail.error || 'Insufficient balance.'}`
        });
        setActiveTab('add-funds');
      } else {
        // Any other error: ensure analyze disabled and state reset
        setFileReadyForAnalysis(false);
        setUploadedFileId(null);
        setFileUploaded(false);
        setIsLoading(false);
        setProcessingStage('');
        setProcessingProgress(0);
        throw new Error(result.error || 'Error processing file');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setProcessingStage('');
      setProcessingProgress(0);
      
      // Only set status message if not already set (to avoid overwriting detailed error)
      if (!statusMessage) {
        setStatusMessage({
          type: 'error',
          message: language === 'es'
            ? `Error al validar archivo: ${message}`
            : `Error validating file: ${message}`
        });
      }
      
      // Defensive: make sure analyze is disabled after any error
      setFileReadyForAnalysis(false);
      setUploadedFileId(null);
      setFileUploaded(false);
    } finally {
      setIsLoading(false);
    }
  };


  // ============================================================================
  // SISTEMA DE PROGRESO EN TIEMPO REAL
  // ============================================================================
  const pollProgress = async (analysisId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/portal/progress/${analysisId}`);
        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }
        
        const progress = await response.json();
        
        // Actualizar estados del progreso
        setProcessingStage(progress.stage);
        setProcessingProgress(progress.progress);
        setProgressDetails(progress.details || {});
        
        console.log('📊 Progress update:', progress);
        
        // Si completó, detener polling
        if (progress.stage === 'complete' && progress.progress === 100) {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        clearInterval(pollInterval);
      }
    }, 500); // Poll cada 500ms
    
    // Limpiar después de 5 minutos
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
  };

  const handleAnalyzeWithAI = async () => {
    if (!selectedFile || !uploadedFileId) {
      alert('No file selected');
      return;
    }

    setIsLoading(true);
    setFileReadyForAnalysis(false);

    try {
  	// Get auth token from Supabase
  	const token = await getAuthToken();
  
  	// Send file for processing
  	const formData = new FormData();
  	formData.append('file', selectedFile);
  	setProcessingStage('ml_supervised');
  	setProcessingProgress(10);
  	console.log('🤖 Iniciando análisis con IA...');
  
      const headers: any = {
        'Authorization': `Bearer ${token}`,
        'X-User-ID': user.id,
      };
      if (skipNoSupervised) headers['X-Skip-No-Supervised'] = '1';

      const response = await fetch(`${API_URL}/api/portal/upload`, {
    	  method: 'POST',
        headers: headers,
          body: formData,
          credentials: 'include',
        });
  
        if (!response.ok) {
          const errorText = await response.text();
        let errorMessage = `Error ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('✅ Análisis completado:', result);

      // Transformar la respuesta del backend al formato esperado por el portal
      const transformedResult = {
        success: true,
        analysis_id: result.analysis_id,
        resumen: {
          total_transacciones: result.resumen.total_transacciones,
          preocupante: result.resumen.clasificacion_final?.preocupante ?? result.resumen.preocupante ?? 0,
          inusual: result.resumen.clasificacion_final?.inusual ?? result.resumen.inusual ?? 0,
          relevante: result.resumen.clasificacion_final?.relevante ?? result.resumen.relevante ?? 0,
          limpio: result.resumen.total_transacciones - (
                 (result.resumen.clasificacion_final?.preocupante ?? result.resumen.preocupante ?? 0) +
                  (result.resumen.clasificacion_final?.inusual ?? result.resumen.inusual ?? 0) +
                  (result.resumen.clasificacion_final?.relevante ?? result.resumen.relevante ?? 0)),
          false_positive_rate: result.resumen.discrepancias_ebr_ml?.porcentaje || 0,
          processing_time_ms: 0, // No viene en el JSON actual
          ai_nuevos_casos: result.resumen.alertas_generadas || 0
        },
        transacciones: (result.transacciones || []).map((tx: any) => ({
          id: tx.id || '',
          monto: typeof tx.monto === 'string' 
            ? parseFloat(tx.monto.replace(/[$,MXN]/g, '')) || 0
            : tx.monto || 0,
          fecha: tx.fecha || '',
          tipo_operacion: tx.tipo_operacion || '',
          sector_actividad: tx.sector_actividad || '',
          clasificacion: tx.clasificacion ?? null,
          risk_score: tx.score_ebr || tx.risk_score || 0,
          score_ebr: tx.score_ebr || 0,
          explicacion_principal: tx.explicacion_principal || '',
          razones: tx.razones || [],
          hora: tx.hora || 'N/A',
          nivel_confianza: tx.nivel_confianza || 'media',
          explicacion_detallada: tx.explicacion_detallada || '',
          flags: tx.flags || {
            requiere_revision_manual: false,
            sugerir_reclasificacion: false,
            alertas: []
          },
          contexto_regulatorio: tx.contexto_regulatorio || '',
          acciones_sugeridas: tx.acciones_sugeridas || [],
          probabilidades: tx.probabilidades || {},
          origen: tx.origen || 'ebr'
        })),
        costo: result.costo || 0,
        xml_path: result.xml_path,
        file_name: selectedFile.name
      };

      console.log('Transformed result summary:', transformedResult.resumen);
      console.log('First transformed transaction:', transformedResult.transacciones[0]);

      if (result.success) {
        // Progress through ML stages
        setProcessingStage('ml_unsupervised');
        setProcessingProgress(45);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setProcessingStage('ml_reinforcement');
        setProcessingProgress(75);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setProcessingStage('generating_report');
        setProcessingProgress(90);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setProcessingStage('complete');
        setProcessingProgress(100);
        
        // Success - usar resultado transformado
        setCurrentAnalysis(transformedResult);

        // Agregar al historial local inmediatamente (shape unify with backend)
        setHistory(prev => [
          {
            analysis_id: result.analysis_id,
            file_name: selectedFile.name,
            total_transacciones: result.resumen.total_transacciones,
            costo: result.costo || 0,
            pagado: true,
            created_at: new Date().toISOString(),
            resumen: {
              preocupante: result.resumen.clasificacion_final?.preocupante ?? result.resumen.preocupante ?? 0,
              inusual: result.resumen.clasificacion_final?.inusual ?? result.resumen.inusual ?? 0,
              relevante: result.resumen.clasificacion_final?.relevante ?? result.resumen.relevante ?? 0,
              estrategia: result.resumen.estrategia || 'ebr'
            },
            xml_path: result.xml_path
          },
          ...prev
        ]);
        
        // Update user balance
        setUser(prev => ({
          ...prev,
          balance: prev.balance - (result.costo || 0)
        }));
        
        await refreshUserBalance();
        
        setProcessingStage('');
        setProcessingProgress(0);
        setActiveTab('dashboard');
        setClassificationFilter(null);
      } else if (response.status === 402) {
        // Fondos insuficientes: cambiar a pestaña de fondos con mensaje claro
        setActiveTab('add-funds');
        setStatusMessage({
          type: 'error',
          message: language === 'es'
            ? `Fondos insuficientes. ${result?.error || ''}`
            : `Insufficient funds. ${result?.error || ''}`
        });
      } else {
        throw new Error(result.error || 'Analysis failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setProcessingStage('');
      setProcessingProgress(0);
      setStatusMessage({
        type: 'error',
        message: language === 'es'
          ? `Error en análisis: ${message}`
          : `Analysis error: ${message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (paymentMethod: string) => {
    if (!pendingPayment) return;

    try {
      const response = await fetch(`${API_URL}/api/payment/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.id
        },
        body: JSON.stringify({
          payment_id: pendingPayment.payment_id,
          method: paymentMethod,
          payment_token: 'mock_token_' + Date.now()
        })
      });

      const result = await response.json();

      if (result.success) {
        // Reload analysis with full results
        const analysisResponse = await fetch(`${API_URL}/analysis/${result.analysis_id}`, {
          headers: { 'X-User-ID': user.id }
        });
        
        const analysisData: MockResults = await analysisResponse.json();
        setCurrentAnalysis(analysisData);
        setShowPayment(false);
        setPendingPayment(null);
        setActiveTab('dashboard');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Payment error: ' + message);
    }
  };

  const loadHistory = async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/api/history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-ID': user.id
        }
      });
      if (!response.ok) {
        console.warn('History API not available yet');
        return;
      }
      const data = await response.json();
      // Normalize backend items to HistoryItem shape
      const items: HistoryItem[] = (data.historial || []).map((h: any) => ({
        analysis_id: h.analysis_id,
        file_name: h.file_name || h.nombre_archivo || 'archivo.csv',
        total_transacciones: h.total_transacciones || h.total || 0,
        costo: typeof h.costo === 'number' ? h.costo : (h.cost || 0),
        pagado: h.pagado !== undefined ? h.pagado : true,
        created_at: h.created_at || h.timestamp || new Date().toISOString(),
        resumen: {
          preocupante: h.resumen?.preocupante ?? h.preocupante ?? 0,
          inusual: h.resumen?.inusual ?? h.inusual ?? 0,
          relevante: h.resumen?.relevante ?? h.relevante ?? 0,
          estrategia: h.resumen?.estrategia || h.estrategia || 'hibrida'
        },
        original_file_path: h.original_file_path,
        processed_file_path: h.processed_file_path,
        xml_path: h.xml_path
      }));
      setHistory(items);
    } catch (error) {
      console.warn('History API not available:', error);
      // Gracefully continue - history will remain empty
    }
  };

  const loadApiKeys = async () => {
    try {
      const response = await fetch(`${API_URL}/api/enterprise/api-keys`, {
        headers: { 'X-User-ID': user.id }
      });
      if (!response.ok) {
        console.warn('API keys endpoint not available yet');
        return;
      }
      const data = await response.json();
      setApiKeys(data.api_keys || []);
    } catch (error) {
      console.warn('API keys endpoint not available:', error);
      // Gracefully continue
    }
  };

  useEffect(() => {
    if (user && activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (user && activeTab === 'api-keys') {
      loadApiKeys();
    }
  }, [activeTab, user]);

  // Mock results for demonstration - only show when explicitly requested
  const mockResults: MockResults | null = {
    resumen: {
      total_transacciones: 8,
      preocupante: 3,
      inusual: 2,
      relevante: 3,
      limpio: 0,
      false_positive_rate: 8.2,
      processing_time_ms: 2300
    },
    transacciones: [
      { id: 'TXN-00001', monto: 185000, fecha: '2025-01-15', tipo_operacion: 'deposito_efectivo', sector_actividad: 'casa_cambio', clasificacion: 'preocupante', risk_score: 9.2, razones: ['Monto elevado', 'Sector alto riesgo', 'Patrón estructuración'] },
      { id: 'TXN-00002', monto: 165000, fecha: '2025-01-15', tipo_operacion: 'transferencia', sector_actividad: 'joyeria', clasificacion: 'preocupante', risk_score: 8.8, razones: ['Patrón estructuración', 'Sector alto riesgo'] },
      { id: 'TXN-00003', monto: 152000, fecha: '2025-01-14', tipo_operacion: 'deposito_efectivo', sector_actividad: 'inmobiliaria', clasificacion: 'preocupante', risk_score: 8.5, razones: ['Patrón estructuración', 'Alta frecuencia'] },
      { id: 'TXN-00004', monto: 95000, fecha: '2025-01-14', tipo_operacion: 'transferencia_internacional', sector_actividad: 'comercio', clasificacion: 'inusual', risk_score: 7.2, razones: ['Transferencia internacional', 'Monto elevado'] },
      { id: 'TXN-00005', monto: 88500, fecha: '2025-01-13', tipo_operacion: 'retiro_efectivo', sector_actividad: 'restaurante', clasificacion: 'inusual', risk_score: 6.9, razones: ['Monto elevado', 'Patrón inusual'] },
      { id: 'TXN-00006', monto: 120000, fecha: '2025-01-13', tipo_operacion: 'deposito', sector_actividad: 'automotriz', clasificacion: 'inusual', risk_score: 6.5, razones: ['Monto elevado'] },
      { id: 'TXN-00007', monto: 75000, fecha: '2025-01-12', tipo_operacion: 'transferencia', sector_actividad: 'tecnologia', clasificacion: 'relevante', risk_score: 5.8, razones: ['Monto moderado'] },
      { id: 'TXN-00008', monto: 68000, fecha: '2025-01-12', tipo_operacion: 'deposito', sector_actividad: 'retail', clasificacion: 'relevante', risk_score: 5.2, razones: ['Monto moderado'] }
    ],
    costo: 3811.75,
    analysis_id: 'demo-analysis-001'
  };

  // Use currentAnalysis if available, otherwise mockResults if explicitly set
  const displayAnalysis = currentAnalysis || mockResults;

  // Hook para mapear / obtener filas preparadas para la tabla
  const { rows: analisisRows, loading: analisisLoading } = useAnalisisTransacciones(
    displayAnalysis?.analysis_id || null,
    displayAnalysis?.transacciones || []
  );

  
  // ============================================================================
  // COMPONENTE: Detalles del Progreso ML
  // ============================================================================
  const ProgressDetailsDisplay = () => {
    if (!progressDetails || Object.keys(progressDetails).length === 0) return null;
    
    return (
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-teal-500/30">
        <h4 className="text-sm font-semibold text-teal-400 mb-3">Detalles del Análisis en Tiempo Real</h4>
        <div className="space-y-2 text-xs text-gray-300">
          {progressDetails.total_transacciones !== undefined && (
            <div className="flex justify-between pb-2 border-b border-gray-700">
              <span className="text-gray-400">Total de transacciones:</span>
              <span className="font-mono text-white font-semibold">{progressDetails.total_transacciones.toLocaleString()}</span>
            </div>
          )}
          
          {progressDetails.casos_detectados_supervisado !== undefined && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                IA Supervisada:
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                {progressDetails.casos_detectados_supervisado} casos detectados
              </span>
            </div>
          )}
          
          {progressDetails.anomalias_adicionales !== undefined && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                IA No Supervisada:
              </span>
              <span className="font-mono text-teal-400 font-semibold">
                {progressDetails.anomalias_adicionales} anomalías adicionales
              </span>
            </div>
          )}
          
          {progressDetails.ajustes_threshold !== undefined && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                IA de Refuerzo:
              </span>
              <span className="font-mono text-yellow-400 font-semibold">
                {progressDetails.ajustes_threshold} thresholds ajustados
              </span>
            </div>
          )}
          
          {progressDetails.preocupante !== undefined && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-500 mb-2 text-center">Clasificación Final</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-blue-500/10 rounded">
                  <div className="text-blue-400 font-bold text-lg">{progressDetails.preocupante}</div>
                  <div className="text-xs text-gray-500">Preocupante</div>
                </div>
                <div className="text-center p-2 bg-emerald-500/10 rounded">
                  <div className="text-emerald-400 font-bold text-lg">{progressDetails.inusual}</div>
                  <div className="text-xs text-gray-500">Inusual</div>
                </div>
                <div className="text-center p-2 bg-yellow-500/10 rounded">
                  <div className="text-yellow-400 font-bold text-lg">{progressDetails.relevante}</div>
                  <div className="text-xs text-gray-500">Relevante</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

return (
    <div className="min-h-screen bg-black text-white">
      {/* Header with Navigation */}
      <header className="bg-gray-900/80 backdrop-blur-sm border-b border-emerald-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <TarantulaHawkLogo />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400 bg-clip-text text-transparent">TARANTULAHAWK</h1>
                <p className="text-xs text-gray-400">AML Compliance Portal</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'upload'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Database className="w-4 h-4" />
                {language === 'es' ? 'Datos' : 'Data'}
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
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
                {language === 'es' ? 'Historial' : 'History'}
              </button>
              <button
                onClick={() => setActiveTab('add-funds')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === 'add-funds'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                {language === 'es' ? 'Fondos' : 'Funds'}
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
                  <User className="w-4 h-4" />
                  Admin
                </button>
              )}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-white font-medium">{user.name}</p>
                <p className="text-xs text-gray-400">${user.balance.toFixed(2)} USD</p>
              </div>
              <button
                onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                className="px-3 py-2 border border-gray-700 rounded-lg text-sm hover:border-emerald-500 transition"
              >
                {language === 'es' ? 'EN' : 'ES'}
              </button>
              <button
                onClick={() => setShowProfileModal(true)}
                className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
              >
                <span className="font-bold">{user.email[0].toUpperCase()}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* ML Progress Tracker - ALWAYS VISIBLE */}
        <div className="mb-6">
          <MLProgressTracker 
            stage={processingStage}
            progress={processingProgress}
            language={language}
            fileName={selectedFile?.name}
          />
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h2 className="text-xl font-bold mb-4">{language === 'es' ? 'Subir Datos de Transacciones' : 'Upload Transaction Data'}</h2>
              
              {/* File Format Info - CSV Only */}
              <div className="flex items-center justify-center gap-6 mb-4 text-sm">
                <div className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-gray-800 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-300">CSV</span>
                </div>
                <div className="text-gray-700">|</div>
                <div className="flex items-center gap-2 px-4 py-2 bg-black/50 border border-gray-800 rounded-lg">
                  <Database className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-600">{language === 'es' ? 'Máx 500MB' : 'Max 500MB'}</span>
                </div>
              </div>

              {/* Upload Area - REDUCED SIZE */}
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-3 text-center hover:border-teal-500 transition mb-4">
                <Database className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <div className="text-sm font-semibold mb-1">{language === 'es' ? 'Arrastra tu archivo aquí o haz clic para seleccionar' : 'Drop your file here or click to browse'}</div>
                <div className="text-xs text-gray-500 mb-2">
                  {language === 'es' ? 'Solo CSV hasta 500MB. Exporta Excel como CSV.' : 'CSV only up to 500MB. Export Excel as CSV.'}
                </div>
                
                {/* Estimated Cost Display - COMPACT */}
                {estimatedTransactions > 0 && (
                  <div className="mb-2 p-2 bg-teal-900/20 border border-teal-800/30 rounded-lg">
                    <div className="text-xs font-semibold text-teal-400 mb-1">
                      {language === 'es' ? 'Costo Estimado' : 'Estimated Cost'}
                    </div>
                    <div className="text-sm font-bold mb-1">${estimatedCost.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">
                      {estimatedTransactions.toLocaleString()} {language === 'es' ? 'transacciones' : 'transactions'}
                    </div>
                    {insufficientFunds && (
                      <div className="mt-1 text-xs text-blue-400 flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {language === 'es' ? 'Fondos insuficientes' : 'Insufficient funds'}
                      </div>
                    )}
                  </div>
                )}
                
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`inline-block px-4 py-2 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-semibold transition text-sm ${
                    fileUploaded || isLoading 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:from-blue-700 hover:to-emerald-600 cursor-pointer'
                  }`}
                  onClick={(e) => {
                    if (fileUploaded || isLoading) {
                      e.preventDefault();
                    }
                  }}
                >
                  {language === 'es' ? 'Seleccionar Archivo' : 'Select File'}
                </label>
              </div>

              {/* ANALYZE BUTTON */}
              {fileReadyForAnalysis && (
                <div className="mb-4 flex flex-col items-center gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input
                        type="checkbox"
                        checked={skipNoSupervised}
                        onChange={(e) => setSkipNoSupervised(e.target.checked)}
                        className="h-4 w-4 text-teal-500 rounded"
                      />
                      <span className="text-xs">
                        {language === 'es' ? 'Omitir IA no supervisada (debug)' : 'Skip Unsupervised AI (debug)'}
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-center">
                  <button 
                    onClick={handleAnalyzeWithAI}
                    disabled={isLoading}
                    className="px-6 py-3 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 max-w-xs"
                  >
                    <Zap className="w-4 h-4" />
                    {language === 'es' ? 'Analizar con IA' : 'Analyze with AI'}
                  </button>
                  </div>
                </div>
              )}

              {/* Detailed File Statistics Panel - COMPACT */}
              {fileStats && (
                <div className="mt-3 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                      {language === 'es' ? 'Análisis del Archivo' : 'File Analysis'}
                    </h3>
                    <button 
                      onClick={clearSelectedFile}
                      className="px-2 py-1 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {language === 'es' ? 'Eliminar' : 'Remove'}
                    </button>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-2 mb-2">
                    {/* File Info */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Archivo' : 'File'}</div>
                      <div className="font-semibold text-sm truncate">{fileStats.fileName}</div>
                      <div className="text-xs text-gray-600 mt-1">{(fileStats.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    
                    {/* Transaction Count */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Transacciones Detectadas' : 'Transactions Detected'}</div>
                      <div className="text-2xl font-bold text-teal-400">{fileStats.rows.toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-1">{language === 'es' ? 'filas procesables' : 'processable rows'}</div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-2 mb-2">
                    {/* Total Cost */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Costo Total' : 'Total Cost'}</div>
                      <div className="text-xl font-bold text-emerald-400">${estimatedCost.toFixed(2)} USD</div>
                    </div>
                    
                    {/* Available Balance */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Saldo Disponible' : 'Available Balance'}</div>
                      <div className="text-xl font-bold text-teal-400">${user.balance.toFixed(2)} USD</div>
                    </div>
                    
                    {/* Balance After Processing */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-2">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Saldo Después' : 'Balance After'}</div>
                      <div className={`text-xl font-bold ${user.balance >= estimatedCost ? 'text-green-400' : 'text-blue-400'}`}>
                        ${Math.max(0, user.balance - estimatedCost).toFixed(2)} USD
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Message Box - COMPACT */}
                  {statusMessage ? (
                    <div className={`rounded-lg p-3 flex items-start gap-3 ${
                      statusMessage.type === 'success' ? 'bg-teal-900/20 border border-teal-800/30' :
                      statusMessage.type === 'error' ? 'bg-blue-900/20 border border-blue-800/30' :
                      statusMessage.type === 'warning' ? 'bg-emerald-900/20 border border-emerald-800/30' :
                      'bg-blue-900/20 border border-blue-800/30'
                    }`}>
                      {statusMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />}
                      {statusMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />}
                      {statusMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <div className={`text-sm ${
                          statusMessage.type === 'success' ? 'text-gray-300' :
                          statusMessage.type === 'error' ? 'text-gray-300' :
                          statusMessage.type === 'warning' ? 'text-gray-300' :
                          'text-gray-300'
                        }`}>
                          {statusMessage.message}
                        </div>
                      </div>
                    </div>
                  ) : insufficientFunds ? (
                    <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-2 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-blue-400 mb-1">
                          {language === 'es' ? 'Fondos Insuficientes' : 'Insufficient Funds'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {language === 'es' 
                            ? `Necesitas $${(estimatedCost - user.balance).toFixed(2)} USD adicionales para procesar este archivo.` 
                            : `You need an additional $${(estimatedCost - user.balance).toFixed(2)} USD to process this file.`}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-teal-900/20 border border-teal-800/30 rounded-lg p-2 flex items-start gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-teal-400 mb-1">
                          {language === 'es' ? 'Listo para Procesar' : 'Ready to Process'}
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          {language === 'es' 
                            ? `Tu saldo es suficiente. Después del procesamiento tendrás $${(user.balance - estimatedCost).toFixed(2)} USD disponibles.`
                            : `Your balance is sufficient. After processing you'll have $${(user.balance - estimatedCost).toFixed(2)} USD available.`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Required Fields Info - COMPACT */}
              <div className="mt-3 p-2 bg-teal-900/20 border border-teal-800/30 rounded-lg">
                {(() => {
                  const required = ['cliente_id','monto','fecha','tipo_operacion','sector_actividad'];
                  const detectedSet = new Set(detectedColumns.map(c => c.toLowerCase().trim()));
                  const found = required.filter(r => detectedSet.has(r));
                  const missing = required.filter(r => !detectedSet.has(r));
                  return (
                    <>
                      <div className="text-sm font-semibold text-teal-400 mb-2">
                        {language === 'es' ? 'Campos de Datos Requeridos:' : 'Required Data Fields:'}
                      </div>
                      <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
                        {required.map((field) => (
                          <div key={field} className="flex items-center gap-1">
                            {detectedColumns.length > 0 ? (
                              detectedSet.has(field) 
                                ? <span className="text-green-400">✓</span>
                                : <span className="text-blue-400">✗</span>
                            ) : (
                              <span className="text-gray-500">•</span>
                            )}
                            <span className="text-gray-300">{field}</span>
                          </div>
                        ))}
                      </div>
                      {detectedColumns.length > 0 && (
                        <div className="mt-2 text-xs flex items-center gap-2">
                          {missing.length === 0 ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-teal-400" />
                              <span className="text-teal-400">{language === 'es' ? 'Todos los campos requeridos presentes' : 'All required fields present'}</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 text-blue-400" />
                              <span className="text-blue-400">{language === 'es' ? `Faltan: ${missing.join(', ')}` : `Missing: ${missing.join(', ')}`}</span>
                            </>
                          )}
                        </div>
                      )}
                      <button className="mt-2 text-xs text-teal-400 hover:text-teal-300 underline">
                        {language === 'es' ? 'Descargar Plantilla de Ejemplo' : 'Download Sample Template'}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-bold">{language === 'es' ? 'Resultados del Análisis' : 'Analysis Results'}</h2>
            </div>

            <div>
              {isLoading || analisisLoading ? (
                <LoadingSpinner message={language === 'es' ? 'Cargando resultados...' : 'Loading results...'} />
              ) : (
                <TablaResultados rows={analisisRows} onViewDetails={(id) => {
                  // find original transaction object in displayAnalysis and open modal
                  const original = (displayAnalysis?.transacciones || []).find((tx: any) => tx.id === id || tx.id_transaccion === id);
                  if (original) {
                    setSelectedTransaction(original as any);
                    setShowTransactionModal(true);
                  }
                }} />
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <Suspense fallback={<LoadingSpinner message={language === 'es' ? 'Cargando historial...' : 'Loading history...'} />}>
            <HistoryTab
              historyItems={history}
              apiUrl={API_URL}
              token={authToken}
              onViewDetails={(result) => {
                // Handle viewing analysis details
                console.log('View analysis details:', result);
              }}
              onDownloadReport={(result) => {
                // Handle downloading analysis report
                console.log('Download analysis report:', result);
              }}
            />
          </Suspense>
        )}

        {/* Add Funds Tab */}
        {activeTab === 'add-funds' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6">
                {language === 'es' ? 'Agregar Fondos a tu Cuenta' : 'Add Funds to Your Account'}
              </h2>
              
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {/* Quick Amount Options */}
                <button 
                  onClick={() => { setSelectedAmount(100); setCustomAmount(''); }}
                  className={`bg-gradient-to-br from-gray-800 to-black border-2 rounded-xl p-6 transition text-center ${
                    selectedAmount === 100 && !customAmount ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-gray-700 hover:border-teal-500'
                  }`}
                >
                  <div className="text-3xl font-black mb-2">$100</div>
                  <div className="text-sm text-gray-400">
                    {language === 'es' ? '~100 transacciones' : '~100 transactions'}
                  </div>
                </button>
                <button 
                  onClick={() => { setSelectedAmount(500); setCustomAmount(''); }}
                  className={`bg-gradient-to-br from-gray-800 to-black border-2 rounded-xl p-6 transition text-center ${
                    selectedAmount === 500 && !customAmount ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-gray-700 hover:border-teal-500'
                  }`}
                >
                  <div className="text-3xl font-black mb-2 bg-gradient-to-r from-blue-500 to-teal-400 bg-clip-text text-transparent">
                    $500
                  </div>
                  <div className="text-sm text-teal-400 font-semibold">
                    {language === 'es' ? 'Más Popular' : 'Most Popular'}
                  </div>
                </button>
                <button 
                  onClick={() => { setSelectedAmount(1000); setCustomAmount(''); }}
                  className={`bg-gradient-to-br from-gray-800 to-black border-2 rounded-xl p-6 transition text-center ${
                    selectedAmount === 1000 && !customAmount ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-gray-700 hover:border-teal-500'
                  }`}
                >
                  <div className="text-3xl font-black mb-2">$1,000</div>
                  <div className="text-sm text-gray-400">
                    {language === 'es' ? '~1,000 transacciones' : '~1,000 transactions'}
                  </div>
                </button>
              </div>

              {/* Custom Amount */}
              <div className="mb-8">
                <label className="block text-sm font-semibold mb-2">
                  {language === 'es' ? 'Cantidad Personalizada' : 'Custom Amount'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const val = e.target.value;
                      setCustomAmount(val);
                      if (val && parseFloat(val) > 0) {
                        setSelectedAmount(parseFloat(val));
                      }
                    }}
                    className={`w-full bg-black border rounded-lg pl-8 pr-4 py-3 text-lg focus:border-teal-500 outline-none ${
                      customAmount ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-gray-700'
                    }`}
                  />
                </div>
              </div>

              {/* Pricing table intentionally removed per request */}

              {/* Payment Methods */}
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    // TODO: Integrate Stripe Checkout or PayPal
                    // Example: window.location.href = `/api/paypal/create-order?amount=${selectedAmount}`
                    if (selectedAmount <= 0) {
                      alert(language === 'es' 
                        ? 'Por favor selecciona o ingresa una cantidad válida.'
                        : 'Please select or enter a valid amount.');
                      return;
                    }
                    alert(language === 'es' 
                      ? `Integración de pago en proceso. Monto seleccionado: $${selectedAmount.toFixed(2)}. Por favor contacta a soporte para agregar fondos.`
                      : `Payment integration in progress. Selected amount: $${selectedAmount.toFixed(2)}. Please contact support to add funds.`);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-emerald-500 rounded-lg font-bold hover:from-blue-700 hover:to-emerald-600 transition flex items-center justify-center gap-3"
                >
                  <CreditCard className="w-5 h-5" />
                  {language === 'es' 
                    ? `Pagar $${selectedAmount.toFixed(2)} con Tarjeta`
                    : `Pay $${selectedAmount.toFixed(2)} with Card`}
                </button>
                <button 
                  onClick={() => {
                    alert(language === 'es' 
                      ? 'Para transferencias bancarias, contacta a soporte@tarantulahawk.cloud'
                      : 'For bank transfers, contact soporte@tarantulahawk.cloud');
                  }}
                  className="w-full py-4 bg-gray-800 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-3"
                >
                  <Lock className="w-5 h-5" />
                  {language === 'es' ? 'Transferencia Bancaria' : 'Bank Transfer'}
                </button>
              </div>

              {/* Security Note */}
              <div className="mt-6 flex items-start gap-3 text-sm text-gray-400">
                <Lock className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                <p>
                  {language === 'es' 
                    ? 'Todos los pagos son procesados de forma segura. Tus datos financieros están protegidos con encriptación de nivel bancario.' 
                    : 'All payments are processed securely. Your financial data is protected with bank-level encryption.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab - Available for all users */}
        {activeTab === 'api-keys' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">API Keys</h2>
                <button className="px-4 py-2 bg-teal-600 rounded-lg font-semibold hover:bg-teal-700 transition">
                  Generate New Key
                </button>
              </div>

              {apiKeys.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Key className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="mb-4">No API keys generated yet</p>
                  <p className="text-sm">Generate an API key to start using our direct API integration</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key, i) => (
                    <div key={i} className="bg-black border border-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm mb-1">{key.key}</div>
                          <div className="text-xs text-gray-500">
                            Created: {new Date(key.created_at).toLocaleDateString()} • {key.requests_count} requests
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded text-xs font-bold ${key.active ? 'bg-teal-900/50 text-teal-400' : 'bg-blue-900/50 text-blue-400'}`}>
                          {key.active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* API Documentation */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4">API Endpoints</h3>
              <div className="space-y-4 text-sm">
                <div className="bg-black border border-gray-700 rounded p-3">
                  <div className="font-mono text-teal-400 mb-1">POST /api/v1/analizar</div>
                  <div className="text-gray-400">Analyze batch of transactions</div>
                </div>
                <div className="bg-black border border-gray-700 rounded p-3">
                  <div className="font-mono text-teal-400 mb-1">GET /api/analysis/{'{id}'}</div>
                  <div className="text-gray-400">Retrieve analysis results</div>
                </div>
                <div className="bg-black border border-gray-700 rounded p-3">
                  <div className="font-mono text-teal-400 mb-1">GET /api/xml/{'{id}'}</div>
                  <div className="text-gray-400">Download XML report</div>
                </div>
              </div>
              <a href="/api/docs" target="_blank" className="inline-block mt-4 text-teal-400 hover:text-teal-300 underline">
                View Full API Documentation →
              </a>
            </div>
          </div>
        )}

        {/* Admin Tab (only if role/tier allows) */}
        {activeTab === 'admin' && isAdmin && (
          <Suspense fallback={<LoadingSpinner message={language === 'es' ? 'Cargando panel de administración...' : 'Loading admin panel...'} />}>
            <AdminTab
              userRole={userRole || 'user'}
              onSystemCheck={async () => ({ database: true, api: true, security: true, cpu: 45, memory: 60, todayAnalyses: 150, activeUsers: 12, pendingAlerts: 3, logs: ['Sistema operativo', 'Base de datos conectada'] })}
              onExportData={() => {/* Implement export logic */}}
              onImportData={() => {/* Implement import logic */}}
              onClearCache={() => {/* Implement cache clear logic */}}
            />
          </Suspense>
        )}
      </div>

      {/* Payment Modal */}
      {showPayment && pendingPayment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <CreditCard className="w-16 h-16 text-teal-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold mb-2">Payment Required</h3>
              <p className="text-gray-400">Complete payment to unlock full results</p>
            </div>

            <div className="bg-black border border-gray-700 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Current Balance:</span>
                <span className="font-bold">${user.balance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Analysis Cost:</span>
                <span className="font-bold">${(pendingPayment.amount + user.balance).toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-700 my-2"></div>
              <div className="flex justify-between text-lg">
                <span className="text-gray-400">Amount Due:</span>
                <span className="font-black text-teal-400">${pendingPayment.amount.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <button 
                onClick={() => handlePayment('card')}
                className="w-full py-3 bg-teal-600 rounded-lg font-semibold hover:bg-teal-700 transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-5 h-5" />
                Pay with Card
              </button>
              <button className="w-full py-3 bg-gray-800 rounded-lg font-semibold hover:bg-gray-700 transition">
                Pay with Bank Transfer
              </button>
            </div>

            <button 
              onClick={() => setShowPayment(false)}
              className="w-full text-center text-gray-400 hover:text-white transition text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Full-screen loading overlay removed to keep progress bar visible */}

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onUpdate={(updatedData) => {
            setUser({ ...user, ...updatedData });
          }}
        />
      )}

      {/* Transaction Details Modal */}
      {showTransactionModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowTransactionModal(false)}>
          <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-teal-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gradient-to-r from-gray-900 to-black border-b border-gray-800 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <span className="text-teal-400">{language === 'es' ? 'Detalle de Transacción' : 'Transaction Details'}</span>
                  <span className="font-mono text-lg text-gray-400">{selectedTransaction.id}</span>
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {language === 'es' ? 'Análisis completo con sistema de explicabilidad' : 'Complete analysis with explainability system'}
                </p>
              </div>
              <button
                onClick={() => setShowTransactionModal(false)}
                className="p-2 hover:bg-gray-800 rounded-lg transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Score EBR */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-semibold text-teal-400">{language === 'es' ? 'Score EBR' : 'EBR Score'}</h4>
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-2 rounded-lg text-xl font-bold bg-white/10 text-white">
                      {selectedTransaction.score_ebr !== undefined ? selectedTransaction.score_ebr.toFixed(2) : 'N/A'}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-white/10 text-white border border-white/20">
                      {selectedTransaction.nivel_confianza ? (language === 'es' ? `Confianza: ${selectedTransaction.nivel_confianza}` : `Confidence: ${selectedTransaction.nivel_confianza}`) : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explicación Principal */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-blue-400 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {language === 'es' ? 'Explicación Principal' : 'Main Explanation'}
                </h4>
                <p className="text-gray-300 leading-relaxed">{selectedTransaction.explicacion_principal || '-'}</p>
              </div>

              {/* Explicación Detallada */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-300 mb-3">{language === 'es' ? 'Explicación Detallada' : 'Detailed Explanation'}</h4>
                <p className="text-gray-400 leading-relaxed whitespace-pre-line">{selectedTransaction.explicacion_detallada || '-'}</p>
              </div>

              {/* Flags de Revisión */}
              {selectedTransaction.flags && (selectedTransaction.flags.requiere_revision_manual || selectedTransaction.flags.sugerir_reclasificacion || selectedTransaction.flags.alertas.length > 0) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {language === 'es' ? 'Flags de Revisión' : 'Review Flags'}
                  </h4>
                  <div className="space-y-2">
                    {selectedTransaction.flags.requiere_revision_manual && (
                      <div className="flex items-center gap-2 text-yellow-400">
                        <span className="font-semibold">⚠️</span>
                        <span>{language === 'es' ? 'Requiere revisión manual' : 'Requires manual review'}</span>
                      </div>
                    )}
                    {selectedTransaction.flags.sugerir_reclasificacion && (
                      <div className="flex items-center gap-2 text-yellow-400">
                        <span className="font-semibold">🔄</span>
                        <span>{language === 'es' ? 'Se sugiere reclasificación' : 'Reclassification suggested'}</span>
                      </div>
                    )}
                    {selectedTransaction.flags.alertas.map((alerta: { tipo?: string; severidad: 'info' | 'warning' | 'error'; mensaje: string; de?: string; a?: string }, idx: number) => (
                      <div key={idx} className={`p-3 rounded-lg ${
                        alerta.severidad === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                        alerta.severidad === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                        'bg-blue-500/10 border border-blue-500/30'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className={`text-sm font-semibold ${
                            alerta.severidad === 'error' ? 'text-red-400' :
                            alerta.severidad === 'warning' ? 'text-yellow-400' :
                            'text-blue-400'
                          }`}>
                            {alerta.severidad === 'error' ? '🔴' : alerta.severidad === 'warning' ? '⚠️' : 'ℹ️'}
                          </span>
                          <div className="flex-1">
                            <p className={`text-sm ${
                              alerta.severidad === 'error' ? 'text-red-300' :
                              alerta.severidad === 'warning' ? 'text-yellow-300' :
                              'text-blue-300'
                            }`}>
                              {alerta.mensaje}
                            </p>
                            {alerta.de && alerta.a && (
                              <p className="text-xs text-gray-400 mt-1">
                                {language === 'es' ? 'Sugerencia: ' : 'Suggestion: '}
                                <span className="text-red-400">{alerta.de}</span> → <span className="text-emerald-400">{alerta.a}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Razones */}
              {selectedTransaction.razones && selectedTransaction.razones.length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-gray-300 mb-3">{language === 'es' ? 'Razones de Clasificación' : 'Classification Reasons'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTransaction.razones.map((razon: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-teal-500/10 text-teal-400 rounded-full text-sm border border-teal-500/30">
                        {razon}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contexto Regulatorio */}
              {selectedTransaction.contexto_regulatorio && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {language === 'es' ? 'Contexto Regulatorio' : 'Regulatory Context'}
                  </h4>
                  <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                    {selectedTransaction.contexto_regulatorio}
                  </div>
                </div>
              )}

              {/* Acciones Sugeridas */}
              {selectedTransaction.acciones_sugeridas && selectedTransaction.acciones_sugeridas.length > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    {language === 'es' ? 'Acciones Sugeridas' : 'Suggested Actions'}
                  </h4>
                  <ul className="space-y-2">
                    {selectedTransaction.acciones_sugeridas.map((accion, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-gray-300">
                        <span className="text-emerald-400 mt-0.5">•</span>
                        <span>{accion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Datos de la Transacción */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                <h4 className="text-lg font-semibold text-gray-300 mb-3">{language === 'es' ? 'Datos de la Transacción' : 'Transaction Data'}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">{language === 'es' ? 'ID:' : 'ID:'}</span>
                    <span className="ml-2 font-mono text-gray-300">{selectedTransaction.id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{language === 'es' ? 'Fecha:' : 'Date:'}</span>
                    <span className="ml-2 text-gray-300">{selectedTransaction.fecha}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{language === 'es' ? 'Monto:' : 'Amount:'}</span>
                    <span className="ml-2 font-mono text-teal-400 font-semibold">${selectedTransaction.monto.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{language === 'es' ? 'Tipo:' : 'Type:'}</span>
                    <span className="ml-2 text-gray-300">{selectedTransaction.tipo_operacion}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{language === 'es' ? 'Sector:' : 'Sector:'}</span>
                    <span className="ml-2 text-gray-300">{selectedTransaction.sector_actividad}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{language === 'es' ? 'Clasificación:' : 'Classification:'}</span>
                    <span className={`ml-2 font-semibold ${
                      selectedTransaction.clasificacion === 'preocupante' ? 'text-red-400' :
                      selectedTransaction.clasificacion === 'inusual' ? 'text-yellow-400' :
                      'text-emerald-400'
                    }`}>
                      {selectedTransaction.clasificacion}
                    </span>
                  </div>
                  {selectedTransaction.origen && (
                    <div>
                      <span className="text-gray-500">{language === 'es' ? 'Origen:' : 'Origin:'}</span>
                      <span className="ml-2 text-gray-300">{selectedTransaction.origen}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Probabilidades (si disponibles) */}
              {selectedTransaction.probabilidades && Object.keys(selectedTransaction.probabilidades).length > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                  <h4 className="text-lg font-semibold text-gray-300 mb-3">{language === 'es' ? 'Probabilidades del Modelo' : 'Model Probabilities'}</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedTransaction.probabilidades).map(([clase, prob]) => (
                      <div key={clase} className="flex items-center gap-3">
                        <span className="text-gray-400 w-24 capitalize">{clase}:</span>
                        <div className="flex-1 bg-gray-900 rounded-full h-6 overflow-hidden">
                          <div
                            className={`h-full flex items-center justify-end pr-2 text-xs font-semibold ${
                              clase === 'preocupante' ? 'bg-red-500' :
                              clase === 'inusual' ? 'bg-yellow-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${(prob * 100)}%` }}
                          >
                            {(prob * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-4 flex justify-end">
              <button
                onClick={() => setShowTransactionModal(false)}
                className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition"
              >
                {language === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TarantulaHawkPortal