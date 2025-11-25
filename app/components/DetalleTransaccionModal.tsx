// DetalleTransaccionModal.tsx
// Versión CORREGIDA - Modal único y completo para detalle de transacción

import React from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  FileText,
  TrendingUp,
  Shield,
  Clock,
  DollarSign,
  User,
  Activity,
} from 'lucide-react';

// ============================================================================
// TIPOS
// ============================================================================
export interface TransaccionDetalle {
  // Identificación
  id?: string;
  cliente_id?: string;
  id_transaccion?: string;
  
  // Datos básicos
  monto: number;
  fecha: string;
  hora?: string;
  tipo_operacion: string;
  sector_actividad?: string;
  
  // Clasificación
  clasificacion: string;
  clasificacion_final?: string;
  nivel_riesgo?: 'bajo' | 'medio' | 'alto';
  
  // Métricas ML
  ica?: number;
  ica_score?: number;
  risk_score?: number;
  probabilidades?: Record<string, number>;
  
  // Métricas EBR
  score_ebr?: number;
  nivel_riesgo_ebr?: string;
  clasificacion_ebr?: string;
  factores_ebr?: string[];
  
  // Explicabilidad
  razones?: string[];
  razones_principales?: string[];
  explicacion_principal?: string;
  explicacion_detallada?: string;
  fundamento_legal?: string;
  contexto_regulatorio?: string;
  
  // Acciones
  acciones_sugeridas?: string[];
  
  // Flags
  flags?: {
    requiere_revision_manual?: boolean;
    sugerir_reclasificacion?: boolean;
    alertas?: Array<{
      tipo: string;
      severidad: 'info' | 'warning' | 'error';
      mensaje: string;
    }>;
  };
  
  // Anomalías (modelo no supervisado)
  anomaly_score_composite?: number;
  is_outlier_iso?: boolean;
  is_dbscan_noise?: boolean;
  
  // Origen de clasificación
  origen?: string;
  guardrail_aplicado?: boolean;
  guardrail_razon?: string;
  
  // UMAs
  umas?: number;
  uma_mxn?: number;
}

interface DetalleTransaccionModalProps {
  open: boolean;
  onClose: () => void;
  transaccion: TransaccionDetalle | null;
  language?: 'es' | 'en';
}

