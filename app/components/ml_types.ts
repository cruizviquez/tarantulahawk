// ml_types.ts

export type EtiquetaML = "relevante" | "inusual" | "preocupante";
export type NivelRiesgo = "bajo" | "medio" | "alto";

export interface ProbabilidadesML {
  relevante: number;
  inusual: number;
  preocupante: number;
}

export interface ThresholdsRL {
  preocupante: number | null;
  inusual: number | null;
}

export interface ClasificacionML {
  etiqueta: EtiquetaML;        // relevante / inusual / preocupante
  nivel_riesgo: NivelRiesgo;   // bajo / medio / alto (derivado de la etiqueta)
  ica: number;                 // Índice de Confianza Algorítmica
  probabilidades: ProbabilidadesML;
  thresholds: ThresholdsRL;
}

export interface ClasificacionEBR {
  score_ebr: number;           // índice 0–100 (o el rango que definimos)
  nivel_riesgo: NivelRiesgo;   // bajo / medio / alto
  banderas: string[];          // ["Uso intensivo de efectivo", "Operaciones cercanas al umbral", ...]
}

export interface AnomaliasInfo {
  anomaly_score_iso: number;
  is_outlier_iso: number;      // 0 / 1
  is_dbscan_noise: number;     // 0 / 1
}

export interface ImpactoFeature {
  feature: string;             // nombre columna
  importancia: number;         // peso relativo (ej. SHAP normalizado)
  sentido: "a_favor" | "en_contra";
}

export interface ExplicabilidadInfo {
  motivos: string[];                   // frases en español explicando por qué cayó en esa clase
  impacto_features?: ImpactoFeature[]; // opcional
  fundamento_lfpiorpi?: string;        // texto con artículos / fracciones relevantes
}

export interface MetadataML {
  analysis_id?: string;
  fuente_modelo: string;       // "ensemble_supervisado_v2"
  version_modelo: string;      // "2.0"
}

export interface TransaccionAnalizada {
  id_transaccion: string | number;
  cliente_id?: string | number | null;
  monto: number;
  moneda: string;
  fecha_operacion: string;
  tipo_operacion?: string | null;
  sector_actividad?: string | null;

  clasificacion_ml: ClasificacionML;
  clasificacion_ebr: ClasificacionEBR;
  anomalias: AnomaliasInfo;
  explicabilidad: ExplicabilidadInfo;
  metadata: MetadataML;
}
