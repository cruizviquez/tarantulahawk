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

  // Support both new and legacy shapes
  const ml_section =
    (transaccion as any).modelo_supervisado || (transaccion as any).clasificacion_ml || (transaccion as any).ml || {};
  const ebr_section =
    (transaccion as any).matriz_ebr || (transaccion as any).clasificacion_ebr || (transaccion as any).ebr || {};
  const anom_section = (transaccion as any).modelo_no_supervisado || (transaccion as any).anomalias || {};
  const explic_section = {
    // permitir que la explicación venga anidada o en campos top-level
    ...(transaccion as any).explicacion || {},
    ...(transaccion as any).explicabilidad || {},
    explicacion_principal: (transaccion as any).explicacion_principal || (transaccion as any).explicacion?.explicacion_principal,
    explicacion_detallada: (transaccion as any).explicacion_detallada || (transaccion as any).explicacion?.explicacion_detallada,
  };

  // Normalizar nombres para el template
  // Derivar el nivel de riesgo preferentemente desde la clasificación final
  const finalClasificacion =
    (transaccion as any).clasificacion_final || (transaccion as any).clasificacion || "";

  const nivelFromFinal = (() => {
    const map: Record<string, string> = { relevante: "bajo", inusual: "medio", preocupante: "alto" };
    const key = String(finalClasificacion).toLowerCase();
    return map[key] ?? (ml_section.nivel_riesgo_ml ?? ml_section.nivel_riesgo ?? "no_disponible");
  })();

  const clasificacion_ml = {
    etiqueta: ml_section.etiqueta_ml ?? ml_section.etiqueta ?? "N/D",
    nivel_riesgo: nivelFromFinal,
    ica: ml_section.indice_confianza_algoritmica ?? ml_section.ica ?? ml_section.ica_score ?? 0,
    probabilidades:
      ml_section.probabilidades || {
        relevante: ml_section.prob_relevante ?? 0,
        inusual: ml_section.prob_inusual ?? 0,
        preocupante: ml_section.prob_preocupante ?? 0,
      },
  };

  const clasificacion_ebr = {
    score_ebr: ebr_section.score_ebr ?? 0,
    nivel_riesgo: ebr_section.nivel_riesgo_ebr ?? ebr_section.nivel_riesgo ?? "no_disponible",
    banderas: ebr_section.banderas ?? ebr_section.flags ?? [],
  };

  const anomalias = {
    anomaly_score_iso: anom_section.anomaly_score_iso ?? anom_section.anomaly_score_composite ?? 0,
    is_outlier_iso: Boolean(anom_section.is_outlier_iso),
    is_dbscan_noise: Boolean(anom_section.is_dbscan_noise),
  };

  const explicabilidad = {
    motivos: explic_section.razones || explic_section.factores_clave || [],
    explicacion_principal: explic_section.explicacion_principal || "",
    explicacion_detallada: explic_section.explicacion_detallada || "",
    // Priorizar `fundamento_legal` en la raíz de la transacción
    fundamento_lfpiorpi:
      (transaccion as any).fundamento_legal || explic_section.fundamento_legal || explic_section.fundamento_lfpiorpi || "",
  };

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-4 max-h-[70vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xl font-semibold">
              Detalle de operación #{String(transaccion.id_transaccion)}
            </h2>
            <p className="text-sm text-gray-500">
              Cliente: {transaccion.cliente_id ?? "N/D"} · Fecha:{" "}
              {transaccion.fecha_operacion}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl"
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Clasificación principal */}
        <section className="mb-3 border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Clasificación final (ML)
          </h3>
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <span className="font-medium">Etiqueta:</span>{" "}
              {labelEtiqueta[clasificacion_ml.etiqueta] ?? clasificacion_ml.etiqueta}
            </div>
            <div>
              <span className="font-medium">Nivel de riesgo (modelo):</span>{" "}
              {labelRiesgo[clasificacion_ml.nivel_riesgo]}
            </div>
            <div>
              <span className="font-medium">ICA (Índice de Confianza Algorítmica):</span>{" "}
              {(() => {
                const icaNum = Number(clasificacion_ml.ica) || 0;
                return (
                  <span title={`ICA: ${icaNum.toFixed(3)} — Índice de certeza algorítmica (0..1)`}>
                    {(icaNum * 100).toFixed(1)}%
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            Probabilidades · Relevante:{" "}
            {(clasificacion_ml.probabilidades.relevante * 100).toFixed(1)}% · Inusual:{" "}
            {(clasificacion_ml.probabilidades.inusual * 100).toFixed(1)}% ·
            Preocupante:{" "}
            {(clasificacion_ml.probabilidades.preocupante * 100).toFixed(1)}%
          </div>
        </section>

        {/* EBR */}
        <section className="mb-3 border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Enfoque Basado en Riesgos (EBR)
          </h3>
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <span className="font-medium">Score EBR:</span>{" "}
              {clasificacion_ebr.score_ebr.toFixed(1)}
            </div>
            <div>
              <span className="font-medium">Nivel de riesgo (EBR):</span>{" "}
              {labelRiesgo[clasificacion_ebr.nivel_riesgo]}
            </div>
          </div>

          {clasificacion_ebr.banderas?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-600 mb-1">
                Factores de riesgo identificados:
              </p>
              <ul className="list-disc list-inside text-xs text-gray-600">
                {clasificacion_ebr.banderas.map((b: string, idx: number) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Anomalías */}
        <section className="mb-3 border-b pb-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Señales de anomalía (modelo no supervisado)
          </h3>
          {isAnomalia ? (
            <p className="text-sm text-red-600 font-medium">
              Esta operación presenta un patrón atípico frente a operaciones similares
              en el histórico de la entidad.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              No se detectaron anomalías significativas en esta operación.
            </p>
          )}

          <div className="mt-2 text-xs text-gray-500">
            anomaly_score_iso: {anomalias?.anomaly_score_iso.toFixed(3)} ·
            is_outlier_iso: {anomalias?.is_outlier_iso ? "Sí" : "No"} ·
            is_dbscan_noise: {anomalias?.is_dbscan_noise ? "Sí" : "No"}
          </div>
        </section>

        {/* Explicabilidad legal / técnica */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Fundamento y explicación conforme LFPIORPI
          </h3>

          {/* Mostrar explicación principal breve si existe */}
          {explicabilidad.explicacion_principal ? (
            <p className="text-sm font-medium text-gray-800 mb-2">
              {explicabilidad.explicacion_principal}
            </p>
          ) : null}

          {explicabilidad.motivos?.length > 0 && (
            <ul className="list-disc list-inside text-xs text-gray-700 mb-2">
              {explicabilidad.motivos.map((m: string, idx: number) => (
                  <li key={idx}>{m}</li>
                ))}
            </ul>
          )}

          {/* Explicación detallada (puede incluir fundamento legal y texto ampliado) */}
          {explicabilidad.explicacion_detallada ? (
            <div className="text-xs text-gray-500 whitespace-pre-line mb-2">
              {explicabilidad.explicacion_detallada}
            </div>
          ) : explicabilidad.fundamento_lfpiorpi ? (
            <p className="text-xs text-gray-500 whitespace-pre-line">
              {explicabilidad.fundamento_lfpiorpi}
            </p>
          ) : null}
        </section>
        {/* Footer acciones: cerrar */}
        <div className="mt-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md bg-gray-100 text-sm text-gray-700 hover:bg-gray-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
