#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
explicabilidad_transactions.py - Sistema de Explicabilidad para Portal

Genera metadata completa por transacción para mostrar en el portal:
1. Score de confianza
2. Explicación detallada
3. Flag de revisión manual
4. Alertas de reclasificación
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List

class TransactionExplainer:
    """
    Genera explicaciones detalladas y flags de revisión para transacciones
    """
    
    def __init__(self, umbral_confianza_bajo: float = 0.65):
        """
        Args:
            umbral_confianza_bajo: Umbral para marcar como "baja confianza"
        """
        self.umbral_confianza_bajo = umbral_confianza_bajo
    
    def explicar_transaccion(
        self, 
        row: pd.Series,
        probabilidades: Dict[str, float] = None,
        triggers: List[str] = None
    ) -> Dict[str, Any]:
        """
        Genera explicación completa para una transacción
        
        Returns:
            {
                "score_confianza": 0.87,
                "nivel_confianza": "alta|media|baja",
                "clasificacion": "preocupante",
                "origen": "normativo",
                "explicacion_principal": "Monto excede umbral LFPIORPI...",
                "explicacion_detallada": "Esta transacción fue clasificada...",
                "razones": ["Umbral normativo LFPIORPI", "Monto alto"],
                "flags": {
                    "requiere_revision_manual": False,
                    "sugerir_reclasificacion": False,
                    "alertas": []
                },
                "contexto_regulatorio": "Fracción XI - Joyería...",
                "acciones_sugeridas": ["Verificar origen de fondos"]
            }
        """
        
        clasificacion = str(row.get('clasificacion', ''))
        origen = str(row.get('origen', ''))
        fue_corregido = bool(row.get('fue_corregido_por_guardrail', False))
        monto = float(row.get('monto', 0))
        
        # 1. Score de Confianza
        score_confianza, nivel_confianza = self._calcular_confianza(
            clasificacion, probabilidades, origen, fue_corregido
        )
        
        # 2. Explicación Principal
        explicacion_principal = self._generar_explicacion_principal(
            clasificacion, origen, fue_corregido, triggers or []
        )
        
        # 3. Explicación Detallada
        explicacion_detallada = self._generar_explicacion_detallada(
            row, clasificacion, origen, fue_corregido, triggers or []
        )
        
        # 4. Razones Human-Readable
        razones = self._generar_razones(triggers or [], fue_corregido)
        
        # 5. Flags de Revisión
        flags = self._generar_flags_revision(
            clasificacion, score_confianza, triggers or [], row
        )
        
        # 6. Contexto Regulatorio
        contexto_regulatorio = self._generar_contexto_regulatorio(
            row.get('fraccion', '_'), monto
        )
        
        # 7. Acciones Sugeridas
        acciones_sugeridas = self._generar_acciones_sugeridas(
            clasificacion, origen, flags, row
        )
        
        return {
            "score_confianza": round(score_confianza, 3),
            "nivel_confianza": nivel_confianza,
            "clasificacion": clasificacion,
            "origen": origen,
            "explicacion_principal": explicacion_principal,
            "explicacion_detallada": explicacion_detallada,
            "razones": razones,
            "flags": flags,
            "contexto_regulatorio": contexto_regulatorio,
            "acciones_sugeridas": acciones_sugeridas
        }
    
    def _calcular_confianza(
        self, 
        clasificacion: str, 
        probabilidades: Dict[str, float],
        origen: str,
        fue_corregido: bool
    ) -> tuple:
        """
        Calcula score de confianza (0-1)
        
        Lógica:
        - Normativo (guardrails): 1.0 (100% confianza)
        - ML alta confianza: max(probabilidades)
        - Reglas: 0.85 (alta pero no absoluta)
        - Conservador: 0.60 (baja)
        """
        
        # Normativo = 100% confianza
        if fue_corregido or origen == "normativo":
            return 1.0, "alta"
        
        # ML con probabilidades
        if probabilidades and clasificacion in probabilidades:
            score = probabilidades[clasificacion]
            if score >= 0.85:
                return score, "alta"
            elif score >= self.umbral_confianza_bajo:
                return score, "media"
            else:
                return score, "baja"
        
        # Reglas
        if origen in ["reglas", "reglas_multi"]:
            return 0.85, "alta"
        
        # Conservador
        if origen == "conservador":
            return 0.60, "baja"
        
        # Default
        return 0.70, "media"
    
    def _generar_explicacion_principal(
        self, 
        clasificacion: str, 
        origen: str,
        fue_corregido: bool,
        triggers: List[str]
    ) -> str:
        """Genera frase principal explicando la clasificación"""
        
        if fue_corregido:
            return "Monto excede umbral normativo LFPIORPI. Clasificación obligatoria por regulación."
        
        if origen == "normativo":
            return "Cumple criterios normativos de la Ley Federal PLD. Aviso obligatorio a UIF."
        
        if origen in ["ml_alta_confianza", "ml"]:
            return f"Clasificación basada en análisis de Machine Learning. Patrón {'sospechoso' if clasificacion == 'preocupante' else 'inusual' if clasificacion == 'inusual' else 'normal'} detectado."
        
        if origen in ["reglas", "reglas_multi"]:
            n_triggers = len([t for t in triggers if t.startswith("inusual_")])
            return f"Clasificación basada en {n_triggers} indicadores de riesgo detectados."
        
        return f"Transacción clasificada como {clasificacion}."
    
    def _generar_explicacion_detallada(
        self, 
        row: pd.Series,
        clasificacion: str,
        origen: str,
        fue_corregido: bool,
        triggers: List[str]
    ) -> str:
        """Genera explicación larga y detallada"""
        
        monto = float(row.get('monto', 0))
        tipo_op = str(row.get('tipo_operacion', ''))
        sector = str(row.get('sector_actividad', ''))
        
        partes = []
        
        # Intro
        partes.append(f"Esta transacción de ${monto:,.2f} MXN ({tipo_op}) en el sector {sector}")
        
        # Por qué se clasificó así
        if fue_corregido:
            partes.append("fue **forzada a clasificación 'preocupante'** por superar los umbrales normativos establecidos en la Ley Federal de Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita (LFPIORPI).")
        elif origen == "ml_alta_confianza":
            partes.append(f"fue clasificada como **'{clasificacion}'** por nuestro modelo de Machine Learning con alta confianza, basándose en patrones históricos de transacciones similares.")
        elif origen == "reglas":
            n_triggers = len([t for t in triggers if not t.startswith("guardrail_")])
            partes.append(f"fue clasificada como **'{clasificacion}'** al cumplir con {n_triggers} indicadores de riesgo predefinidos.")
        else:
            partes.append(f"fue clasificada como **'{clasificacion}'**.")
        
        # Triggers específicos
        if triggers:
            triggers_humanos = []
            for t in triggers[:3]:
                if t.startswith("guardrail_"):
                    triggers_humanos.append("excede umbral normativo")
                elif t.startswith("inusual_"):
                    triggers_humanos.append(t.replace("inusual_", "").replace("_", " "))
                elif t == "sector_riesgo":
                    triggers_humanos.append("sector de alto riesgo")
            
            if triggers_humanos:
                partes.append(f"\n\n**Indicadores detectados:** {', '.join(triggers_humanos)}.")
        
        return " ".join(partes)
    
    def _generar_razones(self, triggers: List[str], fue_corregido: bool) -> List[str]:
        """Genera lista de razones human-readable"""
        
        if fue_corregido:
            return ["Umbral normativo LFPIORPI"]
        
        razones = []
        for t in triggers[:5]:  # Top 5
            if t.startswith("guardrail_"):
                razones.append("Umbral normativo LFPIORPI")
            elif t.startswith("inusual_"):
                razones.append(t.replace("inusual_", "").replace("_", " ").title())
            elif t == "sector_riesgo":
                razones.append("Sector alto riesgo")
            else:
                razones.append(t.replace("_", " ").title())
        
        return razones if razones else ["Patrón ML detectado"]
    
    def _generar_flags_revision(
        self, 
        clasificacion: str,
        score_confianza: float,
        triggers: List[str],
        row: pd.Series
    ) -> Dict[str, Any]:
        """
        Genera flags de revisión manual y alertas
        
        Criterios:
        - Revisión manual: baja confianza, múltiples triggers sin confirmación ML
        - Reclasificación: triggers indican inusual pero ML dice relevante
        """
        
        flags = {
            "requiere_revision_manual": False,
            "sugerir_reclasificacion": False,
            "alertas": []
        }
        
        # 1. Baja confianza
        if score_confianza < self.umbral_confianza_bajo:
            flags["requiere_revision_manual"] = True
            flags["alertas"].append({
                "tipo": "baja_confianza",
                "severidad": "warning",
                "mensaje": f"Confianza del modelo baja ({score_confianza:.1%}). Se recomienda revisión manual."
            })
        
        # 2. Múltiples triggers pero clasificación baja
        triggers_inusuales = [t for t in triggers if t.startswith("inusual_")]
        if len(triggers_inusuales) >= 2 and clasificacion == "relevante":
            flags["sugerir_reclasificacion"] = True
            flags["alertas"].append({
                "tipo": "sugerir_reclasificacion",
                "severidad": "info",
                "mensaje": f"Se detectaron {len(triggers_inusuales)} indicadores de riesgo. Considere reclasificar como 'inusual'.",
                "de": "relevante",
                "a": "inusual"
            })
        
        # 3. Efectivo alto sin ser preocupante
        if row.get('EsEfectivo', 0) == 1 and row.get('monto', 0) > 100000 and clasificacion != "preocupante":
            flags["alertas"].append({
                "tipo": "efectivo_alto",
                "severidad": "info",
                "mensaje": f"Operación en efectivo de ${row['monto']:,.2f}. Verificar documentación."
            })
        
        # 4. Internacional sin contexto
        if row.get('EsInternacional', 0) == 1:
            flags["alertas"].append({
                "tipo": "internacional",
                "severidad": "info",
                "mensaje": "Operación internacional. Validar país de origen/destino."
            })
        
        # 5. Primera operación alta
        if row.get('ops_6m', 1) == 1 and row.get('monto', 0) > 50000:
            flags["alertas"].append({
                "tipo": "primera_operacion_alta",
                "severidad": "warning",
                "mensaje": "Primera operación del cliente con monto significativo. Revisar KYC."
            })
        
        return flags
    
    def _generar_contexto_regulatorio(self, fraccion: str, monto: float) -> str:
        """Genera contexto regulatorio según la fracción"""
        
        UMA = 113.14
        
        contextos = {
            "XI_joyeria": {
                "nombre": "Fracción XI - Joyería, Piedras Preciosas y Metales",
                "umbral_aviso": 3210 * UMA,
                "umbral_efectivo": 3210 * UMA,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables"
            },
            "VIII_vehiculos": {
                "nombre": "Fracción VIII - Comercialización de Vehículos",
                "umbral_aviso": 6420 * UMA,
                "umbral_efectivo": 3210 * UMA,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables"
            },
            "V_inmuebles": {
                "nombre": "Fracción V - Inmuebles",
                "umbral_aviso": 8025 * UMA,
                "umbral_efectivo": 8025 * UMA,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables"
            },
            "XVI_activos_virtuales": {
                "nombre": "Fracción XVI - Activos Virtuales",
                "umbral_aviso": 210 * UMA,
                "umbral_efectivo": None,
                "normativa": "Artículo 17 LFPIORPI - Actividades Vulnerables (2024)"
            }
        }
        
        if fraccion not in contextos:
            return "Actividad no regulada específicamente como Actividad Vulnerable."
        
        ctx = contextos[fraccion]
        umbral_aviso = ctx["umbral_aviso"]
        
        partes = [
            f"**{ctx['nombre']}**",
            f"\nUmbral de aviso: ${umbral_aviso:,.2f} MXN ({int(umbral_aviso/UMA)} UMA)"
        ]
        
        if ctx["umbral_efectivo"]:
            partes.append(f"\nLímite efectivo: ${ctx['umbral_efectivo']:,.2f} MXN ({int(ctx['umbral_efectivo']/UMA)} UMA)")
        
        partes.append(f"\nBase legal: {ctx['normativa']}")
        
        if monto >= umbral_aviso:
            partes.append(f"\n\n⚠️ Esta transacción **SUPERA** el umbral de aviso.")
        else:
            porcentaje = (monto / umbral_aviso) * 100
            partes.append(f"\n\nMonto representa el {porcentaje:.1f}% del umbral de aviso.")
        
        return "".join(partes)
    
    def _generar_acciones_sugeridas(
        self,
        clasificacion: str,
        origen: str,
        flags: Dict[str, Any],
        row: pd.Series
    ) -> List[str]:
        """Genera lista de acciones sugeridas para el analista"""
        
        acciones = []
        
        if clasificacion == "preocupante":
            acciones.append("📤 Preparar aviso a UIF (obligatorio)")
            acciones.append("🔍 Verificar documentación soporte completa")
            acciones.append("👤 Validar identidad del cliente y beneficiario final")
            
            if row.get('EsEfectivo', 0) == 1:
                acciones.append("💵 Documentar origen de efectivo")
        
        elif clasificacion == "inusual":
            acciones.append("📋 Documentar operación en expediente")
            acciones.append("🔍 Revisar perfil transaccional del cliente")
            acciones.append("⏰ Monitorear operaciones subsecuentes (30 días)")
        
        if flags.get("requiere_revision_manual"):
            acciones.append("👁️ **REVISIÓN MANUAL OBLIGATORIA** - Baja confianza del modelo")
        
        if flags.get("sugerir_reclasificacion"):
            acciones.append("⚠️ Considerar reclasificación a nivel superior")
        
        if row.get('EsInternacional', 0) == 1:
            acciones.append("🌍 Validar país de origen/destino en listas de países de alto riesgo")
        
        if row.get('ops_6m', 1) == 1:
            acciones.append("📝 Revisar expediente KYC del cliente")
        
        return acciones if acciones else ["✅ No se requieren acciones adicionales"]


