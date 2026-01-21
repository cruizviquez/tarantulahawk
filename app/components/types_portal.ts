// types/portal.ts - VERSIÓN EXTENDIDA
/**
 * TarantulaHawk Portal - Type Definitions
 * ✅ Tipos originales + Nuevos módulos (KYC, Monitoreo, Reportes UIF)
 */

// ==================== TIPOS ORIGINALES (MANTENER) ====================
export interface UserData {
  id: string;
  email: string;
  name: string;
  company: string;
  balance: number;
  subscription_tier: string;
}

export interface PendingPayment {
  payment_id: string;
  amount: number;
  analysis_id: string;
}

export interface HistoryItem {
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

export interface ApiKey {
  key: string;
  created_at: string;
  requests_count: number;
  active: boolean;
}

// Interfaces ML (mantener todas las existentes)
export interface NivelRiesgoConsolidado {
  nivel: 'bajo' | 'medio' | 'alto' | 'critico';
  color: string;
  emoji: string;
  razon: string;
  detalle: string;
  accion: string;
  urgencia: string;
  plazo: string;
  requiere_reporte_uif: boolean;
  requiere_documentacion: boolean;
  prioridad_revision: number;
}

export interface Alerta {
  existe: boolean;
  severidad: 'baja' | 'media' | 'alta' | 'critica' | 'info' | 'warning' | 'error';
  titulo: string;
  mensaje: string;
  razon: string;
  accion_recomendada: string;
  icono: string;
}

export interface IndiceEBR {
  score: number;
  clasificacion_ebr: string;
  nivel_riesgo_ebr: string;
  interpretacion: string;
  factores_activos: number;
}

export interface AnalisisML {
  clasificacion_ml: string;
  nivel_riesgo_ml: string;
  probabilidades: {
    preocupante?: number;
    inusual?: number;
    relevante?: number;
  };
  confianza: number | null;
  interpretacion_confianza: string;
  modelo: string;
}

export interface FundamentoJuridico {
  articulo_lfpiorpi: string;
  descripcion: string;
  umbral_aviso: string;
  umbral_efectivo: string;
  estado_transaccion: string;
  requiere_reporte_inmediato: boolean;
}

export interface TransaccionEnriquecida {
  datos_transaccion: {
    id: string;
    fecha: string;
    hora: string;
    monto: string;
    tipo: string;
    sector: string;
    ops_6m: number;
    monto_6m: string;
  };
  clasificacion_final: {
    resultado: 'preocupante' | 'inusual' | 'relevante';
    nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico';
    origen: string;
    requiere_revision_manual: boolean;
  };
  indice_ebr: IndiceEBR;
  analisis_ml: AnalisisML;
  alertas: {
    [key: string]: Alerta;
  };
  nivel_riesgo_consolidado: NivelRiesgoConsolidado;
  fundamento_juridico: FundamentoJuridico;
  top_3_features: Array<{
    feature: string;
    valor: string;
    peso_ebr: number;
    importancia_ml: number;
    fundamento: string;
  }>;
  razones?: string[];
  razones_principales?: string[];
  explicacion_principal?: string;
  explicacion_detallada?: string;
  probabilidades?: {
    [clase: string]: number;
  };
  factores?: string[];
  factores_ebr?: string[];
  banderas_ebr?: string[];
  acciones_sugeridas?: string[];
  fundamento_legal?: string | FundamentoJuridico;
  contexto_regulatorio?: string;
  flags?: {
    requiere_revision_manual?: boolean;
    sugerir_reclasificacion?: boolean;
    alertas?: Array<{
      tipo?: string;
      severidad?: 'baja' | 'media' | 'alta' | 'critica' | 'info' | 'warning' | 'error';
      mensaje: string;
      de?: string;
      a?: string;
    }>;
  };
  umas?: number;
  timestamp: string;
}

export interface ResultadosAnalisis {
  success: boolean;
  analysis_id: string;
  timestamp: string;
  resumen: {
    total_transacciones: number;
    estrategia: string;
    clasificacion_final: {
      preocupante: number;
      inusual: number;
      relevante: number;
    };
    guardrails_aplicados: number;
    niveles_riesgo: {
      bajo?: number;
      medio?: number;
      alto?: number;
      critico?: number;
    };
    alertas_detectadas: {
      [key: string]: number;
    };
    ebr: {
      score_promedio: number;
      distribucion: {
        preocupante: number;
        inusual: number;
        relevante: number;
      };
    };
    ml: {
      disponible: boolean;
      confianza_promedio: number | null;
      distribucion: {
        preocupante: number;
        inusual: number;
        relevante: number;
      } | null;
    };
    discrepancias_ebr_ml: {
      total: number;
      porcentaje: number;
    } | null;
  };
  transacciones: TransaccionEnriquecida[];
  metadata: {
    input_file: string;
    estrategia_usada: string;
    umbral_ml: number;
    modelos: {
      ebr: string;
      ml: string;
    };
  };
  csvText?: string;
}

// ==================== NUEVOS TIPOS - MÓDULO KYC ====================

export interface Cliente {
  cliente_id: string;
  user_id: string;
  
