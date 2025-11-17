// types/portal.ts
/**
 * TarantulaHawk Portal - Type Definitions
 * Tipos e interfaces para el portal de análisis PLD
 */

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

// ✅ NUEVAS INTERFACES PARA JSON ENRIQUECIDO

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
  severidad: 'baja' | 'media' | 'alta' | 'critica';
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

export interface TarantulaHawkPortalProps {
  user: UserData;
}