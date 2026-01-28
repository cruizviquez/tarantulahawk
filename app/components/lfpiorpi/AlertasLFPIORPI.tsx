//components/lfpiorpi/AlertasLFPIORPI.tsx
import React from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle, Shield } from 'lucide-react';
import type { ValidacionLFPIORPIResponse } from '../../lib/lfpiorpi-types';
import { getColorPorAlerta, getTipoAccion, formatearMXN, formatearUMAs, montoAUMAs } from '../../lib/lfpiorpi-types';

interface AlertasLFPIORPIProps {
  validacion: ValidacionLFPIORPIResponse | null;
  monto?: number;
  actividad?: string;
  umbralUMA?: number;
}

/**
 * Componente para mostrar alertas y validaciones LFPIORPI 2025
 * 
 * Muestra:
 * - Recomendación principal (bloqueada, aviso 24h, aviso mensual, permitida)
 * - Alertas específicas detectadas
 * - Fundamentos legales aplicables
 * - Score EBR si es alto/crítico
 */
export function AlertasLFPIORPI({ validacion, monto, actividad, umbralUMA }: AlertasLFPIORPIProps) {
  if (!validacion) return null;

  const tipoAccion = getTipoAccion(validacion.recomendacion);

  // Determinar estilos según tipo de acción
  const estilos = {
    bloqueada: {
      bg: 'bg-red-500/20',
      border: 'border-red-500',
      text: 'text-red-300',
      icon: <AlertOctagon className="w-6 h-6 text-red-500" />
    },
    aviso_24h: {
      bg: 'bg-orange-500/20',
      border: 'border-orange-500',
      text: 'text-orange-300',
      icon: <AlertTriangle className="w-6 h-6 text-orange-500" />
    },
    aviso_mensual: {
      bg: 'bg-amber-500/20',
      border: 'border-amber-500',
      text: 'text-amber-300',
      icon: <AlertTriangle className="w-6 h-6 text-amber-500" />
    },
    permitida: {
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500',
      text: 'text-emerald-300',
      icon: <CheckCircle className="w-6 h-6 text-emerald-500" />
    }
  };

  const estilo = estilos[tipoAccion];

  return (
    <div className="space-y-4">
      {/* RECOMENDACIÓN PRINCIPAL */}
      <div className={`${estilo.bg} border ${estilo.border} rounded-lg p-4`}>
        <div className="flex items-start gap-3">
          {estilo.icon}
          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">
              {tipoAccion === 'bloqueada' && 'OPERACIÓN BLOQUEADA'}
              {tipoAccion === 'aviso_24h' && 'REQUIERE AVISO 24 HORAS'}
              {tipoAccion === 'aviso_mensual' && 'REQUIERE AVISO MENSUAL'}
              {tipoAccion === 'permitida' && 'OPERACIÓN VÁLIDA'}
            </h4>
            <p className={`text-sm ${estilo.text}`}>
              {validacion.recomendacion}
            </p>
          </div>
        </div>
      </div>

      {/* ALERTAS ESPECÍFICAS */}
      {validacion.alertas && validacion.alertas.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            Alertas Detectadas
          </h5>
          <ul className="space-y-2">
            {validacion.alertas.map((alerta, idx) => (
              <li
                key={idx}
                className={`text-sm px-3 py-2 rounded border ${getColorPorAlerta(alerta)}`}
              >
                {alerta}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* FUNDAMENTOS LEGALES */}
      {validacion.fundamentos_legales && validacion.fundamentos_legales.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h5 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            Fundamentos Legales
          </h5>
          <ul className="space-y-1">
            {validacion.fundamentos_legales.map((fundamento, idx) => (
              <li key={idx} className="text-xs text-blue-200 leading-relaxed">
                {fundamento}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SCORE EBR (si es alto/crítico) */}
      {validacion.score_ebr && validacion.score_ebr >= 50 && (
        <div className={`border rounded-lg p-4 ${
          validacion.score_ebr >= 80 
            ? 'bg-red-500/10 border-red-500/30' 
            : 'bg-orange-500/10 border-orange-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">Score EBR del Cliente</span>
            <span className={`text-2xl font-bold ${
              validacion.score_ebr >= 80 ? 'text-red-400' : 'text-orange-400'
            }`}>
              {validacion.score_ebr}/100
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {validacion.score_ebr >= 80 && '⚠️ RIESGO CRÍTICO - Requiere análisis especializado'}
            {validacion.score_ebr >= 50 && validacion.score_ebr < 80 && '⚠️ RIESGO ALTO - Requiere EDD extendido'}
          </p>
        </div>
      )}

      {/* INFORMACIÓN DE UMBRALES (si se proporciona) */}
      {monto && umbralUMA && (
        <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gray-400">Monto Operación:</span>
              <p className="text-white font-mono">{formatearMXN(monto)}</p>
              <p className="text-gray-400">{formatearUMAs(montoAUMAs(monto))} UMAs</p>
            </div>
            <div>
              <span className="text-gray-400">Umbral Aviso:</span>
              <p className="text-white font-mono">{formatearUMAs(umbralUMA)} UMAs</p>
              <p className="text-gray-400">{formatearMXN(umbralUMA * 113.14)}</p>
            </div>
          </div>
          {montoAUMAs(monto) >= umbralUMA && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <p className="text-xs text-amber-400">
                ⚠️ La operación supera el umbral de aviso establecido
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Componente compacto para mostrar solo el status de validación
 */
export function StatusValidacionLFPIORPI({ validacion }: { validacion: ValidacionLFPIORPIResponse | null }) {
  if (!validacion) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-xs text-gray-400">
        <Info className="w-3 h-3" />
        Pendiente validación
      </div>
    );
  }

  const tipoAccion = getTipoAccion(validacion.recomendacion);

  const estilos = {
    bloqueada: 'bg-red-500/20 border-red-500 text-red-400',
    aviso_24h: 'bg-orange-500/20 border-orange-500 text-orange-400',
    aviso_mensual: 'bg-amber-500/20 border-amber-500 text-amber-400',
    permitida: 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
  };

  const iconos = {
    bloqueada: <AlertOctagon className="w-3 h-3" />,
    aviso_24h: <AlertTriangle className="w-3 h-3" />,
    aviso_mensual: <AlertTriangle className="w-3 h-3" />,
    permitida: <CheckCircle className="w-3 h-3" />
  };

  const textos = {
    bloqueada: 'BLOQUEADA',
    aviso_24h: 'Aviso 24h',
    aviso_mensual: 'Aviso Mensual',
    permitida: 'Permitida'
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-medium ${estilos[tipoAccion]}`}>
      {iconos[tipoAccion]}
      {textos[tipoAccion]}
    </div>
  );
}
