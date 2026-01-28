// components/lfpiorpi/AcumuladoCliente.tsx
import React from 'react';
import { Calendar, TrendingUp, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';
import { formatearMXN, formatearUMAs, montoAUMAs } from '../../lib/lfpiorpi-types';
import type { AcumuladoCliente as AcumuladoType } from '../../lib/lfpiorpi-types';

interface AcumuladoClienteProps {
  acumulado: AcumuladoType | null;
  cargando?: boolean;
  umbralAvisoUMA?: number;
}

/**
 * Componente para mostrar acumulado del cliente en 6 meses
 * 
 * Implementa Regla 2: Acumulación 6 meses (Art. 17 + Art. 7 Reglamento)
 */
export function AcumuladoCliente({ acumulado, cargando, umbralAvisoUMA }: AcumuladoClienteProps) {
  if (cargando) {
    return (
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
          <span className="text-sm">Cargando acumulado 6 meses...</span>
        </div>
      </div>
    );
  }

  if (!acumulado) {
    return (
      <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-6">
        <p className="text-sm text-gray-400 text-center">
          No hay datos de acumulado disponibles
        </p>
      </div>
    );
  }

  const porcentajeUmbral = umbralAvisoUMA 
    ? (acumulado.resumen.monto_acumulado_umas / umbralAvisoUMA) * 100 
    : 0;

  const cercaUmbral = porcentajeUmbral >= 75 && porcentajeUmbral < 100;
  const superaUmbral = acumulado.alerta?.umbral_alcanzado || porcentajeUmbral >= 100;

  return (
    <div className={`border rounded-lg p-6 ${
      superaUmbral 
        ? 'bg-red-500/10 border-red-500/30' 
        : cercaUmbral 
        ? 'bg-amber-500/10 border-amber-500/30' 
        : 'bg-gray-800/40 border-gray-700'
    }`}>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          Acumulado 6 Meses
        </h3>
        {superaUmbral && (
          <span className="px-3 py-1 bg-red-500/20 border border-red-500 rounded-full text-xs font-medium text-red-400">
            SUPERA UMBRAL
          </span>
        )}
        {cercaUmbral && !superaUmbral && (
          <span className="px-3 py-1 bg-amber-500/20 border border-amber-500 rounded-full text-xs font-medium text-amber-400">
            CERCA DEL UMBRAL
          </span>
        )}
      </div>

      {/* PERÍODO */}
      <div className="mb-4 pb-4 border-b border-gray-700">
        <p className="text-xs text-gray-400">
          Período: {new Date(acumulado.periodo.desde).toLocaleDateString('es-MX')} - {new Date(acumulado.periodo.hasta).toLocaleDateString('es-MX')}
        </p>
        <p className="text-xs text-gray-400">
          {acumulado.periodo.dias} días ({Math.floor(acumulado.periodo.dias / 30)} meses aprox.)
        </p>
      </div>

      {/* RESUMEN */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Total Operaciones</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {acumulado.resumen.total_operaciones}
          </p>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-gray-400">Monto Acumulado</span>
          </div>
          <p className="text-xl font-bold text-white">
            {formatearMXN(acumulado.resumen.monto_acumulado_mxn)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatearUMAs(acumulado.resumen.monto_acumulado_umas)} UMAs
          </p>
        </div>
      </div>

      {/* BARRA DE PROGRESO (si hay umbral) */}
      {umbralAvisoUMA && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Progreso al umbral de aviso</span>
            <span className={
              superaUmbral ? 'text-red-400 font-semibold' : 
              cercaUmbral ? 'text-amber-400 font-semibold' : 
              'text-gray-400'
            }>
              {porcentajeUmbral.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                superaUmbral ? 'bg-red-500' : 
                cercaUmbral ? 'bg-amber-500' : 
                'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(porcentajeUmbral, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 UMAs</span>
            <span>{formatearUMAs(umbralAvisoUMA)} UMAs</span>
          </div>
        </div>
      )}

      {/* ACTIVIDADES DETECTADAS */}
      {acumulado.actividades_detectadas && acumulado.actividades_detectadas.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-white mb-2">
            Actividades Vulnerables Detectadas
          </h4>
          <div className="space-y-2">
            {acumulado.actividades_detectadas.map(actividad => {
              const monto = acumulado.montos_por_actividad[actividad] || 0;
              return (
                <div key={actividad} className="flex justify-between items-center text-xs bg-gray-900/50 rounded px-3 py-2">
                  <span className="text-gray-300">{actividad}</span>
                  <span className="text-white font-mono">
                    {formatearMXN(monto)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MÉTODOS DE PAGO */}
      {acumulado.montos_por_tipo_pago && Object.keys(acumulado.montos_por_tipo_pago).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-white mb-2">
            Por Método de Pago
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(acumulado.montos_por_tipo_pago).map(([metodo, monto]) => (
              <div key={metodo} className="flex flex-col text-xs bg-gray-900/50 rounded px-3 py-2">
                <span className="text-gray-400 capitalize">{metodo}</span>
                <span className="text-white font-mono">
                  {formatearMXN(monto as number)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALERTA */}
      {acumulado.alerta && acumulado.alerta.umbral_alcanzado && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-semibold text-red-300 mb-1">
                Umbral de Aviso Alcanzado
              </h5>
              <p className="text-xs text-red-200">
                {acumulado.alerta.umbral_relevante}
              </p>
              {acumulado.alerta.fundamento_legal && (
                <p className="text-xs text-red-200/80 mt-2">
                  {acumulado.alerta.fundamento_legal}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SIN ALERTAS */}
      {acumulado.alerta && !acumulado.alerta.umbral_alcanzado && !cercaUmbral && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-emerald-300">
              El acumulado está bajo control y no supera umbrales de aviso
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Versión compacta del acumulado (para usar en forms)
 */
export function AcumuladoCompacto({ acumulado, cargando }: { acumulado: AcumuladoType | null; cargando?: boolean }) {
  if (cargando) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <div className="animate-spin rounded-full h-3 w-3 border-2 border-gray-400 border-t-transparent"></div>
        Cargando...
      </div>
    );
  }

  if (!acumulado) {
    return (
      <div className="text-xs text-gray-400">
        Sin historial
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-xs">
      <div>
        <span className="text-gray-400">Acumulado 6m: </span>
        <span className="text-white font-mono">{formatearMXN(acumulado.resumen.monto_acumulado_mxn)}</span>
      </div>
      <div>
        <span className="text-gray-400">Operaciones: </span>
        <span className="text-white">{acumulado.resumen.total_operaciones}</span>
      </div>
    </div>
  );
}
