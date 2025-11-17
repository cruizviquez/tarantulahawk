'use client';
// components/AnalysisSummary.tsx
/**
 * Panel de Resumen de Análisis
 * Muestra estadísticas generales, estrategia, alertas y distribución
 */

import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, TrendingUp, Shield, Brain, Scale } from 'lucide-react';
import type { ResultadosAnalisis } from './types_portal';

interface AnalysisSummaryProps {
  results: ResultadosAnalisis;
}

const AnalysisSummary: React.FC<AnalysisSummaryProps> = ({ results }) => {
  const { resumen, metadata } = results;

  // Calcular porcentajes
  const total = resumen.total_transacciones;
  const pctPreocupante = ((resumen.clasificacion_final.preocupante / total) * 100).toFixed(1);
  const pctInusual = ((resumen.clasificacion_final.inusual / total) * 100).toFixed(1);
  const pctRelevante = ((resumen.clasificacion_final.relevante / total) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header con estrategia */}
      <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Análisis Completado</h3>
            <p className="text-gray-400 text-sm">
              {total.toLocaleString()} transacciones procesadas
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Estrategia</p>
            <p className="text-emerald-400 font-medium text-lg uppercase">{resumen.estrategia}</p>
            <p className="text-xs text-gray-500">{metadata?.modelos?.ebr || 'Score EBR'}</p>
          </div>
        </div>
      </div>

      {/* Grid de Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Preocupante */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Preocupante</p>
              <p className="text-2xl font-bold text-red-400">
                {resumen.clasificacion_final.preocupante}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{pctPreocupante}% del total</span>
            <span className="text-red-400 font-medium">Alta prioridad</span>
          </div>
        </div>

        {/* Inusual */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Inusual</p>
              <p className="text-2xl font-bold text-yellow-400">
                {resumen.clasificacion_final.inusual}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{pctInusual}% del total</span>
            <span className="text-yellow-400 font-medium">Revisar</span>
          </div>
        </div>

        {/* Relevante */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Relevante</p>
              <p className="text-2xl font-bold text-green-400">
                {resumen.clasificacion_final.relevante}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{pctRelevante}% del total</span>
            <span className="text-green-400 font-medium">Normal</span>
          </div>
        </div>
      </div>

      {/* Niveles de Riesgo */}
      {resumen.niveles_riesgo && Object.keys(resumen.niveles_riesgo).length > 0 && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Niveles de Riesgo Consolidados
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {resumen.niveles_riesgo.critico !== undefined && (
              <div className="bg-red-500/5 border border-red-500/20 rounded p-3 text-center">
                <p className="text-3xl mb-1">🔴</p>
                <p className="text-2xl font-bold text-red-400">{resumen.niveles_riesgo.critico}</p>
                <p className="text-xs text-gray-400">Crítico</p>
              </div>
            )}
            {resumen.niveles_riesgo.alto !== undefined && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded p-3 text-center">
                <p className="text-3xl mb-1">🟠</p>
                <p className="text-2xl font-bold text-orange-400">{resumen.niveles_riesgo.alto}</p>
                <p className="text-xs text-gray-400">Alto</p>
              </div>
            )}
            {resumen.niveles_riesgo.medio !== undefined && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded p-3 text-center">
                <p className="text-3xl mb-1">🟡</p>
                <p className="text-2xl font-bold text-yellow-400">{resumen.niveles_riesgo.medio}</p>
                <p className="text-xs text-gray-400">Medio</p>
              </div>
            )}
            {resumen.niveles_riesgo.bajo !== undefined && (
              <div className="bg-green-500/5 border border-green-500/20 rounded p-3 text-center">
                <p className="text-3xl mb-1">🟢</p>
                <p className="text-2xl font-bold text-green-400">{resumen.niveles_riesgo.bajo}</p>
                <p className="text-xs text-gray-400">Bajo</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guardrails y Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guardrails LFPIORPI */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <Scale className="w-5 h-5 text-blue-400" />
            <h4 className="text-white font-medium">Guardrails LFPIORPI</h4>
          </div>
          <p className="text-3xl font-bold text-blue-400 mb-2">
            {resumen.guardrails_aplicados}
          </p>
          <p className="text-sm text-gray-400">
            Transacciones que superan umbrales normativos y requieren reporte obligatorio a la UIF
          </p>
        </div>

        {/* Alertas Detectadas */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <h4 className="text-white font-medium">Alertas Generadas</h4>
          </div>
          <p className="text-3xl font-bold text-yellow-400 mb-2">
            {Object.values(resumen.alertas_detectadas || {}).reduce((a, b) => a + b, 0)}
          </p>
          {resumen.alertas_detectadas && Object.keys(resumen.alertas_detectadas).length > 0 && (
            <div className="space-y-1 mt-3">
              {Object.entries(resumen.alertas_detectadas).slice(0, 3).map(([tipo, count]) => (
                <div key={tipo} className="flex justify-between text-xs">
                  <span className="text-gray-400">{tipo.replace(/_/g, ' ')}:</span>
                  <span className="text-white font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Análisis EBR vs ML */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          Análisis Comparativo: EBR vs ML
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* EBR */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <h5 className="text-sm font-medium text-blue-400">Índice EBR</h5>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Score promedio:</span>
                <span className="text-white font-medium">{resumen.ebr.score_promedio.toFixed(3)}</span>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Distribución:</p>
                {Object.entries(resumen.ebr.distribucion).map(([clase, count]) => (
                  <div key={clase} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-24">{clase}:</span>
                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-16 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ML */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <h5 className="text-sm font-medium text-purple-400">Modelo ML</h5>
            </div>
            {resumen.ml.disponible ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Confianza promedio:</span>
                  <span className="text-white font-medium">
                    {resumen.ml.confianza_promedio ? `${(resumen.ml.confianza_promedio * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                {resumen.ml.distribucion && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Distribución:</p>
                    {Object.entries(resumen.ml.distribucion).map(([clase, count]) => (
                      <div key={clase} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-24">{clase}:</span>
                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-16 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Modelo ML no disponible para este análisis</p>
            )}
          </div>
        </div>

        {/* Discrepancias */}
        {resumen.discrepancias_ebr_ml && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Discrepancias EBR vs ML:</span>
              <div className="text-right">
                <span className="text-lg font-bold text-yellow-400">
                  {resumen.discrepancias_ebr_ml.total}
                </span>
                <span className="text-sm text-gray-400 ml-2">
                  ({resumen.discrepancias_ebr_ml.porcentaje.toFixed(1)}%)
                </span>
              </div>
            </div>
            {resumen.discrepancias_ebr_ml.total > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                💡 Estas transacciones fueron clasificadas diferente por EBR y ML. 
                Se recomienda revisión manual para validar.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3">📋 Información del Análisis</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-400 text-xs">Archivo procesado</p>
            <p className="text-white">{metadata.input_file}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Estrategia utilizada</p>
            <p className="text-white">{metadata.estrategia_usada.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Modelo EBR</p>
            <p className="text-white text-xs">{metadata?.modelos?.ebr || 'N/A'}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs">Modelo ML</p>
            <p className="text-white text-xs">{metadata?.modelos?.ml || 'N/A'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisSummary;