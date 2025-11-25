// DetalleTransaccionModal.tsx

import React from "react";
import { TransaccionAnalizada } from "./ml_types";

interface DetalleTransaccionModalProps {
  open: boolean;
  onClose: () => void;
  transaccion: TransaccionAnalizada | null;
}

export const DetalleTransaccionModal: React.FC<DetalleTransaccionModalProps> = ({
  open,
  onClose,
  transaccion,
}) => {
  if (!open || !transaccion) return null;

  // Normalización: aceptar múltiples formas del JSON (legacy y nuevas claves)
  const ml_section =
    (transaccion as any).modelo_supervisado ||
    (transaccion as any).clasificacion_ml ||
    (transaccion as any).ml ||
    (transaccion as any).detalle_tecnico?.ml ||
    (transaccion as any).detalles_tecnicos?.ml ||
    {};
  const ebr_section =
    (transaccion as any).matriz_ebr ||
    (transaccion as any).clasificacion_ebr ||
    (transaccion as any).ebr ||
    (transaccion as any).detalle_tecnico?.ebr ||
    (transaccion as any).detalles_tecnicos?.ebr ||
    {};
  const anom_section =
    (transaccion as any).modelo_no_supervisado ||
    (transaccion as any).anomalias ||
    (transaccion as any).detalle_tecnico?.no_supervisado ||
    (transaccion as any).detalles_tecnicos?.no_supervisado ||
    {};
  const explic_section = {
    ...(transaccion as any).explicacion || {},
    ...(transaccion as any).explicabilidad || {},
    ...(transaccion as any).detalle_tecnico?.explicacion || {},
    ...(transaccion as any).detalles_tecnicos?.explicacion || {},
    explicacion_principal:
      (transaccion as any).explicacion_principal ||
      (transaccion as any).explicacion?.explicacion_principal ||
      (transaccion as any).explicabilidad?.explicacion_principal ||
      "",
    explicacion_detallada:
      (transaccion as any).explicacion_detallada ||
      (transaccion as any).explicacion?.explicacion_detallada ||
      (transaccion as any).explicabilidad?.explicacion_detallada ||
      "",
  };

  const finalClasificacion =
    (transaccion as any).clasificacion_final || (transaccion as any).clasificacion || "";

  const nivelFromFinal = (() => {
    const map: Record<string, string> = { relevante: "bajo", inusual: "medio", preocupante: "alto" };
    const key = String(finalClasificacion).toLowerCase();
    return map[key] ?? (ml_section.nivel_riesgo_ml ?? ml_section.nivel_riesgo ?? "no_disponible");
  })();

  const safeProb = (p: any) => {
    try {
      return Math.max(0, Math.min(1, Number(p || 0)));
    } catch (e) {
      return 0;
    }
  };

  const prob_obj = ml_section.probabilidades || {
    relevante: safeProb(ml_section.prob_relevante),
    inusual: safeProb(ml_section.prob_inusual),
    preocupante: safeProb(ml_section.prob_preocupante),
  };

  const ica_val = Number(ml_section.indice_confianza_algoritmica ?? ml_section.ica ?? ml_section.ica_score ?? 0) || 0;

  const clasificacion_ml = {
    etiqueta: (ml_section.etiqueta_ml ?? ml_section.etiqueta ?? "N/D") as string,
    nivel_riesgo: nivelFromFinal,
    ica: ica_val,
    ica_percent: Math.round((ica_val || 0) * 1000) / 10, // 1 decimal percent
    probabilidades: {
      relevante: safeProb(prob_obj.relevante),
      inusual: safeProb(prob_obj.inusual),
      preocupante: safeProb(prob_obj.preocupante),
    },
  };

  const clasificacion_ebr = {
    score_ebr: Number(ebr_section.score_ebr ?? 0) || 0,
    nivel_riesgo: (ebr_section.nivel_riesgo_ebr ?? ebr_section.nivel_riesgo ?? "no_disponible") as string,
    banderas: ebr_section.banderas ?? ebr_section.flags ?? [],
  };

  const anomalias = {
    anomaly_score_iso: Number(anom_section.anomaly_score_iso ?? anom_section.anomaly_score_composite ?? 0) || 0,
    is_outlier_iso: Boolean(anom_section.is_outlier_iso),
    is_dbscan_noise: Boolean(anom_section.is_dbscan_noise),
  };

  const explicabilidad = {
    motivos: explic_section.razones || explic_section.factores_clave || explic_section.motivos || [],
    explicacion_principal: explic_section.explicacion_principal || "",
    explicacion_detallada: explic_section.explicacion_detallada || "",
    fundamento_lfpiorpi:
      (transaccion as any).fundamento_legal || explic_section.fundamento_legal || explic_section.fundamento_lfpiorpi || "",
  };

  const fundamentoLegal = explicabilidad.fundamento_lfpiorpi || "";

  const labelRiesgo: Record<string, string> = {
    bajo: "Bajo riesgo",
    medio: "Riesgo medio",
    alto: "Alto riesgo",
  };

  const labelEtiqueta: Record<string, string> = {
    relevante: "Relevante (bajo riesgo)",
    inusual: "Inusual (riesgo medio)",
    preocupante: "Preocupante (alto riesgo)",
  };

  const isAnomalia =
    Boolean(anomalias?.is_outlier_iso) ||
    Boolean(anomalias?.is_dbscan_noise) ||
    (anomalias?.anomaly_score_iso ?? 0) > 0.8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto text-neutral-100">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-100">Detalle de operación #{String((transaccion as any).id_transaccion ?? "")}</h2>
            <p className="text-xs text-neutral-400 mt-1">
              Cliente: <span className="font-semibold">{(transaccion as any).cliente_id ?? "N/D"}</span> · Fecha: <span className="font-semibold">{(transaccion as any).fecha_operacion ?? "N/D"}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-200 text-2xl px-2 py-1 rounded-full focus:outline-none" aria-label="Cerrar modal">×</button>
        </div>

        {/* Clasificación principal */}
        <section className="mb-4 pb-4 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-300 mb-2 tracking-wide">Clasificación final (ML)</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-medium text-neutral-200">Etiqueta:</span>{" "}
              <span className="text-neutral-100">{labelEtiqueta[clasificacion_ml.etiqueta as keyof typeof labelEtiqueta] ?? clasificacion_ml.etiqueta}</span>
            </div>
            <div>
              <span className="font-medium text-neutral-200">Nivel de riesgo (modelo):</span>{" "}
              <span className="text-neutral-100">{labelRiesgo[clasificacion_ml.nivel_riesgo as keyof typeof labelRiesgo]}</span>
            </div>
            <div>
              <span className="font-medium text-neutral-200">ICA (Índice de Confianza Algorítmica):</span>{" "}
              <span className="text-neutral-100">{((clasificacion_ml.ica || 0) * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-neutral-400">Probabilidades · Relevante: <span className="text-neutral-100">{(clasificacion_ml.probabilidades.relevante * 100).toFixed(1)}%</span> · Inusual: <span className="text-neutral-100">{(clasificacion_ml.probabilidades.inusual * 100).toFixed(1)}%</span> · Preocupante: <span className="text-neutral-100">{(clasificacion_ml.probabilidades.preocupante * 100).toFixed(1)}%</span></div>
        </section>

        {/* EBR */}
        <section className="mb-4 pb-4 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-300 mb-2 tracking-wide">Enfoque Basado en Riesgos (EBR)</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="font-medium text-neutral-200">Score EBR:</span>{" "}
              <span className="text-neutral-100">{clasificacion_ebr.score_ebr.toFixed(1)}</span>
            </div>
            <div>
              <span className="font-medium text-neutral-200">Nivel de riesgo (EBR):</span>{" "}
              <span className="text-neutral-100">{labelRiesgo[clasificacion_ebr.nivel_riesgo as keyof typeof labelRiesgo]}</span>
            </div>
          </div>
          {clasificacion_ebr.banderas?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-neutral-300 mb-1">Factores de riesgo identificados:</p>
              <ul className="list-disc list-inside text-xs text-neutral-200">{clasificacion_ebr.banderas.map((b: string, idx: number) => (<li key={idx}>{b}</li>))}</ul>
            </div>
          )}
        </section>

        {/* Anomalías */}
        <section className="mb-4 pb-4 border-b border-neutral-800">
          <h3 className="text-sm font-semibold text-neutral-300 mb-2 tracking-wide">Señales de anomalía (modelo no supervisado)</h3>
          {isAnomalia ? (<p className="text-sm text-red-400 font-semibold">Esta operación presenta un patrón atípico frente a operaciones similares en el histórico de la entidad.</p>) : (<p className="text-sm text-neutral-400">No se detectaron anomalías significativas en esta operación.</p>)}
          <div className="mt-2 text-xs text-neutral-400">anomaly_score_iso: <span className="text-neutral-100">{anomalias?.anomaly_score_iso.toFixed(3)}</span> · is_outlier_iso: <span className="text-neutral-100">{anomalias?.is_outlier_iso ? "Sí" : "No"}</span> · is_dbscan_noise: <span className="text-neutral-100">{anomalias?.is_dbscan_noise ? "Sí" : "No"}</span></div>
        </section>

        {/* Explicabilidad legal / técnica */}
        <section className="mb-2">
          <h3 className="text-sm font-semibold text-neutral-300 mb-2 tracking-wide">Fundamento y explicación conforme LFPIORPI</h3>
          {explicabilidad.explicacion_principal ? (<p className="text-sm font-semibold text-neutral-100 mb-2">{explicabilidad.explicacion_principal}</p>) : null}
          {explicabilidad.motivos?.length > 0 && (<ul className="list-disc list-inside text-xs text-neutral-200 mb-2">{explicabilidad.motivos.map((m: string, idx: number) => (<li key={idx}>{m}</li>))}</ul>)}
          {explicabilidad.explicacion_detallada ? (<div className="text-xs text-neutral-400 whitespace-pre-line mb-2">{explicabilidad.explicacion_detallada}</div>) : fundamentoLegal ? (<p className="text-xs text-neutral-400 whitespace-pre-line">{fundamentoLegal}</p>) : null}
        </section>

        {/* Footer acciones: cerrar */}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-neutral-800 text-sm text-neutral-200 hover:bg-neutral-700 border border-neutral-700">Cerrar</button>
        </div>
      </div>
    </div>
  );
};
// (end of file)
