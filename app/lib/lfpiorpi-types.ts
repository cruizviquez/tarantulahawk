// lib/lfpiorpi-types.ts
/**
 * Tipos TypeScript para validación LFPIORPI 2025
 * 
 * Estos tipos reflejan las estructuras del backend en:
 * - app/backend/api/operaciones_api.py
 * - app/backend/api/utils/validador_lfpiorpi_2025.py
 */

export interface ValidacionLFPIORPIResponse {
  operacion_id: string;
  es_valida: boolean;
  debe_bloquearse: boolean;
  requiere_aviso_uif: boolean;    // Aviso Mensual (Art. 23)
  requiere_aviso_24hrs: boolean;  // Aviso 24 horas (Art. 24)
  alertas: string[];
  fundamentos_legales: string[];
  score_ebr: number;
  recomendacion: string;
}

export interface OperacionValidarRequest {
  operacion: {
    cliente_id: string;
    fecha_operacion: string;  // ISO datetime
    hora_operacion: string;   // HH:MM:SS
    actividad_vulnerable: string;
    tipo_operacion: string;
    monto: number;
    moneda: string;
    metodo_pago: string;
    producto_servicio?: string;
    descripcion?: string;
  };
  cliente: {
    cliente_id: string;
    nombre: string;
    rfc?: string;
    curp?: string;
    tipo_persona: string;
    sector_actividad: string;
    estado: string;
    origen_recursos?: string;
    origen_recursos_documentado: boolean;
    monto_mensual_estimado: number;
    en_lista_uif: boolean;
    en_lista_ofac: boolean;
    en_lista_csnu: boolean;
    en_lista_69b: boolean;
    es_pep: boolean;
    beneficiario_controlador_identificado?: boolean;
  };
  operaciones_historicas?: Array<{
    folio_interno: string;
    cliente_id: string;
    fecha_operacion: string;
    monto: number;
    actividad_vulnerable: string;
  }>;
}

export interface ActividadVulnerable {
  id: string;
  nombre: string;
  aviso_uma: number;
  efectivo_max_uma: number;
}

export interface AcumuladoCliente {
  cliente_id: string;
  fecha_reporte: string;
  periodo: {
    desde: string;
    hasta: string;
    dias: number;
  };
  resumen: {
    total_operaciones: number;
    monto_acumulado_umas: number;
    monto_acumulado_mxn: number;
  };
  actividades_detectadas: string[];
  montos_por_actividad: Record<string, number>;
  montos_por_tipo_pago: Record<string, number>;
  alerta: {
    umbral_alcanzado: boolean;
    umbral_relevante: string;
    fundamento_legal: string;
  };
}

export const UMA_2025 = 113.14; // Valor UMA 2025 en MXN

/**
 * Convierte monto MXN a UMAs
 */
export function montoAUMAs(montoMXN: number): number {
  return montoMXN / UMA_2025;
}

/**
 * Convierte UMAs a MXN
 */
export function UMAsAMonto(umas: number): number {
  return umas * UMA_2025;
}

/**
 * Formatea monto en UMAs con separadores
 */
export function formatearUMAs(umas: number): string {
  return umas.toLocaleString('es-MX', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * Formatea monto en MXN con separadores
 */
export function formatearMXN(monto: number): string {
  return monto.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  });
}

/**
 * Determina el color del badge según nivel de riesgo
 */
export function getColorPorAlerta(alerta: string): string {
  if (alerta.includes('BLOQUEADA') || alerta.includes('BLOQUEO')) {
    return 'text-red-400 bg-red-500/20 border-red-500/30';
  }
  if (alerta.includes('24 horas') || alerta.includes('24h')) {
    return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
  }
  if (alerta.includes('Aviso') || alerta.includes('umbral')) {
    return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
  }
  return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
}

/**
 * Extrae el tipo de acción de una recomendación
 */
export function getTipoAccion(recomendacion: string): 'bloqueada' | 'aviso_24h' | 'aviso_mensual' | 'permitida' {
  if (recomendacion.includes('BLOQUEADA')) return 'bloqueada';
  if (recomendacion.includes('24 horas') || recomendacion.includes('24h')) return 'aviso_24h';
  if (recomendacion.includes('aviso mensual') || recomendacion.includes('Aviso Mensual')) return 'aviso_mensual';
  return 'permitida';
}