# =====================================================
# EJEMPLO DE USO EN PORTAL
# =====================================================

def enriquecer_para_portal(df: pd.DataFrame, probabilidades_dict: Dict = None) -> pd.DataFrame:
    """
    Enriquece DataFrame con metadata de explicabilidad para mostrar en portal
    
    Args:
        df: DataFrame con resultados del modelo
        probabilidades_dict: {index: {clase: probabilidad}} (opcional)
    
    Returns:
        DataFrame con columnas adicionales para el portal
    """
    
    explainer = TransactionExplainer(umbral_confianza_bajo=0.65)
    
    metadata_list = []
    
    for idx, row in df.iterrows():
        # Obtener probabilidades si existen
        probas = probabilidades_dict.get(idx) if probabilidades_dict else None
        
        # Obtener triggers (desde columna razones o recalcular)
        razones_str = str(row.get('razones', ''))
        triggers = razones_str.split('; ') if razones_str else []
        
        # Generar explicación
        metadata = explainer.explicar_transaccion(row, probas, triggers)
        metadata_list.append(metadata)
    
    # Agregar columnas al DataFrame
    df['score_confianza'] = [m['score_confianza'] for m in metadata_list]
    df['nivel_confianza'] = [m['nivel_confianza'] for m in metadata_list]
    df['explicacion_principal'] = [m['explicacion_principal'] for m in metadata_list]
    df['requiere_revision_manual'] = [m['flags']['requiere_revision_manual'] for m in metadata_list]
    df['sugerir_reclasificacion'] = [m['flags']['sugerir_reclasificacion'] for m in metadata_list]
    df['num_alertas'] = [len(m['flags']['alertas']) for m in metadata_list]
    
    # Guardar metadata completa en JSON para frontend
    df['metadata_json'] = [metadata_list[i] for i in range(len(metadata_list))]
    
    return df


if __name__ == "__main__":
    # Test
    import json
    
    # Cargar ejemplo
    df_test = pd.DataFrame({
        'cliente_id': ['CLT001'],
        'monto': [120000],
        'clasificacion': ['relevante'],
        'origen': ['ml'],
        'fue_corregido_por_guardrail': [False],
        'tipo_operacion': ['transferencia_nacional'],
        'sector_actividad': ['joyeria_metales'],
        'fraccion': ['XI_joyeria'],
        'EsEfectivo': [0],
        'EsInternacional': [0],
        'es_nocturno': [1],
        'fin_de_semana': [0],
        'ops_6m': [1],
        'razones': ['Nocturno Finsemana Alto']
    })
    
    explainer = TransactionExplainer()
    
    metadata = explainer.explicar_transaccion(
        df_test.iloc[0],
        probabilidades={'relevante': 0.68, 'inusual': 0.25, 'preocupante': 0.07},
        triggers=['inusual_nocturno_finsemana_alto', 'inusual_monto_alto']
    )
    
    print("="*70)
    print("🧪 EJEMPLO DE EXPLICACIÓN COMPLETA")
    print("="*70)
    print(json.dumps(metadata, indent=2, ensure_ascii=False))