// ============================================================================
// HELPERS
// ============================================================================
const formatMonto = (monto: number): string => {
  try {
    return `$${monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;
  } catch {
    return `$${monto} MXN`;
  }
};

const getClasificacionColor = (clasificacion: string): string => {
  const c = clasificacion?.toLowerCase() || '';
  if (c === 'preocupante') return 'text-red-400';
  if (c === 'inusual') return 'text-yellow-400';
  return 'text-emerald-400';
};

const getClasificacionBg = (clasificacion: string): string => {
  const c = clasificacion?.toLowerCase() || '';
  if (c === 'preocupante') return 'bg-red-500/10 border-red-500/30';
  if (c === 'inusual') return 'bg-yellow-500/10 border-yellow-500/30';
  return 'bg-emerald-500/10 border-emerald-500/30';
};

const getNivelRiesgoLabel = (nivel: string): string => {
  const labels: Record<string, string> = {
    bajo: 'Bajo',
    medio: 'Medio',
    alto: 'Alto',
  };
  return labels[nivel?.toLowerCase()] || nivel || 'N/D';
};

const getClasificacionIcon = (clasificacion: string) => {
  const c = clasificacion?.toLowerCase() || '';
  if (c === 'preocupante') return <AlertCircle className="w-5 h-5 text-red-400" />;
  if (c === 'inusual') return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
  return <CheckCircle className="w-5 h-5 text-emerald-400" />;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export const DetalleTransaccionModal: React.FC<DetalleTransaccionModalProps> = ({
  open,
  onClose,
  transaccion,
  language = 'es',
}) => {
  if (!open || !transaccion) return null;

  // Normalizar datos
  const tx = transaccion;
  const clasificacion = tx.clasificacion_final || tx.clasificacion || 'relevante';
  const nivelRiesgo = tx.nivel_riesgo || 
    (clasificacion === 'preocupante' ? 'alto' : clasificacion === 'inusual' ? 'medio' : 'bajo');
  
  // ICA (Índice de Confianza Algorítmica) - solo número
  const icaValue = tx.ica ?? tx.ica_score ?? tx.risk_score ?? 0;
  const icaPercent = (icaValue * 100).toFixed(1);
  
  // Score EBR
  const scoreEbr = tx.score_ebr ?? 0;
  
  // Razones (top 3)
  const razones = tx.razones_principales || tx.razones || [];
  
  // Probabilidades ML
  const probabilidades = tx.probabilidades || {};
  
  // Anomalías
  const tieneAnomalias = 
    tx.is_outlier_iso || 
    tx.is_dbscan_noise || 
    (tx.anomaly_score_composite ?? 0) > 0.7;

  // Labels según idioma
  const labels = {
    es: {
      title: 'Detalle de Transacción',
      close: 'Cerrar',
      classification: 'Clasificación',
      riskLevel: 'Nivel de Riesgo',
      ica: 'ICA (Índice de Confianza)',
      ebrScore: 'Score EBR',
      transactionData: 'Datos de la Transacción',
      clientId: 'ID Cliente',
      transactionId: 'ID Transacción',
      amount: 'Monto',
      date: 'Fecha',
      time: 'Hora',
      type: 'Tipo Operación',
      sector: 'Sector',
      mainReasons: 'Razones Principales de Clasificación',
      legalBasis: 'Fundamento Legal LFPIORPI',
      detailedExplanation: 'Explicación Detallada',
      suggestedActions: 'Acciones Sugeridas',
      mlProbabilities: 'Probabilidades del Modelo',
      anomalySignals: 'Señales de Anomalía',
      anomalyDetected: 'Se detectaron patrones atípicos en esta operación',
      noAnomaly: 'No se detectaron anomalías significativas',
      reviewFlags: 'Flags de Revisión',
      requiresManualReview: 'Requiere revisión manual',
      suggestReclassification: 'Se sugiere reclasificación',
      origin: 'Origen Clasificación',
      guardrailApplied: 'Guardrail LFPIORPI Aplicado',
      umas: 'UMAs',
    },
    en: {
      title: 'Transaction Detail',
      close: 'Close',
      classification: 'Classification',
      riskLevel: 'Risk Level',
      ica: 'ICA (Confidence Index)',
      ebrScore: 'EBR Score',
      transactionData: 'Transaction Data',
      clientId: 'Client ID',
      transactionId: 'Transaction ID',
      amount: 'Amount',
      date: 'Date',
      time: 'Time',
      type: 'Operation Type',
      sector: 'Sector',
      mainReasons: 'Main Classification Reasons',
      legalBasis: 'LFPIORPI Legal Basis',
      detailedExplanation: 'Detailed Explanation',
      suggestedActions: 'Suggested Actions',
      mlProbabilities: 'Model Probabilities',
      anomalySignals: 'Anomaly Signals',
      anomalyDetected: 'Atypical patterns detected in this operation',
      noAnomaly: 'No significant anomalies detected',
      reviewFlags: 'Review Flags',
      requiresManualReview: 'Requires manual review',
      suggestReclassification: 'Reclassification suggested',
      origin: 'Classification Origin',
      guardrailApplied: 'LFPIORPI Guardrail Applied',
      umas: 'UMAs',
    },
  };

  const t = labels[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            {getClasificacionIcon(clasificacion)}
            <div>
              <h2 className="text-xl font-bold text-white">{t.title}</h2>
              <p className="text-sm text-gray-400">
                {tx.cliente_id && `${t.clientId}: ${tx.cliente_id}`}
                {tx.id_transaccion && ` · ${t.transactionId}: ${tx.id_transaccion}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Clasificación y Métricas Principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Clasificación */}
            <div className={`p-4 rounded-xl border ${getClasificacionBg(clasificacion)}`}>
              <p className="text-xs text-gray-400 mb-1">{t.classification}</p>
              <p className={`text-lg font-bold uppercase ${getClasificacionColor(clasificacion)}`}>
                {clasificacion}
              </p>
            </div>
            
            {/* Nivel de Riesgo */}
            <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
              <p className="text-xs text-gray-400 mb-1">{t.riskLevel}</p>
              <p className="text-lg font-bold text-white">
                {getNivelRiesgoLabel(nivelRiesgo)}
              </p>
            </div>
            
            {/* ICA */}
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10">
              <p className="text-xs text-gray-400 mb-1">{t.ica}</p>
              <p className="text-lg font-bold text-blue-400 font-mono">
                {icaPercent}%
              </p>
            </div>
            
            {/* Score EBR */}
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
              <p className="text-xs text-gray-400 mb-1">{t.ebrScore}</p>
              <p className="text-lg font-bold text-purple-400 font-mono">
                {scoreEbr.toFixed(1)}/100
              </p>
            </div>
          </div>

          {/* Datos de la Transacción */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t.transactionData}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">{t.amount}:</span>
                <span className="ml-2 font-mono text-teal-400 font-semibold">
                  {formatMonto(tx.monto)}
                </span>
              </div>
              {tx.umas !== undefined && (
                <div>
                  <span className="text-gray-500">{t.umas}:</span>
                  <span className="ml-2 font-mono text-gray-300">
                    {tx.umas.toFixed(1)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-500">{t.date}:</span>
                <span className="ml-2 text-gray-300">{tx.fecha}</span>
              </div>
              {tx.hora && (
                <div>
                  <span className="text-gray-500">{t.time}:</span>
                  <span className="ml-2 text-gray-300">{tx.hora}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">{t.type}:</span>
                <span className="ml-2 text-gray-300">{tx.tipo_operacion}</span>
              </div>
              {tx.sector_actividad && (
                <div>
                  <span className="text-gray-500">{t.sector}:</span>
                  <span className="ml-2 text-gray-300">{tx.sector_actividad}</span>
                </div>
              )}
              {tx.origen && (
                <div>
                  <span className="text-gray-500">{t.origin}:</span>
                  <span className="ml-2 text-gray-300">{tx.origen}</span>
                </div>
              )}
            </div>
          </div>

          {/* Guardrail aplicado */}
          {tx.guardrail_aplicado && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-400">
                <Shield className="w-5 h-5" />
                <span className="font-semibold">{t.guardrailApplied}</span>
              </div>
              {tx.guardrail_razon && (
                <p className="text-sm text-red-300 mt-2">{tx.guardrail_razon}</p>
              )}
            </div>
          )}

          {/* Razones Principales (Top 3) */}
          {razones.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                {t.mainReasons}
              </h3>
              <div className="space-y-2">
                {razones.slice(0, 3).map((razon, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-lg"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-gray-300 text-sm">{razon}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fundamento Legal */}
          {tx.fundamento_legal && (
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t.legalBasis}
              </h3>
              <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                {tx.fundamento_legal}
              </div>
            </div>
          )}

          {/* Explicación Detallada */}
          {tx.explicacion_detallada && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                {t.detailedExplanation}
              </h3>
              <p className="text-sm text-gray-400 whitespace-pre-line">
                {tx.explicacion_detallada}
              </p>
            </div>
          )}

          {/* Probabilidades del Modelo */}
          {Object.keys(probabilidades).length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {t.mlProbabilities}
              </h3>
              <div className="space-y-3">
                {Object.entries(probabilidades).map(([clase, prob]) => {
                  const probNum = typeof prob === 'number' ? prob : 0;
                  const color = 
                    clase === 'preocupante' ? 'bg-red-500' :
                    clase === 'inusual' ? 'bg-yellow-500' : 'bg-emerald-500';
                  
                  return (
                    <div key={clase} className="flex items-center gap-3">
                      <span className="text-gray-400 w-28 text-sm capitalize">{clase}:</span>
                      <div className="flex-1 bg-gray-900 rounded-full h-5 overflow-hidden">
                        <div
                          className={`h-full ${color} flex items-center justify-end pr-2`}
                          style={{ width: `${Math.max(probNum * 100, 5)}%` }}
                        >
                          <span className="text-xs font-semibold text-white">
                            {(probNum * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Señales de Anomalía */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {t.anomalySignals}
            </h3>
            {tieneAnomalias ? (
              <p className="text-sm text-red-400 font-medium">
                ⚠️ {t.anomalyDetected}
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                ✓ {t.noAnomaly}
              </p>
            )}
            {tx.anomaly_score_composite !== undefined && (
              <div className="mt-2 text-xs text-gray-500">
                Score: {tx.anomaly_score_composite.toFixed(3)} · 
                Outlier: {tx.is_outlier_iso ? 'Sí' : 'No'} · 
                DBSCAN Noise: {tx.is_dbscan_noise ? 'Sí' : 'No'}
              </div>
            )}
          </div>

          {/* Flags de Revisión */}
          {tx.flags && (tx.flags.requiere_revision_manual || tx.flags.sugerir_reclasificacion || (tx.flags.alertas?.length ?? 0) > 0) && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {t.reviewFlags}
              </h3>
              <div className="space-y-2">
                {tx.flags.requiere_revision_manual && (
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <span>⚠️</span>
                    <span>{t.requiresManualReview}</span>
                  </div>
                )}
                {tx.flags.sugerir_reclasificacion && (
                  <div className="flex items-center gap-2 text-yellow-400 text-sm">
                    <span>🔄</span>
                    <span>{t.suggestReclassification}</span>
                  </div>
                )}
                {tx.flags.alertas?.map((alerta, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded text-sm ${
                      alerta.severidad === 'error' ? 'bg-red-500/10 text-red-300' :
                      alerta.severidad === 'warning' ? 'bg-yellow-500/10 text-yellow-300' :
                      'bg-blue-500/10 text-blue-300'
                    }`}
                  >
                    {alerta.mensaje}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones Sugeridas */}
          {tx.acciones_sugeridas && tx.acciones_sugeridas.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {t.suggestedActions}
              </h3>
              <ul className="space-y-2">
                {tx.acciones_sugeridas.map((accion, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    <span>{accion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetalleTransaccionModal;
