from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

import pandas as pd


@dataclass
class EBRConfig:
    version: str = "EBR_v1.0"
    umbral_bajo: float = 0.4
    umbral_medio: float = 0.7
    umbral_alto: float = 0.85


class TransactionExplainer:
    """
    Genera explicaciones estructuradas por transacción, combinando:
      - Clasificación (relevante / inusual / preocupante)
      - Score EBR (0-1) basado en enfoque de riesgos
      - Disparadores (triggers) de reglas de negocio / guardrails LFPIORPI
      - Contexto de cliente e histórico 6M
    """

    def __init__(self, ebr_config: Optional[EBRConfig] = None):
        self.ebr_config = ebr_config or EBRConfig()

        # Recomendaciones por clasificación
        self.recomendaciones_por_clasificacion = {
            "preocupante": [
                "Preparar y enviar reporte de operación inusual a la UIF",
                "Revisar expediente KYC y documentación soporte",
                "Evaluar si se requiere reforzar monitoreo del cliente"
            ],
            "inusual": [
                "Revisar manualmente la transacción y el perfil del cliente",
                "Solicitar aclaración o documentación adicional si aplica"
            ],
            "relevante": [
                "Conservar registro conforme a LFPIORPI",
                "Monitorear comportamiento futuro del cliente"
            ]
        }

    # ------------------------------------------------------------------ #
    # API pública
    # ------------------------------------------------------------------ #
    def explicar_transaccion(
        self,
        row: pd.Series,
        score_ebr: Optional[float],
        triggers: List[str],
        origen: str,
        probas_ml: Optional[Dict[str, float]] = None
    ) -> Dict:
        """
        Construye un dict de explicación para una transacción.
        """

        clasificacion = str(row.get("clasificacion", "desconocido"))

        # Determinar nivel de confianza EBR (índice de confiabilidad algorítmica)
        nivel_confianza, comentario_confianza = self._clasificar_confianza(score_ebr)

        factores_riesgo = self._mapear_factores_riesgo(row, triggers)
        razon_principal = self._generar_razon_principal(clasificacion, factores_riesgo, score_ebr)

        accion_sugerida, recomendaciones = self._acciones_por_clasificacion(clasificacion)

        contexto = self._generar_contexto(row, probas_ml)

        return {
            "clasificacion": clasificacion,
            "score_ebr": float(score_ebr) if score_ebr is not None else 0.0,
            "nivel_confianza": nivel_confianza,
            "comentario_confianza": comentario_confianza,
            "indice_confiabilidad_algoritmica": float(score_ebr) if score_ebr is not None else 0.0,
            "razon_principal": razon_principal,
            "factores_riesgo": factores_riesgo,
            "triggers_principales": factores_riesgo[:3],
            "n_triggers_principales": len(factores_riesgo),
            "origen_clasificacion": origen,
            "accion_sugerida": accion_sugerida,
            "recomendaciones": recomendaciones,
            "contexto": contexto,
            "config_ebr": {
                "version": self.ebr_config.version,
                "umbrales": {
                    "bajo": self.ebr_config.umbral_bajo,
                    "medio": self.ebr_config.umbral_medio,
                    "alto": self.ebr_config.umbral_alto,
                }
            },
            "requiere_revision_urgente": clasificacion == "preocupante",
            "timestamp_explicacion": datetime.now().isoformat()
        }

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _clasificar_confianza(self, score_ebr: Optional[float]) -> (str, str):
        if score_ebr is None:
            return "no_disponible", "Score EBR no calculado"

        s = float(score_ebr)

        if s >= self.ebr_config.umbral_alto:
            return "alta", "Riesgo respaldado por múltiples factores normativos y de comportamiento"
        if s >= self.ebr_config.umbral_medio:
            return "media", "Riesgo moderado con varios factores a considerar"
        if s >= self.ebr_config.umbral_bajo:
            return "baja", "Riesgo bajo, pero se recomienda monitoreo"
        return "muy_baja", "Riesgo muy bajo según el enfoque basado en riesgos"

    def _mapear_factores_riesgo(self, row: pd.Series, triggers: List[str]) -> List[Dict]:
        factores = []

        monto = float(row.get("monto", 0.0))
        sector_riesgo = int(row.get("SectorAltoRiesgo", 0))
        es_efectivo = int(row.get("EsEfectivo", 0))
        es_internacional = int(row.get("EsInternacional", 0))
        es_nocturno = int(row.get("es_nocturno", 0))
        fin_semana = int(row.get("fin_de_semana", 0))
        freq_mensual = float(row.get("frecuencia_mensual", 0.0))
        ratio_vs_prom = float(row.get("ratio_vs_promedio", 1.0))
        monto_6m = float(row.get("monto_6m", 0.0))

        # Guardrails
        if any(t.startswith("guardrail_") for t in triggers):
            factores.append({
                "codigo": "guardrail_lfpiorpi",
                "tipo": "normativo",
                "descripcion": "La operación rebasa umbrales de aviso o efectivo establecidos en la LFPIORPI."
            })

        # Sector
        if sector_riesgo == 1:
            factores.append({
                "codigo": "sector_alto_riesgo",
                "tipo": "perfil_cliente",
                "descripcion": "El cliente pertenece a un sector de actividad vulnerable con alto riesgo inherente."
            })

        # Efectivo / internacional
        if es_efectivo == 1:
            factores.append({
                "codigo": "operacion_efectivo",
                "tipo": "medio_pago",
                "descripcion": "La operación se realiza en efectivo, lo cual incrementa el riesgo de lavado de dinero."
            })
        if es_internacional == 1:
            factores.append({
                "codigo": "operacion_internacional",
                "tipo": "geografia",
                "descripcion": "La operación tiene componente internacional, lo que exige mayor escrutinio."
            })

        # Temporalidad
        if (es_nocturno == 1 or fin_semana == 1) and (es_efectivo == 1 or es_internacional == 1):
            factores.append({
                "codigo": "horario_inusual",
                "tipo": "comportamiento",
                "descripcion": "La operación se realiza en horario y/o día atípico combinado con efectivo o internacional."
            })

        # Frecuencia / patrones
        if freq_mensual > 10:
            factores.append({
                "codigo": "alta_frecuencia",
                "tipo": "comportamiento",
                "descripcion": "El cliente presenta alta frecuencia de operaciones en los últimos 6 meses."
            })

        if ratio_vs_prom > 3.0:
            factores.append({
                "codigo": "desviacion_perfil",
                "tipo": "comportamiento",
                "descripcion": "El monto de la operación es varias veces superior al promedio histórico del cliente."
            })

        if monto_6m > 0:
            factores.append({
                "codigo": "acumulacion_6m",
                "tipo": "acumulacion",
                "descripcion": "El cliente presenta un volumen acumulado relevante en los últimos 6 meses."
            })

        return factores

    def _generar_razon_principal(
        self,
        clasificacion: str,
        factores_riesgo: List[Dict],
        score_ebr: Optional[float]
    ) -> str:
        if clasificacion == "preocupante":
            base = "La transacción fue clasificada como PREOCUPANTE porque presenta múltiples indicadores de alto riesgo"
        elif clasificacion == "inusual":
            base = "La transacción fue clasificada como INUSUAL porque se desvía del patrón esperado del cliente"
        elif clasificacion == "relevante":
            base = "La transacción fue clasificada como RELEVANTE con base en su monto y características"
        else:
            base = "La transacción tiene una clasificación no estándar"

        if factores_riesgo:
            base += f", destacando principalmente: {factores_riesgo[0]['descripcion']}"
        if score_ebr is not None:
            base += f". El índice EBR estimado es {score_ebr:.2f}, conforme al enfoque basado en riesgos de la LFPIORPI."
        else:
            base += ". El índice EBR no se pudo estimar para esta operación."

        return base

    def _acciones_por_clasificacion(self, clasificacion: str):
        recs = self.recomendaciones_por_clasificacion.get(
            clasificacion,
            ["Revisar la transacción manualmente."]
        )

        if clasificacion == "preocupante":
            accion = "Enviar reporte a la UIF y documentar análisis."
        elif clasificacion == "inusual":
            accion = "Revisar manualmente la transacción y documentar hallazgos."
        elif clasificacion == "relevante":
            accion = "Mantener registro conforme a LFPIORPI y monitorear."
        else:
            accion = "Revisar y ajustar la clasificación manualmente."

        return accion, recs

    def _generar_contexto(self, row: pd.Series, probas_ml: Optional[Dict[str, float]] = None) -> Dict:
        monto = float(row.get("monto", 0.0))
        ops_6m = int(row.get("ops_6m", 0))
        monto_6m = float(row.get("monto_6m", 0.0))
        ratio = float(row.get("ratio_vs_promedio", 1.0))

        contexto = {
            "monto_formateado": f"${monto:,.2f} MXN",
            "operaciones_historicas": ops_6m,
            "acumulado_6m": f"${monto_6m:,.2f} MXN" if monto_6m > 0 else "No disponible",
        }

        # Horario
        if int(row.get("es_nocturno", 0)) == 1:
            contexto["horario"] = "Nocturno (22h-6h)"
        elif int(row.get("fin_de_semana", 0)) == 1:
            contexto["horario"] = "Fin de semana"
        else:
            contexto["horario"] = "Horario hábil"

        # Tipo de operación
        detalles = []
        if int(row.get("EsEfectivo", 0)) == 1:
            detalles.append("Efectivo")
        if int(row.get("EsInternacional", 0)) == 1:
            detalles.append("Internacional")
        if int(row.get("es_monto_redondo", 0)) == 1:
            detalles.append("Monto redondo")

        contexto["tipo_operacion"] = ", ".join(detalles) if detalles else "Estándar"

        # Perfil cliente
        if ops_6m <= 1:
            contexto["perfil_cliente"] = "Cliente nuevo o esporádico"
        elif ops_6m < 5:
            contexto["perfil_cliente"] = "Cliente ocasional"
        elif ops_6m < 20:
            contexto["perfil_cliente"] = "Cliente regular"
        else:
            contexto["perfil_cliente"] = "Cliente frecuente"

        # Ratio vs promedio
        if ratio > 5.0:
            contexto["patron_comportamiento"] = f"Monto {ratio:.1f}x superior a su promedio histórico"
        elif ratio > 2.0:
            contexto["patron_comportamiento"] = f"Monto {ratio:.1f}x superior al promedio habitual"
        else:
            contexto["patron_comportamiento"] = "Monto alineado al comportamiento esperado"

        # Probabilidades del modelo ML (para mostrar en UI)
        if probas_ml:
            contexto["probabilidades_ml"] = probas_ml

        # Fundamento normativo general
        contexto["fundamento_normativo"] = (
            "Clasificación generada bajo un enfoque basado en riesgos, "
            "alineado con las obligaciones de identificación, monitoreo y reporte "
            "establecidas en la Ley Federal para la Prevención e Identificación "
            "de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI)."
        )

        return contexto
