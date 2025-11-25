import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";

interface TransactionDetailModalProps {
  open: boolean;
  onClose: () => void;
  tx: TransactionExplanation | null;
  language?: "es" | "en";
}

export function TransactionDetailModal({
  open,
  onClose,
  tx,
  language = "es",
}: TransactionDetailModalProps) {
  if (!tx) return null;

  const isEs = language === "es";

  const riskColor =
    tx.clasificacion === "preocupante"
      ? "bg-red-500/20 text-red-300 border-red-500/40"
      : tx.clasificacion === "inusual"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

  const confianzaLabelMap: Record<string, string> = {
    alta: isEs ? "Alta" : "High",
    media: isEs ? "Media" : "Medium",
    baja: isEs ? "Baja" : "Low",
    muy_baja: isEs ? "Muy baja" : "Very low",
    no_disponible: isEs ? "No disponible" : "Not available",
  };

  const confianzaLabel = confianzaLabelMap[tx.nivel_confianza] ?? tx.nivel_confianza;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-slate-950 border border-slate-800/80 text-slate-100">
        <DialogHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <DialogTitle className="flex items-center gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${riskColor}`}
              >
                {tx.clasificacion.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400">
                {isEs ? "Detalle de evaluación de riesgo" : "Risk evaluation detail"}
              </span>
            </DialogTitle>
            <p className="text-sm text-slate-400 max-w-2xl">
              {tx.razon_principal}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="border-teal-500/50 text-teal-300 text-[10px]">
              {isEs ? "Índice EBR" : "EBR index"}: {(tx.score_ebr * 100).toFixed(0)}%
            </Badge>
            <Badge variant="outline" className="border-blue-500/50 text-blue-300 text-[10px]">
              {isEs ? "Índice de confiabilidad algorítmica" : "Model reliability index"}:{" "}
              {(tx.indice_confiabilidad_algoritmica * 100).toFixed(0)}%
            </Badge>
            <Badge variant="outline" className="text-[10px] text-slate-300 border-slate-700">
              {isEs ? "Nivel de confianza:" : "Confidence level:"} {confianzaLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
          {/* Columna izquierda: EBR / Modelo / contexto numérico */}
          <div className="space-y-4">
            <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span>{isEs ? "Índices de riesgo" : "Risk indexes"}</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {tx.config_ebr?.version ?? "EBR_v1.0"}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{isEs ? "Índice EBR (enfoque basado en riesgos)" : "EBR index"}</span>
                  <span className="font-mono text-teal-300">
                    {(tx.score_ebr * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={tx.score_ebr * 100} className="h-1.5" />
              </div>

              {tx.contexto?.probabilidades_ml && (
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{isEs ? "Distribución del modelo ML" : "ML class probabilities"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    {Object.entries(tx.contexto.probabilidades_ml).map(([cls, p]) => (
                      <div key={cls} className="flex items-center justify-between text-xs">
                        <span className="capitalize text-slate-300">{cls}</span>
                        <span className="font-mono text-slate-200">{(p * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Info className="w-4 h-4 text-sky-400" />
                <span>{isEs ? "Contexto del cliente" : "Customer context"}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
                <span>{isEs ? "Monto" : "Amount"}:</span>
                <span className="text-slate-200">{tx.contexto.monto_formateado}</span>
                <span>{isEs ? "Acumulado 6 meses" : "6M total"}:</span>
                <span className="text-slate-200">{tx.contexto.acumulado_6m}</span>
                <span>{isEs ? "Operaciones 6 meses" : "Ops in 6M"}:</span>
                <span className="text-slate-200">
                  {tx.contexto.operaciones_historicas ?? "-"}
                </span>
                <span>{isEs ? "Horario" : "Time window"}:</span>
                <span className="text-slate-200">{tx.contexto.horario}</span>
                <span>{isEs ? "Tipo de operación" : "Operation type"}:</span>
                <span className="text-slate-200">{tx.contexto.tipo_operacion}</span>
                <span>{isEs ? "Perfil del cliente" : "Customer profile"}:</span>
                <span className="text-slate-200">{tx.contexto.perfil_cliente}</span>
              </div>
            </div>
          </div>

          {/* Columna derecha: factores, acciones y fundamento normativo */}
          <div className="space-y-4">
            <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>{isEs ? "Factores de riesgo detectados" : "Detected risk factors"}</span>
              </div>
              <ul className="space-y-1.5">
                {tx.factores_riesgo && tx.factores_riesgo.length > 0 ? (
                  tx.factores_riesgo.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-[3px] text-amber-400">•</span>
                      <div>
                        <div className="font-medium text-slate-200 text-[11px]">
                          {f.descripcion}
                        </div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                          {f.tipo} · {f.codigo}
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">
                    {isEs ? "No se detectaron factores relevantes." : "No relevant risk factors found."}
                  </li>
                )}
              </ul>
            </div>

            <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">
                  {isEs ? "Acción sugerida" : "Suggested action"}
                </span>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">
                  {tx.requiere_revision_urgente
                    ? isEs
                      ? "Revisión urgente"
                      : "Urgent review"
                    : isEs
                    ? "Revisión estándar"
                    : "Standard review"}
                </Badge>
              </div>
              <p className="text-slate-200">{tx.accion_sugerida}</p>
              <div className="space-y-1.5">
                <div className="text-slate-300">
                  {isEs ? "Recomendaciones adicionales" : "Additional recommendations"}
                </div>
                <ul className="list-disc pl-4 text-slate-400">
                  {tx.recomendaciones.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-500">
                <div className="font-semibold mb-1">
                  {isEs ? "Fundamento normativo" : "Regulatory basis"}
                </div>
                <p>{tx.contexto.fundamento_normativo}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center text-[10px] text-slate-500">
          <span>
            {isEs ? "Explicación generada" : "Explanation generated"}:{" "}
            {new Date(tx.timestamp_explicacion).toLocaleString()}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
