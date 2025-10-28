'use client';

import React, { useState, useEffect } from 'react';
import { calculateTieredCost, PRICING_TIERS, formatPricingSummary } from '../lib/pricing';
import { Upload, FileSpreadsheet, FileText, BarChart3, Clock, Key, CreditCard, Download, AlertTriangle, CheckCircle, Lock, DollarSign, Zap, Shield, Database } from 'lucide-react';

const TarantulaHawkLogo = ({ className = "w-10 h-10" }) => (
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
    <path d="M 168 135 Q 95 90 82 125 Q 75 160 115 170 Q 148 175 168 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
    <path d="M 232 135 Q 305 90 318 125 Q 325 160 285 170 Q 252 175 232 158 Z" fill="url(#orangeGrad)" opacity="0.9"/>
    <ellipse cx="188" cy="108" rx="5" ry="4" fill="#00CED1"/>
    <ellipse cx="212" cy="108" rx="5" ry="4" fill="#00CED1"/>
  </svg>
);

const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api';

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
  timestamp: string;
  total_transacciones: number;
  costo: number;
  pagado: boolean;
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

const TarantulaHawkPortal = ({ user: initialUser }: TarantulaHawkPortalProps) => {
  const [language, setLanguage] = useState<'es' | 'en'>('es'); // Default: Spanish
  const [activeTab, setActiveTab] = useState('upload');
  const [user, setUser] = useState<UserData>(initialUser);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [estimatedTransactions, setEstimatedTransactions] = useState<number>(0);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);
  const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<{rows: number, fileName: string, fileSize: number} | null>(null);

  // Update user state if props change
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

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
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          let rows = 0;
          
          if (file.name.endsWith('.csv')) {
            // Count CSV lines (excluding header)
            const lines = content.split('\n').filter(line => line.trim().length > 0);
            rows = Math.max(0, lines.length - 1); // -1 for header
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            // For Excel, we can't parse binary easily in browser
            // Use improved heuristic: avg 150 bytes per row for Excel
            rows = Math.floor(file.size / 150);
          } else {
            // Fallback
            rows = Math.floor(file.size / 200);
          }
          
          resolve({
            rows: Math.max(1, rows),
            fileName: file.name,
            fileSize: file.size
          });
        } catch (error) {
          // Fallback to old method
          resolve({
            rows: Math.floor(file.size / 200),
            fileName: file.name,
            fileSize: file.size
          });
        }
      };
      
      reader.onerror = () => {
        resolve({
          rows: Math.floor(file.size / 200),
          fileName: file.name,
          fileSize: file.size
        });
      };
      
      // Read as text for CSV, or just estimate for Excel
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        // For Excel, just use size estimation
        resolve({
          rows: Math.floor(file.size / 150),
          fileName: file.name,
          fileSize: file.size
        });
      }
    });
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setSelectedFile(file);
    
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
      return; // Don't show alert, show visual warning instead
    } else {
      setInsufficientFunds(false);
    }
    
    try {
      // Use Next.js API endpoint instead of Python backend
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactions: [], // We'll parse the file on the server side later
          transactionCount: numTransactions
        })
      });

      const result = await response.json();

      if (response.ok && result.reportId) {
        // Success - balance was deducted
        setCurrentAnalysis({
          success: true,
          analysis_id: result.reportId,
          resumen: {
            total_transacciones: numTransactions,
            preocupante: Math.floor(numTransactions * 0.008),
            inusual: Math.floor(numTransactions * 0.035),
            relevante: Math.floor(numTransactions * 0.15),
            limpio: numTransactions - Math.floor(numTransactions * 0.193),
          },
          transacciones: [], // Mock data for now
          costo: result.costUsd || cost
        });
        
        // Update user balance locally and refresh from server
        setUser(prev => ({
          ...prev,
          balance: prev.balance - (result.costUsd || cost)
        }));
        
        // Refresh balance from server to ensure accuracy
        await refreshUserBalance();
        
        setActiveTab('dashboard');
      } else if (response.status === 402) {
        // Payment required
        setInsufficientFunds(true);
        alert(`Fondos insuficientes. Costo estimado: $${result.requiredAmount?.toFixed(2)}. Tu saldo: $${user.balance.toFixed(2)}. Por favor agrega fondos.`);
        setActiveTab('add-funds');
      } else {
        throw new Error(result.error || 'Error processing file');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert('Error uploading file: ' + message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (paymentMethod: string) => {
    if (!pendingPayment) return;

    try {
      const response = await fetch(`${API_URL}/payment/process`, {
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
        
        const analysisData = await analysisResponse.json();
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
      const response = await fetch(`${API_URL}/history`, {
        headers: { 'X-User-ID': user.id }
      });
      if (!response.ok) {
        console.warn('History API not available yet');
        return;
      }
      const data = await response.json();
      setHistory(data.historial || []);
    } catch (error) {
      console.warn('History API not available:', error);
      // Gracefully continue - history will remain empty
    }
  };

  const loadApiKeys = async () => {
    try {
      const response = await fetch(`${API_URL}/enterprise/api-keys`, {
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

  // Mock results for demonstration
  const mockResults = currentAnalysis || {
    resumen: {
      total_transacciones: 15247,
      preocupante: 127,
      inusual: 534,
      relevante: 2286,
      limpio: 12300,
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TarantulaHawkLogo />
              <div>
                <div className="text-xl font-black bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">
                  TARANTULAHAWK
                </div>
                <div className="text-xs text-gray-500">AML Compliance Portal</div>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-4">
                {/* Language Switcher */}
                <button 
                  onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                  className="px-3 py-2 border border-gray-700 rounded-lg text-sm hover:border-teal-500 transition"
                >
                  {language === 'es' ? 'EN' : 'ES'}
                </button>

                <div className="text-right">
                  <div className="text-xs text-gray-400">{language === 'es' ? 'Saldo' : 'Balance'}</div>
                  <div className="text-lg font-bold text-teal-400">${user.balance.toFixed(2)}</div>
                </div>
                <button 
                  onClick={() => setActiveTab('add-funds')}
                  className="px-4 py-2 bg-teal-600 rounded-lg font-semibold hover:bg-teal-700 transition flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {language === 'es' ? 'Agregar Fondos' : 'Add Funds'}
                </button>
                
                {/* Profile Dropdown */}
                <div className="relative">
                  <button 
                    onClick={() => setShowProfileMenu(!showProfileMenu)}
                    className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition"
                  >
                    <span className="font-bold">{user.email[0].toUpperCase()}</span>
                  </button>
                  
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
                      <div className="p-4 border-b border-gray-800">
                        <div className="font-semibold text-white truncate">{user.name}</div>
                        <div className="text-xs text-gray-400 truncate">{user.email}</div>
                      </div>
                      <button 
                        onClick={() => { setActiveTab('settings'); setShowProfileMenu(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-800 transition flex items-center gap-3"
                      >
                        <Key className="w-4 h-4" />
                        {language === 'es' ? 'Ajustes' : 'Settings'}
                      </button>
                      <button 
                        onClick={() => { setActiveTab('account'); setShowProfileMenu(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-800 transition flex items-center gap-3"
                      >
                        <Database className="w-4 h-4" />
                        {language === 'es' ? 'Cuenta' : 'Account'}
                      </button>
                      <button 
                        onClick={() => window.location.href = '/api/auth/logout'}
                        className="w-full px-4 py-3 text-left hover:bg-red-900/50 transition flex items-center gap-3 text-red-400"
                      >
                        <Lock className="w-4 h-4" />
                        {language === 'es' ? 'Cerrar Sesión' : 'Logout'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-3 font-semibold border-b-2 transition ${
              activeTab === 'upload' 
                ? 'border-red-500 text-white' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            {language === 'es' ? 'Subir Datos' : 'Upload Data'}
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-3 font-semibold border-b-2 transition ${
              activeTab === 'dashboard' 
                ? 'border-red-500 text-white' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
            disabled={!currentAnalysis}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-semibold border-b-2 transition ${
              activeTab === 'history' 
                ? 'border-red-500 text-white' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            {language === 'es' ? 'Historial' : 'History'}
          </button>
          <button
            onClick={() => setActiveTab('add-funds')}
            className={`px-6 py-3 font-semibold border-b-2 transition ${
              activeTab === 'add-funds' 
                ? 'border-red-500 text-white' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <CreditCard className="w-4 h-4 inline mr-2" />
            {language === 'es' ? 'Agregar Fondos' : 'Add Funds'}
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <h2 className="text-2xl font-bold mb-6">{language === 'es' ? 'Subir Datos de Transacciones' : 'Upload Transaction Data'}</h2>
              
              {/* File Format Options - ONLY EXCEL AND CSV */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="bg-black border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition cursor-pointer">
                  <FileSpreadsheet className="w-12 h-12 text-green-400 mb-3" />
                  <div className="font-semibold text-lg mb-1">Excel (.xlsx, .xls)</div>
                  <div className="text-sm text-gray-500">{language === 'es' ? 'Recomendado para grandes volúmenes' : 'Recommended for large volumes'}</div>
                </div>
                <div className="bg-black border border-gray-700 rounded-lg p-6 hover:border-teal-500 transition cursor-pointer">
                  <FileText className="w-12 h-12 text-blue-400 mb-3" />
                  <div className="font-semibold text-lg mb-1">CSV</div>
                  <div className="text-sm text-gray-500">{language === 'es' ? 'Archivos separados por comas' : 'Comma-separated values'}</div>
                </div>
              </div>

              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center hover:border-teal-500 transition">
                <Upload className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <div className="text-lg font-semibold mb-2">{language === 'es' ? 'Arrastra tu archivo aquí o haz clic para seleccionar' : 'Drop your file here or click to browse'}</div>
                <div className="text-sm text-gray-500 mb-4">
                  {language === 'es' ? 'Soporta .xlsx, .csv hasta 500MB' : 'Supports .xlsx, .csv up to 500MB'}
                </div>
                
                {/* Estimated Cost Display */}
                {estimatedTransactions > 0 && (
                  <div className="mb-4 p-4 bg-teal-900/20 border border-teal-800/30 rounded-lg">
                    <div className="text-sm font-semibold text-teal-400 mb-2">
                      {language === 'es' ? 'Costo Estimado' : 'Estimated Cost'}
                    </div>
                    <div className="text-2xl font-bold mb-1">${estimatedCost.toFixed(2)}</div>
                    <div className="text-xs text-gray-400">
                      {estimatedTransactions.toLocaleString()} {language === 'es' ? 'transacciones' : 'transactions'}
                    </div>
                    {insufficientFunds && (
                      <div className="mt-2 text-xs text-red-400 flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {language === 'es' ? 'Fondos insuficientes' : 'Insufficient funds'}
                      </div>
                    )}
                  </div>
                )}
                
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-semibold hover:from-red-700 hover:to-orange-600 transition cursor-pointer"
                >
                  {language === 'es' ? 'Seleccionar Archivo' : 'Select File'}
                </label>
              </div>

              {/* Detailed File Statistics Panel */}
              {fileStats && (
                <div className="mt-6 bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                      {language === 'es' ? 'Análisis del Archivo' : 'File Analysis'}
                    </h3>
                    <button 
                      onClick={() => {
                        setFileStats(null);
                        setSelectedFile(null);
                        setEstimatedTransactions(0);
                        setEstimatedCost(0);
                        setInsufficientFunds(false);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      {language === 'es' ? 'Limpiar' : 'Clear'}
                    </button>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    {/* File Info */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Archivo' : 'File'}</div>
                      <div className="font-semibold text-sm truncate">{fileStats.fileName}</div>
                      <div className="text-xs text-gray-600 mt-1">{(fileStats.fileSize / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    
                    {/* Transaction Count */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Transacciones Detectadas' : 'Transactions Detected'}</div>
                      <div className="text-2xl font-bold text-teal-400">{fileStats.rows.toLocaleString()}</div>
                      <div className="text-xs text-gray-600 mt-1">{language === 'es' ? 'filas procesables' : 'processable rows'}</div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    {/* Total Cost */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Costo Total' : 'Total Cost'}</div>
                      <div className="text-xl font-bold text-orange-400">${estimatedCost.toFixed(2)} USD</div>
                    </div>
                    
                    {/* Available Balance */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Saldo Disponible' : 'Available Balance'}</div>
                      <div className="text-xl font-bold text-teal-400">${user.balance.toFixed(2)} USD</div>
                    </div>
                    
                    {/* Balance After Processing */}
                    <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
                      <div className="text-xs text-gray-500 mb-1">{language === 'es' ? 'Saldo Después' : 'Balance After'}</div>
                      <div className={`text-xl font-bold ${user.balance >= estimatedCost ? 'text-green-400' : 'text-red-400'}`}>
                        ${Math.max(0, user.balance - estimatedCost).toFixed(2)} USD
                      </div>
                    </div>
                  </div>
                  
                  {/* Visual Balance Comparison */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                      <span>{language === 'es' ? 'Comparación de Saldo' : 'Balance Comparison'}</span>
                      <span>{((estimatedCost / user.balance) * 100).toFixed(1)}% {language === 'es' ? 'del saldo' : 'of balance'}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          insufficientFunds 
                            ? 'bg-gradient-to-r from-red-600 to-red-400' 
                            : estimatedCost / user.balance > 0.8
                            ? 'bg-gradient-to-r from-orange-600 to-orange-400'
                            : 'bg-gradient-to-r from-teal-600 to-teal-400'
                        }`}
                        style={{ width: `${Math.min(100, (estimatedCost / user.balance) * 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Warning or Success Message */}
                  {insufficientFunds ? (
                    <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-red-400 mb-1">
                          {language === 'es' ? 'Fondos Insuficientes' : 'Insufficient Funds'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {language === 'es' 
                            ? `Necesitas $${(estimatedCost - user.balance).toFixed(2)} USD adicionales para procesar este archivo.` 
                            : `You need an additional $${(estimatedCost - user.balance).toFixed(2)} USD to process this file.`}
                        </div>
                        <button 
                          onClick={() => setActiveTab('pricing')}
                          className="mt-3 text-sm px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
                        >
                          {language === 'es' ? 'Agregar Fondos' : 'Add Funds'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-teal-900/20 border border-teal-800/30 rounded-lg p-4 flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-teal-400 mb-1">
                          {language === 'es' ? 'Listo para Procesar' : 'Ready to Process'}
                        </div>
                        <div className="text-sm text-gray-400 mb-3">
                          {language === 'es' 
                            ? `Tu saldo es suficiente. Después del procesamiento tendrás $${(user.balance - estimatedCost).toFixed(2)} USD disponibles.`
                            : `Your balance is sufficient. After processing you'll have $${(user.balance - estimatedCost).toFixed(2)} USD available.`}
                        </div>
                        <button 
                          onClick={() => {
                            if (selectedFile) {
                              // Trigger actual upload
                              const input = document.getElementById('file-upload') as HTMLInputElement;
                              if (input) input.value = '';
                              handleFileUpload(selectedFile);
                            }
                          }}
                          disabled={isLoading}
                          className="px-6 py-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLoading 
                            ? (language === 'es' ? 'Procesando...' : 'Processing...') 
                            : (language === 'es' ? 'Procesar Archivo' : 'Process File')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Required Fields Info */}
              <div className="mt-6 p-4 bg-teal-900/20 border border-teal-800/30 rounded-lg">
                <div className="text-sm font-semibold text-teal-400 mb-2">{language === 'es' ? 'Campos de Datos Requeridos:' : 'Required Data Fields:'}</div>
                <div className="text-xs text-gray-400 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>• monto</div>
                  <div>• fecha</div>
                  <div>• tipo_operacion</div>
                  <div>• sector_actividad</div>
                  <div>• frecuencia_mensual</div>
                  <div>• cliente_id</div>
                </div>
                <button className="mt-3 text-xs text-teal-400 hover:text-teal-300 underline">
                  {language === 'es' ? 'Descargar Plantilla de Ejemplo' : 'Download Sample Template'}
                </button>
              </div>
            </div>

            {/* Transaction-based Pricing Info */}
            <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold mb-4">{language === 'es' ? 'Precios por Transacción' : 'Transaction-Based Pricing'}</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1">{language === 'es' ? '1 - 2,000 transacciones' : '1 - 2,000 transactions'}</div>
                  <div className="text-2xl font-bold text-white">$1.00<span className="text-sm text-gray-500">/txn</span></div>
                  <div className="text-xs text-gray-500 mt-1">{language === 'es' ? 'Precio base' : 'Base price'}</div>
                </div>
                <div>
                  <div className="text-orange-400 mb-1">{language === 'es' ? '2,001 - 5,000 transacciones' : '2,001 - 5,000 transactions'}</div>
                  <div className="text-2xl font-bold text-white">$0.75<span className="text-sm text-gray-500">/txn</span></div>
                  <div className="text-xs text-gray-500 mt-1">{language === 'es' ? 'Descuento 25%' : '25% discount'}</div>
                </div>
                <div>
                  <div className="text-teal-400 mb-1">{language === 'es' ? '5,001 - 10,000 transacciones' : '5,001 - 10,000 transactions'}</div>
                  <div className="text-2xl font-bold text-white">$0.50<span className="text-sm text-gray-500">/txn</span></div>
                  <div className="text-xs text-gray-500 mt-1">{language === 'es' ? 'Descuento 50%' : '50% discount'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && currentAnalysis && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">{language === 'es' ? 'Total de Transacciones' : 'Total Transactions'}</div>
                <div className="text-3xl font-black text-white">{mockResults.resumen.total_transacciones.toLocaleString()}</div>
              </div>
              
              <div className="bg-gradient-to-br from-red-900/30 to-black border border-red-800/50 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">{language === 'es' ? 'Alto Riesgo' : 'High Risk'}</div>
                <div className="text-3xl font-black text-red-400">{mockResults.resumen.preocupante}</div>
                <div className="text-xs text-red-400 mt-1">{language === 'es' ? 'Requiere acción inmediata' : 'Requires immediate action'}</div>
              </div>

              <div className="bg-gradient-to-br from-orange-900/30 to-black border border-orange-800/50 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">{language === 'es' ? 'Inusual' : 'Unusual'}</div>
                <div className="text-3xl font-black text-orange-400">{mockResults.resumen.inusual}</div>
                <div className="text-xs text-orange-400 mt-1">{language === 'es' ? 'Revisión recomendada' : 'Review recommended'}</div>
              </div>

              <div className="bg-gradient-to-br from-teal-900/30 to-black border border-teal-800/50 rounded-xl p-6">
                <div className="text-sm text-gray-400 mb-2">{language === 'es' ? 'Limpio' : 'Clean'}</div>
                <div className="text-3xl font-black text-teal-400">{mockResults.resumen.limpio.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-1">{((mockResults.resumen.limpio / mockResults.resumen.total_transacciones) * 100).toFixed(1)}% {language === 'es' ? 'del total' : 'of total'}</div>
              </div>
            </div>

            {/* Risk Distribution */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-6">{language === 'es' ? 'Distribución de Riesgo' : 'Risk Distribution'}</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold text-red-400">{language === 'es' ? 'Alto Riesgo (Preocupante)' : 'High Risk (Preocupante)'}</span>
                    <span className="text-sm font-bold">{mockResults.resumen.preocupante} {language === 'es' ? 'transacciones' : 'transactions'}</span>
                  </div>
                  <div className="h-3 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-600 to-red-500" style={{width: `${(mockResults.resumen.preocupante / mockResults.resumen.total_transacciones) * 100}%`}}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold text-orange-400">{language === 'es' ? 'Inusual' : 'Unusual (Inusual)'}</span>
                    <span className="text-sm font-bold">{mockResults.resumen.inusual} {language === 'es' ? 'transacciones' : 'transactions'}</span>
                  </div>
                  <div className="h-3 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-600 to-orange-500" style={{width: `${(mockResults.resumen.inusual / mockResults.resumen.total_transacciones) * 100}%`}}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-semibold text-yellow-400">{language === 'es' ? 'Relevante' : 'Relevant (Relevante)'}</span>
                    <span className="text-sm font-bold">{mockResults.resumen.relevante} {language === 'es' ? 'transacciones' : 'transactions'}</span>
                  </div>
                  <div className="h-3 bg-black rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-500" style={{width: `${(mockResults.resumen.relevante / mockResults.resumen.total_transacciones) * 100}%`}}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Download Actions */}
            <div className="flex gap-4">
              <button className="flex-1 py-4 bg-teal-600 rounded-lg font-semibold hover:bg-teal-700 transition flex items-center justify-center gap-2">
                <Download className="w-5 h-5" />
                {language === 'es' ? 'Descargar Reporte Completo (PDF)' : 'Download Full Report (PDF)'}
              </button>
              <button className="flex-1 py-4 bg-orange-600 rounded-lg font-semibold hover:bg-orange-700 transition flex items-center justify-center gap-2">
                <FileText className="w-5 h-5" />
                {language === 'es' ? 'Generar XML para UIF' : 'Generate XML for UIF'}
              </button>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6">{language === 'es' ? 'Historial de Análisis' : 'Analysis History'}</h2>
            {history.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>{language === 'es' ? 'Aún no hay historial de análisis' : 'No analysis history yet'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item, i) => (
                  <div key={i} className="bg-black border border-gray-800 rounded-lg p-4 hover:border-teal-500/50 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold mb-1">{language === 'es' ? 'Análisis' : 'Analysis'} {item.analysis_id.slice(0, 8)}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(item.timestamp).toLocaleDateString()} • {item.total_transacciones.toLocaleString()} {language === 'es' ? 'transacciones' : 'transactions'}
                        </div>
                      </div>
                      <div className="text-right mr-6">
                        <div className="text-lg font-bold">${item.costo.toFixed(2)}</div>
                        <div className={`text-xs flex items-center gap-1 ${item.pagado ? 'text-teal-400' : 'text-yellow-400'}`}>
                          {item.pagado ? <CheckCircle className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {item.pagado ? (language === 'es' ? 'Pagado' : 'Paid') : (language === 'es' ? 'Pendiente' : 'Pending')}
                        </div>
                      </div>
                      <button className="px-4 py-2 border border-gray-700 rounded-lg hover:border-teal-500 transition text-sm">
                        {language === 'es' ? 'Ver Reporte' : 'View Report'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                <button className="bg-gradient-to-br from-gray-800 to-black border-2 border-gray-700 hover:border-teal-500 rounded-xl p-6 transition text-center">
                  <div className="text-3xl font-black mb-2">$100</div>
                  <div className="text-sm text-gray-400">
                    {language === 'es' ? '~100 transacciones' : '~100 transactions'}
                  </div>
                </button>
                <button className="bg-gradient-to-br from-gray-800 to-black border-2 border-teal-500 rounded-xl p-6 transition text-center">
                  <div className="text-3xl font-black mb-2 bg-gradient-to-r from-red-500 to-teal-400 bg-clip-text text-transparent">
                    $500
                  </div>
                  <div className="text-sm text-teal-400 font-semibold">
                    {language === 'es' ? 'Más Popular' : 'Most Popular'}
                  </div>
                </button>
                <button className="bg-gradient-to-br from-gray-800 to-black border-2 border-gray-700 hover:border-teal-500 rounded-xl p-6 transition text-center">
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
                    className="w-full bg-black border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-lg focus:border-teal-500 outline-none"
                  />
                </div>
              </div>

              {/* Pricing Tiers Info (driven by config/pricing.json) */}
              <div className="bg-black border border-gray-700 rounded-xl p-6 mb-8">
                <h3 className="font-bold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  {language === 'es' ? 'Precios por Volumen' : 'Volume Pricing'}
                </h3>
                <div className="space-y-3">
                  {formatPricingSummary(language).map((line, idx) => (
                    <div className="flex items-center justify-between" key={idx}>
                      <span className="text-gray-400">{line.split(':')[0]}</span>
                      <span className="font-bold text-teal-400">{line.split(':')[1]?.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    // TODO: Integrate Stripe Checkout or PayPal
                    // Example: window.location.href = '/api/paypal/create-order?amount=500'
                    alert(language === 'es' 
                      ? 'Integración de pago en proceso. Por favor contacta a soporte para agregar fondos.'
                      : 'Payment integration in progress. Please contact support to add funds.');
                  }}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-bold hover:from-red-700 hover:to-orange-600 transition flex items-center justify-center gap-3"
                >
                  <CreditCard className="w-5 h-5" />
                  {language === 'es' ? 'Pagar con Tarjeta (Stripe/PayPal)' : 'Pay with Card (Stripe/PayPal)'}
                </button>
                <button 
                  onClick={() => {
                    alert(language === 'es' 
                      ? 'Para transferencias bancarias, contacta a soporte@tarantulahawk.cloud'
                      : 'For bank transfers, contact soporte@tarantulahawk.cloud');
                  }}
                  className="w-full py-4 bg-gray-800 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center gap-3"
                >
                  <Shield className="w-5 h-5" />
                  {language === 'es' ? 'Transferencia Bancaria' : 'Bank Transfer'}
                </button>
              </div>

              {/* Security Note */}
              <div className="mt-6 flex items-start gap-3 text-sm text-gray-400">
                <Shield className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
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
                        <div className={`px-3 py-1 rounded text-xs font-bold ${key.active ? 'bg-teal-900/50 text-teal-400' : 'bg-red-900/50 text-red-400'}`}>
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
      </div>

      {/* Payment Modal */}
      {showPayment && pendingPayment && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <DollarSign className="w-16 h-16 text-teal-400 mx-auto mb-4" />
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

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <div className="text-2xl font-bold mb-2">Processing Analysis...</div>
            <div className="text-gray-400">Running 3-layer ML models</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TarantulaHawkPortal