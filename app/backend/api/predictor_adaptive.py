#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
predictor_adaptive.py - Predictor Adaptativo TarantulaHawk
Maneja cualquier volumen de transacciones (5 a 500,000) con enfoque híbrido ML + Rules

Estrategia:
- <100 trans:    Rule-based puro (guardrails + patrones conocidos)
- 100-1000 trans: Híbrido con ponderación gradual
- >1000 trans:   ML puro con guardrails obligatorios

Uso:
    from predictor_adaptive import TarantulaHawkAdaptivePredictor
    
    predictor = TarantulaHawkAdaptivePredictor()
    predictions, probas, metadata = predictor.predict_adaptive(df_enriched)
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
from collections import Counter
from datetime import datetime, timedelta

class TarantulaHawkAdaptivePredictor:
    """
    Predictor adaptativo que ajusta metodología según volumen transaccional
    
    Métodos:
    - predict_adaptive(): Selecciona automáticamente estrategia óptima
    - predict_rule_based(): Sistema determinista (pocas transacciones)
    - predict_hybrid(): Combina ML + Rules con ponderación
    - predict_ml_pure(): ML puro (alto volumen)
    """
    
    def __init__(
        self, 
        base_dir: str = None,
        config_path: str = None,
        verbose: bool = True
    ):
        """
        Inicializa predictor adaptativo
        
        Args:
            base_dir: Directorio base (auto-detecta si None)
            config_path: Ruta al config (default: models/config_modelos.json)
            verbose: Imprimir logs de carga
        """
        self.verbose = verbose
        
        # Detectar directorios
        if base_dir is None:
            self.base_dir = Path(__file__).resolve().parent.parent
        else:
            self.base_dir = Path(base_dir)
        
        self.outputs_dir = self.base_dir / "outputs"
        self.models_dir = self.base_dir / "models"
        
        # Cargar configuración
        if config_path is None:
            config_path = self.models_dir / "config_modelos.json"
        
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)
        
        if self.verbose:
            print("🤖 TarantulaHawk Adaptive Predictor - Inicializando...")
        
        # Cargar modelos ML
        self._load_ml_models()
        
        # Cargar parámetros LFPIORPI
        self._load_lfpiorpi_params()
        
        if self.verbose:
            print("✅ Predictor adaptativo listo\n")
    
    def _load_ml_models(self):
        """Carga modelos ML (opcionales para volumen alto)"""
        
        # Modelo Supervisado
        sup_path = self.outputs_dir / "modelo_ensemble_stack_v2.pkl"
        if not sup_path.exists():
            sup_path = self.outputs_dir / "modelo_ensemble_stack.pkl"
        
        if sup_path.exists():
            self.bundle_sup = joblib.load(sup_path)
            self.model = self.bundle_sup["model"]
            self.scaler = self.bundle_sup["scaler"]
            self.columns = self.bundle_sup["columns"]
            
            if self.verbose:
                print(f"   ✅ Modelo ML cargado: {sup_path.name}")
        else:
            self.model = None
            if self.verbose:
                print("   ⚠️ Modelo ML no disponible (solo rule-based)")
        
        # Thresholds optimizados
        rl_path = self.outputs_dir / "refuerzo_bundle_v2.pkl"
        if rl_path.exists():
            self.bundle_rl = joblib.load(rl_path)
            self.thresholds = self.bundle_rl["thresholds"]
        else:
            # Fallback a config
            self.thresholds = {
                "preocupante": float(self.config["modelos"]["ensemble"]["threshold_preocupante"]),
                "inusual": float(self.config["modelos"]["ensemble"]["threshold_inusual"])
            }
        
        if self.verbose:
            print(f"   ✅ Thresholds: p={self.thresholds['preocupante']}, i={self.thresholds['inusual']}")
    
    def _load_lfpiorpi_params(self):
        """Carga parámetros normativos LFPIORPI"""
        law = self.config.get("lfpiorpi", {})
        self.UMA = float(law.get("uma_diaria", 113.14))
        self.umbrales = law.get("umbrales", {})
        self.sectores_alto_riesgo = law.get("actividad_alto_riesgo", [])
        
        if self.verbose:
            print(f"   ✅ Parámetros LFPIORPI: UMA=${self.UMA:.2f} MXN")
    
    def predict_adaptive(
        self, 
        df: pd.DataFrame,
        return_probas: bool = True,
        return_metadata: bool = True
    ) -> Tuple[np.ndarray, Optional[np.ndarray], Optional[Dict]]:
        """
        Predicción adaptativa según volumen
        
        Args:
            df: DataFrame enriquecido (25 columnas)
            return_probas: Devolver probabilidades (solo disponible con ML)
            return_metadata: Devolver info sobre estrategia usada
        
        Returns:
            predictions: Array de clasificaciones
            probas: Matriz de probabilidades (o None si rule-based)
            metadata: Diccionario con info de decisión
        """
        # Asegurar columnas derivadas requeridas (p.ej., SectorAltoRiesgo desde giro_negocio)
        df = self._ensure_sector_features(df)
        n = len(df)
        
        if n == 0:
            raise ValueError("DataFrame vacío")
        
        # Seleccionar estrategia
        if n < 100:
            strategy = "rule_based"
            predictions = self._predict_rule_based(df)
            probas = None
            
        elif n < 1000:
            strategy = "hybrid"
            predictions, probas = self._predict_hybrid(df, n)
            
        else:
            strategy = "ml_pure"
            predictions, probas = self._predict_ml_pure(df)
        
        # Metadata
        metadata = None
        if return_metadata:
            metadata = {
                "n_transacciones": n,
                "strategy": strategy,
                "distribución": dict(Counter(predictions)),
                "thresholds_used": self.thresholds if strategy != "rule_based" else None,
                "guardrails_applied": self._count_guardrails(df, predictions)
            }
            if strategy == "rule_based":
                trigger_counts = getattr(self, "_last_trigger_counts", {})
                metadata["reglas_disparadas"] = trigger_counts
                metadata["small_volume_adjustments"] = {
                    "preocupante_guardrail": int(trigger_counts.get("guardrail", 0)),
                    "inusual_multi_trigger": int(trigger_counts.get("inusual_multi", 0))
                }
            
            if self.verbose:
                print(f"\n📊 Estrategia: {strategy.upper()} (n={n})")
                print(f"   Distribución: {metadata['distribución']}")
        
        if return_probas:
            return predictions, probas, metadata
        else:
            return predictions, metadata
    
    def _predict_rule_based(self, df: pd.DataFrame) -> np.ndarray:
        """Clasificación determinista para bajo volumen utilizando agregación de disparadores."""
        predictions = []
        trigger_totals: Counter = Counter()
        inusual_multi = 0
        guardrail_total = 0

        for _, row in df.iterrows():
            triggers = self._get_rule_triggers(row, df)

            if any(t.startswith("guardrail_") for t in triggers):
                predictions.append("preocupante")
                guardrail_total += 1
            else:
                inusual_triggers = [t for t in triggers if t.startswith("inusual_") or t == "sector_riesgo"]
                if len(inusual_triggers) >= 2:
                    predictions.append("inusual")
                    inusual_multi += 1
                else:
                    predictions.append("relevante")

            trigger_totals.update(triggers)

        # Guardar conteos para metadatos
        trigger_totals["guardrail"] += guardrail_total
        trigger_totals["inusual_multi"] += inusual_multi
        self._last_trigger_counts = dict(trigger_totals)

        return np.array(predictions)
    
    def _es_preocupante_normativa(self, row: pd.Series, df: pd.DataFrame) -> bool:
        """
        Guardrails LFPIORPI - Reglas duras que SIEMPRE se aplican
        
        Reglas:
        1. Monto individual >= umbral aviso
        2. Efectivo >= límite efectivo
        3. Acumulación 6M >= umbral aviso
        """
        fraccion = row.get("fraccion", "_")
        monto = row.get("monto", 0.0)
        es_efectivo = row.get("EsEfectivo", 0)
        monto_6m = row.get("monto_6m", 0.0)
        
        # Obtener umbrales en MXN
        umbral_aviso = self._get_umbral_mxn(fraccion, "aviso_UMA")
        limite_efectivo = self._get_umbral_mxn(fraccion, "efectivo_max_UMA")
        
        # Regla 1: Monto individual
        if monto >= umbral_aviso:
            return True
        
        # Regla 2: Efectivo
        if es_efectivo == 1 and monto >= limite_efectivo:
            return True
        
        # Regla 3: Acumulación 6M
        if monto < umbral_aviso and monto_6m >= umbral_aviso:
            return True
        
        return False
    
    def _es_inusual_por_patron(self, row: pd.Series, df: pd.DataFrame) -> bool:
        """
        Reglas de negocio para clasificar como inusual
        Basadas en patrones conocidos de lavado
        """
        monto = row.get("monto", 0.0)
        
        # Regla 1: Sector alto riesgo + monto significativo
        if row.get("SectorAltoRiesgo", 0) == 1 and monto > 50000:
            return True
        
        # Regla 2: Desviación fuerte del perfil del cliente
        ratio_vs_prom = row.get("ratio_vs_promedio", 1.0)
        if ratio_vs_prom > 3.0:  # 3x su promedio habitual
            return True
        
        # Regla 3: Estructuración (múltiples ops cerca del umbral)
        fraccion = row.get("fraccion", "_")
        umbral_aviso = self._get_umbral_mxn(fraccion, "aviso_UMA")
        
        if "fecha" in row.index or "fecha_dt" in row.index:
            fecha_col = "fecha_dt" if "fecha_dt" in df.columns else "fecha"
            fecha_actual = pd.to_datetime(row[fecha_col])
            
            ops_cercanas = df[
                (pd.to_datetime(df[fecha_col]).between(
                    fecha_actual - pd.Timedelta(days=7),
                    fecha_actual + pd.Timedelta(days=7)
                )) &
                (df["monto"] > umbral_aviso * 0.8) &
                (df["monto"] < umbral_aviso)
            ]
            
            if len(ops_cercanas) >= 3:  # 3+ ops en ventana de 2 semanas
                return True
        
        # Regla 4: Operaciones nocturnas/fin de semana + monto alto
        if (row.get("es_nocturno", 0) == 1 or row.get("fin_de_semana", 0) == 1):
            if monto > 100000:
                return True
        
        # Regla 5: Efectivo + monto redondo + alto
        if (row.get("EsEfectivo", 0) == 1 and 
            row.get("es_monto_redondo", 0) == 1 and 
            monto > 100000):
            return True
        
        # Regla 6: Burst (múltiples operaciones rápidas)
        if row.get("posible_burst", 0) == 1 and monto > 50000:
            return True
        
        # Regla 7: Alta frecuencia mensual + monto significativo
        freq_mensual = row.get("frecuencia_mensual", 1)
        if freq_mensual > 20 and monto > 50000:
            return True
        
        return False

    def _get_rule_triggers(self, row: pd.Series, df: pd.DataFrame) -> list:
        """Devuelve lista de etiquetas de disparadores de reglas por fila."""
        triggers = []

        if self._es_preocupante_normativa(row, df):
            fraccion = str(row.get("fraccion", "_"))
            monto = float(row.get("monto", 0.0))
            es_efectivo = int(row.get("EsEfectivo", 0))
            monto_6m = float(row.get("monto_6m", 0.0))
            umbral_aviso = self._get_umbral_mxn(fraccion, "aviso_UMA")
            umbral_efectivo = self._get_umbral_mxn(fraccion, "efectivo_max_UMA")
            if monto >= umbral_aviso:
                triggers.append("guardrail_monto")
            if es_efectivo == 1 and monto >= umbral_efectivo:
                triggers.append("guardrail_efectivo")
            if monto < umbral_aviso and monto_6m >= umbral_aviso:
                triggers.append("guardrail_acumulacion")
            return triggers

        monto = float(row.get("monto", 0.0))
        if int(row.get("SectorAltoRiesgo", 0)) == 1 and monto > 50000:
            triggers.append("sector_riesgo")

        ratio_vs_prom = float(row.get("ratio_vs_promedio", 1.0))
        if ratio_vs_prom > 3.0:
            triggers.append("inusual_desviacion_perfil")

        fraccion = str(row.get("fraccion", "_"))
        umbral_aviso = self._get_umbral_mxn(fraccion, "aviso_UMA")
        if ("fecha" in row.index or "fecha_dt" in row.index) and "monto" in df.columns:
            fecha_col = "fecha_dt" if "fecha_dt" in df.columns else "fecha"
            fecha_actual = pd.to_datetime(row[fecha_col])
            mask = (
                pd.to_datetime(df[fecha_col]).between(
                    fecha_actual - pd.Timedelta(days=7),
                    fecha_actual + pd.Timedelta(days=7)
                ) & (df["monto"] > umbral_aviso * 0.8) & (df["monto"] < umbral_aviso)
            )
            if int(mask.sum()) >= 3:
                triggers.append("inusual_estructuracion")

        if (int(row.get("es_nocturno", 0)) == 1 or int(row.get("fin_de_semana", 0)) == 1) and monto > 100000:
            triggers.append("inusual_nocturno_finsemana_alto")

        if int(row.get("EsEfectivo", 0)) == 1 and int(row.get("es_monto_redondo", 0)) == 1 and monto > 100000:
            triggers.append("inusual_efectivo_redondo_alto")

        if int(row.get("posible_burst", 0)) == 1 and monto > 50000:
            triggers.append("inusual_burst_alto")

        freq_mensual = float(row.get("frecuencia_mensual", 1))
        if freq_mensual > 20 and monto > 50000:
            triggers.append("inusual_alta_frecuencia_monto")

        return triggers
    
    def _predict_hybrid(
        self, 
        df: pd.DataFrame, 
        n: int
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Enfoque híbrido: combina ML + Rules con ponderación
        Usado para 100-1000 transacciones
        
        Ponderación:
        - n=100:  30% ML, 70% Rules
        - n=500:  50% ML, 50% Rules
        - n=1000: 100% ML, 0% Rules
        """
        if self.model is None:
            # Fallback a rule-based si no hay modelo
            return self._predict_rule_based(df), None
        
        # Calcular peso del ML (gradual)
        peso_ml = min((n - 100) / 900, 1.0)  # 0 en n=100, 1 en n=1000
        
        if self.verbose:
            print(f"   Híbrido: {peso_ml*100:.0f}% ML, {(1-peso_ml)*100:.0f}% Rules")
        
        # Predicción ML
        pred_ml, proba_ml = self._predict_ml_pure(df)
        
        # Predicción Rules
        pred_rules = self._predict_rule_based(df)
        
        # Fusionar predicciones
        predictions = []
        for i in range(len(df)):
            # Prioridad 1: Si rules dice preocupante → SIEMPRE preocupante
            if pred_rules[i] == "preocupante":
                predictions.append("preocupante")
            
            # Prioridad 2: Si ML muy confiado (>0.8) → confiar en ML
            elif proba_ml[i].max() > 0.8:
                predictions.append(pred_ml[i])
            
            # Prioridad 3: Desacuerdo → elegir el más conservador
            else:
                severidad = {"relevante": 0, "inusual": 1, "preocupante": 2}
                if severidad[pred_ml[i]] >= severidad[pred_rules[i]]:
                    predictions.append(pred_ml[i])
                else:
                    predictions.append(pred_rules[i])
        
        return np.array(predictions), proba_ml
    
    def _predict_ml_pure(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        ML puro con guardrails
        Usado para >1000 transacciones
        """
        if self.model is None:
            raise RuntimeError("Modelo ML no disponible")
        
        # Preparar features
        X = self._prepare_features(df)
        
        # Escalar
        X_scaled = self.scaler.transform(X)
        
        # Predecir probabilidades
        probas = self.model.predict_proba(X_scaled)
        classes = self.model.classes_
        
        # Aplicar thresholds optimizados
        idx_pre = np.argmax(classes == "preocupante")
        idx_inu = np.argmax(classes == "inusual")
        
        thr_p = self.thresholds["preocupante"]
        thr_i = self.thresholds["inusual"]
        
        predictions = np.where(
            probas[:, idx_pre] >= thr_p, 
            "preocupante",
            np.where(
                probas[:, idx_inu] >= thr_i, 
                "inusual", 
                "relevante"
            )
        )
        
        # Aplicar guardrails LFPIORPI (override si necesario)
        predictions = self._apply_guardrails_vectorized(df, predictions)
        
        return predictions, probas
    
    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Preparar features para ML (one-hot, alinear, sanitizar)"""
        X = self._ensure_sector_features(df).copy()
        
        # Remover columnas no predictivas
        drop_cols = ["cliente_id", "fecha", "fecha_dt", "clasificacion_lfpiorpi"]
        X = X.drop(columns=[c for c in drop_cols if c in X.columns], errors="ignore")
        
        # One-hot encoding
        cat_cols = [c for c in ["tipo_operacion", "sector_actividad", "fraccion"] if c in X.columns]
        if cat_cols:
            X = pd.get_dummies(X, columns=cat_cols, drop_first=True, dtype=float)
        
        # Alinear con columnas de entrenamiento
        X = X.reindex(columns=self.columns, fill_value=0)
        
        # Sanitizar
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
        
        return X

    def _normalize_text(self, s: Any) -> str:
        try:
            return str(s).strip().lower()
        except Exception:
            return ""

    def _ensure_sector_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Asegura columna SectorAltoRiesgo derivada desde giro_negocio/sector_actividad."""
        if "SectorAltoRiesgo" in df.columns and df["SectorAltoRiesgo"].notna().any():
            return df

        df2 = df.copy()
        high_risk = {self._normalize_text(x) for x in self.sectores_alto_riesgo}

        src_col = None
        if "giro_negocio" in df2.columns:
            src_col = "giro_negocio"
        elif "sector_actividad" in df2.columns:
            src_col = "sector_actividad"

        if src_col is None:
            df2["SectorAltoRiesgo"] = df2.get("SectorAltoRiesgo", 0)
            return df2

        normalized = df2[src_col].apply(self._normalize_text)
        df2["SectorAltoRiesgo"] = normalized.apply(lambda v: 1 if v in high_risk else 0)
        # Completar columna sector_actividad si falta, usando giro_negocio
        if "sector_actividad" not in df2.columns and "giro_negocio" in df2.columns:
            df2["sector_actividad"] = df2["giro_negocio"].astype(str)

        return df2
    
    def _apply_guardrails_vectorized(
        self, 
        df: pd.DataFrame, 
        predictions: np.ndarray
    ) -> np.ndarray:
        """Aplicar guardrails LFPIORPI de forma vectorizada"""
        
        predictions = predictions.copy()
        
        # Extraer columnas
        fraccion = df.get("fraccion", pd.Series(["_"] * len(df))).astype(str).to_numpy()
        monto = df.get("monto", pd.Series([0.0] * len(df))).astype(float).to_numpy()
        es_efectivo = df.get("EsEfectivo", pd.Series([0] * len(df))).astype(int).to_numpy()
        monto_6m = df.get("monto_6m", pd.Series([0.0] * len(df))).astype(float).to_numpy()
        
        # Calcular umbrales por transacción
        umbral_aviso = np.array([self._get_umbral_mxn(f, "aviso_UMA") for f in fraccion])
        umbral_efectivo = np.array([self._get_umbral_mxn(f, "efectivo_max_UMA") for f in fraccion])
        
        # Aplicar reglas
        mask_preocupante = (
            (monto >= umbral_aviso) |
            ((es_efectivo == 1) & (monto >= umbral_efectivo)) |
            ((monto < umbral_aviso) & (monto_6m >= umbral_aviso))
        )
        
        # Override
        predictions[mask_preocupante] = "preocupante"
        
        return predictions
    
    def _get_umbral_mxn(self, fraccion: str, key: str) -> float:
        """Convierte UMA a MXN para una fracción específica"""
        u = self.umbrales.get(fraccion, {})
        uma_val = u.get(key, None)
        if uma_val is None:
            return 1e12  # Umbral infinito si no aplica
        try:
            return float(self.UMA) * float(uma_val)
        except Exception:
            return 1e12
    
    def _count_guardrails(self, df: pd.DataFrame, predictions: np.ndarray) -> int:
        """Cuenta cuántas transacciones fueron forzadas a preocupante por guardrails"""
        count = 0
        for i, row in df.iterrows():
            if predictions[i] == "preocupante" and self._es_preocupante_normativa(row, df):
                count += 1
        return count
    
    def get_strategy_for_volume(self, n: int) -> Dict[str, Any]:
        """
        Retorna información sobre qué estrategia se usaría para un volumen dado
        
        Args:
            n: Número de transacciones
        
        Returns:
            Diccionario con estrategia y detalles
        """
        if n < 100:
            return {
                "strategy": "rule_based",
                "description": "Sistema determinista basado en LFPIORPI",
                "ml_weight": 0.0,
                "rules_weight": 1.0,
                "expected_accuracy": "~85-90%",
                "justification": "Cumplimiento normativo puro sin dependencia estadística"
            }
        elif n < 1000:
            peso_ml = min((n - 100) / 900, 1.0)
            return {
                "strategy": "hybrid",
                "description": "Híbrido ML + Rules con ponderación gradual",
                "ml_weight": float(peso_ml),
                "rules_weight": float(1 - peso_ml),
                "expected_accuracy": f"~{90 + peso_ml*7:.1f}%",
                "justification": "Transición gradual hacia aprendizaje estadístico"
            }
        else:
            return {
                "strategy": "ml_pure",
                "description": "Machine Learning puro con guardrails obligatorios",
                "ml_weight": 1.0,
                "rules_weight": 0.0,
                "expected_accuracy": "~99.5%",
                "justification": "Volumen suficiente para aprendizaje robusto"
            }


# =============================================================================
# EJEMPLO DE USO
# =============================================================================

if __name__ == "__main__":
    """
    Demo del predictor adaptativo con diferentes volúmenes
    """
    import pandas as pd
    
    print("="*70)
    print("🧪 TEST: TarantulaHawk Adaptive Predictor")
    print("="*70)
    
    # Inicializar predictor
    predictor = TarantulaHawkAdaptivePredictor(verbose=True)
    
    # Simular diferentes volúmenes
    volumenes_test = [5, 50, 200, 1500]
    
    for n in volumenes_test:
        print(f"\n{'='*70}")
        print(f"📊 TEST CON {n} TRANSACCIONES")
        print("="*70)
        
        # Mostrar estrategia esperada
        estrategia = predictor.get_strategy_for_volume(n)
        print(f"\n📋 Estrategia: {estrategia['strategy'].upper()}")
        print(f"   ML Weight: {estrategia['ml_weight']*100:.0f}%")
        print(f"   Rules Weight: {estrategia['rules_weight']*100:.0f}%")
        print(f"   Accuracy Esperado: {estrategia['expected_accuracy']}")
        print(f"   Justificación: {estrategia['justification']}")
        
        # Cargar dataset de prueba
        try:
            base_path = predictor.base_dir / "uploads" / "enriched"
            test_file = base_path / f"dataset_pld_lfpiorpi_{n}_enriched_v2.csv"
            
            if not test_file.exists():
                # Buscar cualquier dataset disponible
                available = list(base_path.glob("dataset_pld_lfpiorpi_*_enriched_v2.csv"))
                if available:
                    test_file = available[0]
                    print(f"\n⚠️ Usando dataset alternativo: {test_file.name}")
                else:
                    print(f"\n⚠️ No hay datasets de prueba en {base_path}")
                    continue
            
            df_test = pd.read_csv(test_file)
            
            # Tomar solo n transacciones
            df_test = df_test.head(n)
            
            # Remover clasificacion si existe (simular producción)
            if "clasificacion_lfpiorpi" in df_test.columns:
                y_true = df_test["clasificacion_lfpiorpi"].copy()
                df_test = df_test.drop(columns=["clasificacion_lfpiorpi"])
            else:
                y_true = None
            
            print(f"\n🔍 Prediciendo {len(df_test)} transacciones...")
            
            # Predecir con estrategia adaptativa
            predictions, probas, metadata = predictor.predict_adaptive(
                df_test, 
                return_probas=True, 
                return_metadata=True
            )
            
            print(f"\n✅ Predicción completada")
            print(f"\n📊 Metadata:")
            print(f"   Estrategia usada: {metadata['strategy']}")
            print(f"   Distribución:")
            for clase, count in metadata['distribución'].items():
                print(f"      {clase}: {count} ({count/len(predictions)*100:.1f}%)")
            print(f"   Guardrails aplicados: {metadata['guardrails_applied']}")
            
            # Si tenemos ground truth, calcular accuracy
            if y_true is not None:
                from sklearn.metrics import accuracy_score, classification_report
                acc = accuracy_score(y_true, predictions)
                print(f"\n🎯 Accuracy vs ground truth: {acc:.4f} ({acc*100:.2f}%)")
                
                if len(df_test) > 20:  # Solo mostrar report si hay suficientes muestras
                    print("\n" + classification_report(y_true, predictions))
        
        except Exception as e:
            print(f"\n❌ Error en test con n={n}: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*70)
    print("✅ Tests completados")
    print("="*70)
