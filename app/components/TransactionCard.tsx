'use client';
// components/TransactionCard.tsx
/**
 * Tarjeta de Transacción Enriquecida
 * Muestra información detallada de cada transacción con alertas y niveles de riesgo
 */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { TransaccionEnriquecida, Alerta } from './types_portal';

interface TransactionCardProps {
  transaction: TransaccionEnriquecida;
  index: number;
}

const TransactionCard: React.FC<TransactionCardProps> = ({ transaction, index }) => {
  const [expanded, setExpanded] = useState(false);

  const { datos_transaccion, clasificacion_final, nivel_riesgo_consolidado, alertas, indice_ebr, analisis_ml } = transaction;

  // Helper para color de clasificación
  const getClasificacionColor = (clasificacion: string) => {
    switch (clasificacion) {
      case 'preocupante':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'inusual':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'relevante':
        return 'bg-green-500/10 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  // Helper para icono de nivel de riesgo
  const getNivelRiesgoIcon = (nivel: string) => {
    switch (nivel) {
      case 'critico':
        return '🔴';
      case 'alto':
        return '🟠';
      case 'medio':
        return '🟡';
      case 'bajo':
        return '🟢';
      default:
        return '⚪';
    }
  };

  // Contar alertas
  const alertasArray = Object.values(alertas);
  const numAlertas = alertasArray.length;

  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 hover:border-emerald-500/30 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">#{index + 1}</span>
          <div>
            <p className="text-white font-medium">{datos_transaccion.id}</p>
            <p className="text-gray-400 text-sm">{datos_transaccion.fecha}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Clasificación */}
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getClasificacionColor(clasificacion_final.resultado)}`}>
            {clasificacion_final.resultado.toUpperCase()}
          </span>
          
          {/* Nivel de riesgo */}
          <div className="flex items-center gap-1 text-xl">
            {getNivelRiesgoIcon(nivel_riesgo_consolidado.nivel)}
          </div>
        </div>
      </div>

      {/* Monto y Tipo */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-gray-400 text-xs">Monto</p>
          <p className="text-white font-semibold text-lg">{datos_transaccion.monto}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Tipo</p>
          <p className="text-white">{datos_transaccion.tipo}</p>
        </div>
      </div>

      {/* Nivel de Riesgo Consolidado */}
      <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">
            {getNivelRiesgoIcon(nivel_riesgo_consolidado.nivel)} Nivel de Riesgo: {nivel_riesgo_consolidado.nivel.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400">{nivel_riesgo_consolidado.urgencia}</span>
        </div>
        <p className="text-sm text-gray-400 mb-2">{nivel_riesgo_consolidado.razon}</p>
        <div className="flex items-start gap-2 text-xs">
          <span className="text-emerald-400">Acción:</span>
          <span className="text-gray-300">{nivel_riesgo_consolidado.accion}</span>
        </div>
        {nivel_riesgo_consolidado.plazo !== 'N/A' && (
          <div className="flex items-start gap-2 text-xs mt-1">
            <span className="text-yellow-400">Plazo:</span>
            <span className="text-gray-300">{nivel_riesgo_consolidado.plazo}</span>
          </div>
        )}
      </div>

      {/* Alertas */}
      {numAlertas > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-medium">{numAlertas} Alerta{numAlertas > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {alertasArray.map((alerta: Alerta, idx: number) => (
              <div key={idx} className="bg-yellow-500/5 border border-yellow-500/20 rounded p-2">
                <p className="text-xs font-medium text-yellow-300">{alerta.titulo}</p>
                <p className="text-xs text-gray-400 mt-1">{alerta.mensaje}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scores EBR y ML - Resumen */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2">
          <p className="text-xs text-gray-400">Score EBR</p>
          <p className="text-lg font-bold text-blue-400">{indice_ebr.score.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{indice_ebr.clasificacion_ebr}</p>
        </div>
        <div className="bg-purple-500/5 border border-purple-500/20 rounded p-2">
          <p className="text-xs text-gray-400">ML Confianza</p>
          <p className="text-lg font-bold text-purple-400">
            {analisis_ml.confianza ? `${(analisis_ml.confianza * 100).toFixed(0)}%` : 'N/A'}
          </p>
          <p className="text-xs text-gray-500">{analisis_ml.clasificacion_ml}</p>
        </div>
      </div>

      {/* Botón Expandir */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-emerald-400 transition-colors py-2 border-t border-gray-700"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Ocultar detalles
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            Ver detalles completos
          </>
        )}
      </button>

      {/* Detalles Expandidos */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
          {/* Análisis EBR Detallado */}
          <div>
            <h4 className="text-sm font-medium text-emerald-400 mb-2">📊 Índice EBR</h4>
            <div className="bg-gray-900/50 rounded p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Score:</span>
                <span className="text-white font-medium">{indice_ebr.score.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Clasificación:</span>
                <span className="text-white">{indice_ebr.clasificacion_ebr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Factores activos:</span>
                <span className="text-white">{indice_ebr.factores_activos}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">{indice_ebr.interpretacion}</p>
            </div>
          </div>

          {/* Análisis ML Detallado */}
          {analisis_ml.clasificacion_ml !== 'N/A' && (
            <div>
              <h4 className="text-sm font-medium text-purple-400 mb-2">🤖 Análisis ML</h4>
              <div className="bg-gray-900/50 rounded p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Clasificación:</span>
                  <span className="text-white">{analisis_ml.clasificacion_ml}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Confianza:</span>
                  <span className="text-white">{analisis_ml.confianza ? `${(analisis_ml.confianza * 100).toFixed(1)}%` : 'N/A'}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{analisis_ml.interpretacion_confianza}</p>
                
                {/* Probabilidades */}
                {Object.keys(analisis_ml.probabilidades).length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-2">Probabilidades:</p>
                    <div className="space-y-1">
                      {Object.entries(analisis_ml.probabilidades).map(([clase, prob]) => (
                        <div key={clase} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-24">{clase}:</span>
                          <div className="flex-1 bg-gray-800 rounded-full h-2">
                            <div
                              className="bg-purple-500 h-2 rounded-full"
                              style={{ width: `${(prob || 0) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-12 text-right">{((prob || 0) * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fundamento Jurídico */}
          <div>
            <h4 className="text-sm font-medium text-yellow-400 mb-2">⚖️ Fundamento LFPIORPI</h4>
            <div className="bg-gray-900/50 rounded p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Artículo:</span>
                <span className="text-white">{transaction.fundamento_juridico.articulo_lfpiorpi}</span>
              </div>
              <p className="text-xs text-gray-500">{transaction.fundamento_juridico.descripcion}</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <span className="text-xs text-gray-400">Umbral aviso:</span>
                  <p className="text-xs text-white">{transaction.fundamento_juridico.umbral_aviso}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400">Umbral efectivo:</span>
                  <p className="text-xs text-white">{transaction.fundamento_juridico.umbral_efectivo}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-700">
                <span className="text-xs text-gray-400">Estado: </span>
                <span className="text-xs text-white">{transaction.fundamento_juridico.estado_transaccion}</span>
              </div>
            </div>
          </div>

          {/* Top Features */}
          {transaction.top_3_features.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-emerald-400 mb-2">🎯 Factores Principales</h4>
              <div className="space-y-2">
                {transaction.top_3_features.map((feature, idx) => (
                  <div key={idx} className="bg-gray-900/50 rounded p-2">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm text-white font-medium">{feature.feature.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-emerald-400">Peso: {feature.peso_ebr.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-400">{feature.valor}</p>
                    <p className="text-xs text-gray-500 mt-1">{feature.fundamento}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionCard;