import React, { useState } from 'react';
import { 
  BarChart3, TrendingUp, AlertTriangle, Users, DollarSign, 
  FileText, Calendar, Shield, Clock, Activity, CheckCircle
} from 'lucide-react';
import { formatDateES } from '../../lib/dateFormatter';

interface DashboardMetrics {
  periodo: string;
  // Clientes
  total_clientes: number;
  clientes_nuevos_mes: number;
  clientes_alto_riesgo: number;
  clientes_pep: number;
  clientes_listas: number;
  
  // Operaciones
  total_operaciones: number;
  operaciones_relevantes: number;
  operaciones_preocupantes: number;
  monto_total_usd: number;
  monto_promedio_operacion: number;
  
  // Cumplimiento
  reportes_uif_mes: number;
  ultimo_reporte_enviado: string;
  dias_desde_ultimo_reporte: number;
  expedientes_completos: number;
  expedientes_pendientes: number;
  
  // Alertas
  alertas_pendientes: number;
  alertas_criticas: number;
}

const RegulatoryDashboard = () => {
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<'mes' | 'trimestre' | 'año'>('mes');

  // Mock data
  const metrics: DashboardMetrics = {
    periodo: 'Enero 2025',
    total_clientes: 127,
    clientes_nuevos_mes: 8,
    clientes_alto_riesgo: 12,
    clientes_pep: 3,
    clientes_listas: 1,
    total_operaciones: 89,
    operaciones_relevantes: 23,
    operaciones_preocupantes: 4,
    monto_total_usd: 542000,
    monto_promedio_operacion: 6090,
    reportes_uif_mes: 1,
    ultimo_reporte_enviado: '2025-01-05',
    dias_desde_ultimo_reporte: 10,
    expedientes_completos: 115,
    expedientes_pendientes: 12,
    alertas_pendientes: 7,
    alertas_criticas: 2
  };

  const getComplianceScore = () => {
    let score = 100;
    
    // Penalizaciones
    if (metrics.alertas_criticas > 0) score -= 20;
    if (metrics.alertas_pendientes > 5) score -= 15;
    if (metrics.expedientes_pendientes > 10) score -= 10;
    if (metrics.dias_desde_ultimo_reporte > 45) score -= 25; // Más de 45 días sin reportar
    if (metrics.clientes_listas > 0) score -= 30;
    
    return Math.max(0, score);
  };

  const complianceScore = getComplianceScore();

  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
    if (score >= 70) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' };
    return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
  };

  const scoreColor = getScoreColor(complianceScore);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-blue-400" />
            Dashboard Regulatorio
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Métricas de cumplimiento PLD • {metrics.periodo}
          </p>
        </div>

        <select
          value={periodoSeleccionado}
          onChange={(e) => setPeriodoSeleccionado(e.target.value as any)}
          className="bg-gray-800/40 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="mes">Este mes</option>
          <option value="trimestre">Último trimestre</option>
          <option value="año">Este año</option>
        </select>
      </div>

      {/* Score de Cumplimiento + Alertas Críticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Compliance Score */}
        <div className={`${scoreColor.bg} border ${scoreColor.border} rounded-lg p-6 md:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-semibold mb-1">Score de Cumplimiento</h3>
              <p className="text-gray-400 text-sm">Indicador general de salud regulatoria</p>
            </div>
            <Shield className={`w-8 h-8 ${scoreColor.text}`} />
          </div>

          <div className="flex items-end gap-6">
            <div>
              <p className={`text-5xl font-bold ${scoreColor.text}`}>{complianceScore}</p>
              <p className="text-gray-400 text-sm mt-1">/100</p>
            </div>

            <div className="flex-1 pb-2">
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    complianceScore >= 90 ? 'bg-green-500' : complianceScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${complianceScore}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-2 text-sm">
            {complianceScore < 100 && (
              <>
                {metrics.alertas_criticas > 0 && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{metrics.alertas_criticas} alertas críticas sin atender</span>
                  </div>
                )}
                {metrics.clientes_listas > 0 && (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{metrics.clientes_listas} clientes en listas negras</span>
                  </div>
                )}
                {metrics.expedientes_pendientes > 10 && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{metrics.expedientes_pendientes} expedientes incompletos</span>
                  </div>
                )}
              </>
            )}
            {complianceScore === 100 && (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>Todos los requisitos regulatorios cumplidos</span>
              </div>
            )}
          </div>
        </div>

        {/* Próximo Reporte UIF */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Próximo Reporte UIF</h3>
            <Calendar className="w-6 h-6 text-blue-400" />
          </div>

          <div className="text-center">
            <p className="text-3xl font-bold text-blue-400 mb-2">17 FEB</p>
            <p className="text-gray-400 text-sm mb-4">
              Aviso mensual enero 2025
            </p>

            <div className="bg-blue-500/10 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-300">
                {metrics.operaciones_relevantes} operaciones relevantes
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Listas para incluir en el reporte
              </p>
            </div>

            <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-medium">
              Generar XML UIF
            </button>
          </div>
        </div>
      </div>

      {/* KPIs Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Clientes */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Clientes Activos</span>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">{metrics.total_clientes}</p>
          <div className="flex items-center gap-1 text-xs">
            <TrendingUp className="w-3 h-3 text-green-400" />
            <span className="text-green-400">+{metrics.clientes_nuevos_mes}</span>
            <span className="text-gray-500">este mes</span>
          </div>
        </div>

        {/* Operaciones */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Operaciones</span>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">{metrics.total_operaciones}</p>
          <div className="text-xs text-gray-400">
            {metrics.operaciones_relevantes} relevantes
          </div>
        </div>

        {/* Monto Total */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Monto Total</span>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">
            ${(metrics.monto_total_usd / 1000).toFixed(0)}K
          </p>
          <div className="text-xs text-gray-400">
            Prom: ${(metrics.monto_promedio_operacion / 1000).toFixed(1)}K/op
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm">Alertas Pendientes</span>
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-2xl font-bold text-white mb-1">{metrics.alertas_pendientes}</p>
          <div className="text-xs">
            <span className="text-red-400">{metrics.alertas_criticas} críticas</span>
          </div>
        </div>
      </div>

      {/* Distribución de Riesgos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clientes por Nivel de Riesgo */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Clientes por Nivel de Riesgo
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-300 text-sm">Alto/Crítico</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2 w-32">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${(metrics.clientes_alto_riesgo / metrics.total_clientes) * 100}%` }}
                  />
                </div>
                <span className="text-white font-medium w-8 text-right">{metrics.clientes_alto_riesgo}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-300 text-sm">Medio</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2 w-32">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '42%' }} />
                </div>
                <span className="text-white font-medium w-8 text-right">53</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-300 text-sm">Bajo</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2 w-32">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '49%' }} />
                </div>
                <span className="text-white font-medium w-8 text-right">62</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400 mb-1">PEPs</p>
              <p className="text-yellow-400 font-semibold">{metrics.clientes_pep}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-1">En listas</p>
              <p className="text-red-400 font-semibold">{metrics.clientes_listas}</p>
            </div>
          </div>
        </div>

        {/* Operaciones por Clasificación */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Operaciones por Clasificación
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-gray-300 text-sm">Preocupantes</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2 w-32">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${(metrics.operaciones_preocupantes / metrics.total_operaciones) * 100}%` }}
                  />
                </div>
                <span className="text-white font-medium w-8 text-right">{metrics.operaciones_preocupantes}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-300 text-sm">Inusuales</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2 w-32">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '16%' }} />
                </div>
                <span className="text-white font-medium w-8 text-right">14</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-300 text-sm">Relevantes</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2 w-32">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(metrics.operaciones_relevantes / metrics.total_operaciones) * 100}%` }}
                  />
                </div>
                <span className="text-white font-medium w-8 text-right">{metrics.operaciones_relevantes}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-gray-300 text-sm">Normales</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-700 rounded-full h-2 w-32">
                  <div className="bg-gray-500 h-2 rounded-full" style={{ width: '53%' }} />
                </div>
                <span className="text-white font-medium w-8 text-right">48</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expedientes y Cumplimiento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Estado de Expedientes */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Estado de Expedientes
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-green-400 mb-1">
                {metrics.expedientes_completos}
              </p>
              <p className="text-xs text-gray-400">Completos</p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400 mb-1">
                {metrics.expedientes_pendientes}
              </p>
              <p className="text-xs text-gray-400">Pendientes</p>
            </div>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
            <p className="text-xs text-gray-300">
              <strong>Conservación 10 años:</strong> Todos los expedientes y documentos 
              se conservan automáticamente según Art. 17 LFPIORPI reformado 2025.
            </p>
          </div>
        </div>

        {/* Reportes UIF */}
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Reportes UIF
          </h3>

          <div className="space-y-3">
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Último reporte enviado</span>
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Enviado</span>
              </div>
              <p className="text-white font-medium">
                {formatDateES(metrics.ultimo_reporte_enviado)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Hace {metrics.dias_desde_ultimo_reporte} días
              </p>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Reportes este mes</span>
                <span className="text-lg font-bold text-white">{metrics.reportes_uif_mes}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones Recomendadas */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-6">
        <h3 className="text-yellow-400 font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Acciones Recomendadas
        </h3>

        <div className="space-y-3">
          {metrics.alertas_criticas > 0 && (
            <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-medium text-sm">Revisar {metrics.alertas_criticas} alertas críticas</p>
                <p className="text-gray-400 text-xs mt-1">
                  Operaciones preocupantes detectadas requieren revisión inmediata
                </p>
              </div>
              <button className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600">
                Revisar
              </button>
            </div>
          )}

          {metrics.expedientes_pendientes > 10 && (
            <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
              <FileText className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-medium text-sm">
                  Completar {metrics.expedientes_pendientes} expedientes pendientes
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Asegurar que todos los clientes tengan expediente completo
                </p>
              </div>
              <button className="px-3 py-1 bg-yellow-500 text-black rounded text-xs hover:bg-yellow-600">
                Ver
              </button>
            </div>
          )}

          {complianceScore === 100 && (
            <div className="flex items-center gap-3 bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <p className="text-green-300 text-sm">
                ✅ Todos los requisitos regulatorios están al día
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegulatoryDashboard;