  // Datos Básicos
  tipo_persona: 'fisica' | 'moral';
  nombre_completo: string;
  rfc: string;
  curp?: string;
  fecha_nacimiento?: string;
  
  // Persona Moral
  razon_social?: string;
  fecha_constitucion?: string;
  
  // Contacto
  telefono?: string;
  email?: string;
  domicilio_completo?: string;
  estado?: string;
  
  // Actividad Económica
  sector_actividad: string;
  giro_negocio?: string;
  ocupacion?: string;
  
  // Clasificación de Riesgo
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'critico' | 'pendiente';
  score_ebr?: number;
  factores_riesgo?: string[];
  
  // Perfil Transaccional
  num_operaciones_mes_esperado?: number;
  monto_mensual_esperado?: number;
  
  // PEP y Listas
  es_pep: boolean;
  tipo_pep?: string;
  en_lista_69b: boolean;
  en_lista_ofac: boolean;
  en_lista_csnu: boolean;
  
  // Validaciones
  validacion_renapo?: boolean;
  validacion_sat?: boolean;
  
  // Estado
  estado_expediente: 'borrador' | 'pendiente_aprobacion' | 'aprobado' | 'rechazado' | 'suspendido';
  
  // Histórico (para ML)
  total_operaciones_historicas?: number;
  monto_total_historico?: number;
  operaciones_ultimos_6m?: number;
  monto_ultimos_6m?: number;
  
  created_at: string;
  updated_at?: string;
}

export interface ClienteDocumento {
  documento_id: string;
  cliente_id: string;
  tipo_documento: 'ine_anverso' | 'ine_reverso' | 'pasaporte' | 'acta_constitutiva' | 
                   'comprobante_domicilio' | 'comprobante_ingresos' | 'otro';
  file_name: string;
  file_path: string;
  file_size: number;
  
  // OCR
  ocr_procesado: boolean;
  datos_extraidos?: Record<string, any>;
  
  // Validación
  validado: boolean;
  fecha_validacion?: string;
  
  created_at: string;
}

export interface BusquedaLista {
  busqueda_id: string;
  cliente_id: string;
  tipo_lista: 'pep' | 'lista_69b' | 'ofac' | 'csnu' | 'interpol' | 'interna';
  termino_busqueda: string;
  coincidencias_encontradas: number;
  resultado: Array<{
    nombre: string;
    score: number;
    detalles: Record<string, any>;
  }>;
  created_at: string;
}

// ==================== NUEVOS TIPOS - MÓDULO OPERACIONES ====================

export interface Operacion {
  operacion_id: string;
  user_id: string;
  cliente_id?: string;
  
  // Datos Transacción
  folio_interno: string;
  fecha_operacion: string;
  hora_operacion?: string;
  
