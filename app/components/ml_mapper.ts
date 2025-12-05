// ml_mapper.ts

import { TransaccionAnalizada, NivelRiesgo, EtiquetaML } from "./ml_types";

// Lo que usarías para tu tabla principal en el portal
export interface TransaccionRow {
  id: string | number;
  cliente: string | number | null;
  cliente_id?: string | number | null;
  id_transaccion?: string | number;
  fecha: string;
  monto: number;
  moneda: string;
  tipo_operacion: string | null;
  sector_actividad: string | null;

  // Etiquetas de riesgo consolidado para la UI
  etiqueta_ml: EtiquetaML;
  nivel_riesgo_ml: NivelRiesgo;
  ica: number;

  score_ebr: number;
  nivel_riesgo_ebr: NivelRiesgo;

  // Anomalías
  es_anomalia: boolean;
  anomaly_score: number;

  // Info para tooltips / modal
  banderas_ebr: string[];
  motivos_ml: string[];
}

export function mapApiResponseToRows(
  apiData: any[]
): TransaccionRow[] {
  const data = apiData as TransaccionAnalizada[];

  return data.map((t) => {
    const ml = t.clasificacion_ml ?? {
      etiqueta: "relevante" as any,
      nivel_riesgo: "bajo" as any,
      ica: 0,
      probabilidades: { relevante: 0, inusual: 0, preocupante: 0 },
      thresholds: { preocupante: null, inusual: null },
    };
    const ebr = t.clasificacion_ebr ?? {
      score_ebr: 0,
      nivel_riesgo: "bajo" as any,
      banderas: [],
    };
    const an = t.anomalias || { anomaly_score_iso: 0, is_outlier_iso: 0, is_dbscan_noise: 0 };
    const expl = t.explicabilidad || { motivos: [] };

    const esAnomalia =
      Boolean(an.is_outlier_iso) || Boolean(an.is_dbscan_noise) || (an.anomaly_score_iso ?? 0) > 0.8;

    return {
      id: t.id_transaccion,
      cliente: t.cliente_id ?? null,
      // keep original backend field in the mapped row so the modal can access it
      cliente_id: t.cliente_id ?? null,
      fecha: t.fecha_operacion,
      monto: t.monto,
      moneda: t.moneda,
      tipo_operacion: t.tipo_operacion ?? null,
      sector_actividad: t.sector_actividad ?? null,

      etiqueta_ml: ml.etiqueta,
      nivel_riesgo_ml: ml.nivel_riesgo,
      ica: ml.ica,

      score_ebr: ebr.score_ebr,
      nivel_riesgo_ebr: ebr.nivel_riesgo,

      es_anomalia: esAnomalia,
      anomaly_score: an.anomaly_score_iso ?? 0,

      banderas_ebr: ebr.banderas || [],
      motivos_ml: expl.motivos || [],
    };
  });
}