  // Montos
  monto: number;
  moneda: string;
  monto_usd: number;
  monto_umas?: number;
  
  // Tipo
  tipo_operacion: string;
  clasificacion_operacion?: string;
  descripcion?: string;
  
  // Análisis PLD
  analisis_id?: string;
  clasificacion_pld?: 'relevante' | 'inusual' | 'preocupante';
  nivel_riesgo?: 'bajo' | 'medio' | 'alto' | 'critico';
  score_ebr?: number;
  score_ml?: number;
  
  // Alertas
  tiene_alertas: boolean;
  alertas?: Array<{
    tipo: string;
    mensaje: string;
    severidad: string;
  }>;
  
  // Comparación vs Perfil
  supera_perfil?: boolean;
  desviacion_perfil?: number; // Sigmas
  
  // Guardrails
  supera_umbral_17500: boolean;
  requiere_aviso_uif: boolean;
  
  // Estado
  estado_revision: 'pendiente' | 'revisada' | 'aprobada' | 'reportada_uif' | 'archivada';
  notas_revision?: string;
  
  // Reporte UIF
  incluida_en_reporte_uif: boolean;
  reporte_uif_id?: string;
  
  created_at: string;
}

export interface PerfilTransaccional {
  cliente_id: string;
  
  // Estadísticas Históricas
  total_operaciones: number;
  monto_total: number;
  monto_promedio: number;
  
  // Últimos 6 meses (para LFPIORPI)
  operaciones_6m: number;
  monto_6m: number;
  
  // Perfil Esperado
  num_ops_mes_esperado: number;
  monto_mensual_esperado: number;
  desviacion_estandar: number;
  
  // Fechas
  fecha_primera_operacion: string;
  fecha_ultima_operacion: string;
  
  updated_at: string;
}

// ==================== NUEVOS TIPOS - MÓDULO REPORTES UIF ====================

export interface ReporteUIF {
  reporte_id: string;
  user_id: string;
  
  // Tipo
  tipo_reporte: 'mensual_relevantes' | 'aviso_24hrs' | 'informe_ausencia' | 'beneficiario_controlador';
  
  // Periodo
  periodo_inicio: string;
  periodo_fin: string;
  mes_reporte?: number;
  anio_reporte?: number;
  
  // Operaciones
  num_operaciones: number;
  monto_total: number;
  operaciones_ids: string[];
  
  // Archivos
  xml_file_path?: string;
  xml_file_name?: string;
  pdf_resumen_path?: string;
  
  // Firma Digital
  firmado: boolean;
  fecha_firma?: string;
  
  // Envío
  enviado_uif: boolean;
  fecha_envio?: string;
  numero_operacion_uif?: string;
  acuse_recibo_path?: string;
  
  // Estado
  estado: 'borrador' | 'generado' | 'firmado' | 'enviado' | 'aceptado' | 'rechazado';
  
  created_at: string;
}

// ==================== NUEVOS TIPOS - DASHBOARD ====================

export interface DashboardMetrics {
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
  ultimo_reporte_enviado?: string;
  dias_desde_ultimo_reporte?: number;
  expedientes_completos: number;
  expedientes_pendientes: number;
  
  // Alertas
  alertas_pendientes: number;
  alertas_criticas: number;
  
  // Score
  compliance_score?: number;
}

// ==================== PROPS DE COMPONENTES ====================

export interface TarantulaHawkPortalProps {
  user: UserData;
}

export interface GlobalStatusBarProps {
  isProcessing: boolean;
  progress: number;
  processingStage: string;
  onViewDetails?: () => void;
  statusMessage?: {
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
  } | null;
}

// ==================== TIPOS AUXILIARES ====================

export type TabType = 'kyc' | 'monitoring' | 'reportes-uif' | 'dashboard' | 
                      'upload' | 'history' | 'admin' | 'billing';

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  data?: Record<string, any>;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}