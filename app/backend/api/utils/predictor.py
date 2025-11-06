#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
predictor.py - Predictor de Producción TarantulaHawk
Carga modelos entrenados y realiza inferencia en tiempo real

Uso:
    from predictor import TarantulaHawkPredictor
    
    predictor = TarantulaHawkPredictor()
    predictions, probas = predictor.predict(df_enriched)
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, Dict, Any

class TarantulaHawkPredictor:
    """
    Predictor de producción para clasificación AML/PLD
    
    Carga modelos entrenados y aplica:
    1. Modelo supervisado (ensemble)
    2. Thresholds optimizados (refuerzo)
    3. Guardrails LFPIORPI (reglas normativas)
    """
    
    def __init__(
        self, 
        base_dir: str = None,
        config_path: str = None,
        verbose: bool = True
    ):
        """
        Inicializa predictor cargando modelos
        
        Args:
            base_dir: Directorio base (default: auto-detecta)
            config_path: Ruta al config (default: models/config_modelos.json)
            verbose: Imprimir logs de carga
        """
        self.verbose = verbose
        
        # Detectar directorios
        if base_dir is None:
            # Asume estructura: app/backend/api/predictor.py
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
            print("🤖 TarantulaHawk Predictor - Inicializando...")
        
        # Cargar modelos
        self._load_models()
        
        if self.verbose:
            print("✅ Predictor listo para inferencia\n")
    
    def _load_models(self):
        """Carga todos los modelos necesarios"""
        
        # 1. Modelo Supervisado (CRÍTICO)
        sup_path = self.outputs_dir / "modelo_ensemble_stack_v2.pkl"
        if not sup_path.exists():
            # Fallback a V1
            sup_path = self.outputs_dir / "modelo_ensemble_stack.pkl"
        
        if not sup_path.exists():
            raise FileNotFoundError(f"❌ No se encontró modelo supervisado en {sup_path}")
        
        self.bundle_sup = joblib.load(sup_path)
        self.model = self.bundle_sup["model"]
        self.scaler = self.bundle_sup["scaler"]
        self.columns = self.bundle_sup["columns"]
        
        if self.verbose:
            print(f"   ✅ Modelo supervisado: {sup_path.name}")
        
        # 2. Thresholds - SIEMPRE usar config_modelos.json como fuente de verdad
        self.thresholds = {
            "preocupante": float(self.config["modelos"]["ensemble"]["threshold_preocupante"]),
            "inusual": float(self.config["modelos"]["ensemble"]["threshold_inusual"])
        }
        if self.verbose:
            print(f"   ✅ Thresholds (config): p={self.thresholds['preocupante']}, i={self.thresholds['inusual']}")
        
        # 3. Modelo de Refuerzo (OPCIONAL - solo para Q-table si se necesita)
        rl_path = self.outputs_dir / "refuerzo_bundle_v2.pkl"
        if rl_path.exists():
            self.bundle_rl = joblib.load(rl_path)
            if self.verbose:
                print(f"   ✅ Modelo de refuerzo cargado (Q-table disponible)")
        else:
            self.bundle_rl = None
        
        # 4. Modelo No Supervisado (OPCIONAL)
        ns_path = self.outputs_dir / "no_supervisado_bundle_v2.pkl"
        if ns_path.exists():
            self.bundle_ns = joblib.load(ns_path)
            if self.verbose:
                print(f"   ✅ Modelo no supervisado: {ns_path.name}")
        else:
            self.bundle_ns = None
            if self.verbose:
                print("   ⚠️ Modelo no supervisado no disponible (opcional)")
    
    def predict(
        self, 
        df: pd.DataFrame,
        return_probas: bool = True,
        return_scores: bool = False
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predice clasificación AML/PLD para transacciones enriquecidas
        
        Args:
            df: DataFrame enriquecido (output de validador_enriquecedor_v2.py)
                Debe tener 25 columnas (SIN clasificacion_lfpiorpi)
            return_probas: Devolver probabilidades del modelo
            return_scores: Devolver scores adicionales (anomalía, etc)
        
        Returns:
            predictions: Array de clasificaciones ["preocupante", "inusual", "relevante"]
            probas: Matriz de probabilidades (n_samples, 3) si return_probas=True
        """
        
        if len(df) == 0:
            raise ValueError("DataFrame vacío")
        
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
        
        # Aplicar guardrails LFPIORPI (reglas duras)
        predictions, guardrails_info = self._apply_guardrails(df, predictions)
        
        if self.verbose and guardrails_info["corrections"] > 0:
            print(f"   🛡️ Guardrails: {guardrails_info['corrections']} correcciones aplicadas")
        
        # Calcular anomaly scores si disponible
        scores = None
        if return_scores and self.bundle_ns is not None:
            scores = self._calculate_anomaly_scores(X_scaled)
        
        # Devolver resultados
        if return_scores and scores is not None:
            return predictions, probas, scores
        elif return_probas:
            return predictions, probas
        else:
            return predictions
    
    def _prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepara features para el modelo
        - Drop columnas no predictivas
        - One-hot encoding
        - Alinear con columnas de entrenamiento
        - Sanitizar NaN/Inf
        """
        X = df.copy()
        
        # Remover columnas no predictivas
        drop_cols = ["cliente_id", "fecha", "fecha_dt", "clasificacion_lfpiorpi"]
        X = X.drop(columns=[c for c in drop_cols if c in X.columns], errors="ignore")
        
        # One-hot encoding (mismo orden que entrenamiento)
        cat_cols = [c for c in ["tipo_operacion", "sector_actividad", "fraccion"] if c in X.columns]
        if cat_cols:
            X = pd.get_dummies(X, columns=cat_cols, drop_first=True, dtype=float)
        
        # Alinear con columnas de entrenamiento
        X = X.reindex(columns=self.columns, fill_value=0)
        
        # Sanitizar
        X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
        
        return X
    
    def _apply_guardrails(
        self, 
        df: pd.DataFrame, 
        predictions: np.ndarray
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Aplica reglas duras LFPIORPI
        
        Reglas:
        1. monto >= umbral_aviso(fracción) → preocupante
        2. es_efectivo=1 AND monto >= limite_efectivo(fracción) → preocupante
        3. monto_6m >= umbral_aviso(fracción) → preocupante
        """
        
        predictions = predictions.copy()
        
        # Cargar parámetros LFPIORPI
        law = self.config.get("lfpiorpi", {})
        UMA = float(law.get("uma_diaria", 113.14))
        umbrales = law.get("umbrales", {})
        
        # Extraer columnas necesarias
        fraccion = df.get("fraccion", pd.Series(["_"] * len(df))).astype(str).to_numpy()
        monto = df.get("monto", pd.Series([0.0] * len(df))).astype(float).to_numpy()
        es_efectivo = df.get("EsEfectivo", pd.Series([0] * len(df))).astype(int).to_numpy()
        monto_6m = df.get("monto_6m", pd.Series([0.0] * len(df))).astype(float).to_numpy()
        
        # Calcular umbrales por transacción
        def get_umbral_mxn(frac: str, key: str) -> float:
            """Convierte UMA a MXN para una fracción específica"""
            u = umbrales.get(frac, {})
            uma_val = u.get(key, None)
            if uma_val is None:
                return 1e12  # Umbral infinito si no aplica
            try:
                return float(UMA) * float(uma_val)
            except Exception:
                return 1e12
        
        # Vectorizar cálculo de umbrales
        umbral_aviso = np.array([get_umbral_mxn(f, "aviso_UMA") for f in fraccion])
        umbral_efectivo = np.array([get_umbral_mxn(f, "efectivo_max_UMA") for f in fraccion])
        
        # Aplicar reglas
        mask_preocupante = (
            (monto >= umbral_aviso) |  # Regla 1
            ((es_efectivo == 1) & (monto >= umbral_efectivo)) |  # Regla 2
            ((monto < umbral_aviso) & (monto_6m >= umbral_aviso))  # Regla 3: acumulación
        )
        
        # Contar correcciones
        corrections = int(np.sum((predictions != "preocupante") & mask_preocupante))
        
        # Aplicar correcciones
        predictions[mask_preocupante] = "preocupante"
        
        guardrails_info = {
            "corrections": corrections,
            "total_flagged": int(mask_preocupante.sum()),
            "by_monto": int((monto >= umbral_aviso).sum()),
            "by_efectivo": int(((es_efectivo == 1) & (monto >= umbral_efectivo)).sum()),
            "by_acumulacion": int(((monto < umbral_aviso) & (monto_6m >= umbral_aviso)).sum())
        }
        
        return predictions, guardrails_info
    
    def _calculate_anomaly_scores(self, X_scaled: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Calcula scores de anomalía usando modelo no supervisado
        """
        if self.bundle_ns is None:
            return None
        
        iso_model = self.bundle_ns.get("isolation_forest")
        kmeans_model = self.bundle_ns.get("kmeans")
        
        scores = {}
        
        if iso_model is not None:
            scores["anomaly_score_iso"] = iso_model.decision_function(X_scaled)
            scores["is_outlier_iso"] = (iso_model.predict(X_scaled) == -1).astype(int)
        
        if kmeans_model is not None:
            scores["cluster_id"] = kmeans_model.predict(X_scaled)
            centers = kmeans_model.cluster_centers_
            distances = np.min(
                [np.linalg.norm(X_scaled - center, axis=1) for center in centers],
                axis=0
            )
            scores["dist_to_cluster"] = distances
        
        return scores
    
    def predict_batch(
        self,
        df: pd.DataFrame,
        batch_size: int = 1000
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predicción en batches para datasets grandes
        
        Args:
            df: DataFrame completo
            batch_size: Tamaño de batch
        
        Returns:
            predictions: Array completo de predicciones
            probas: Matriz completa de probabilidades
        """
        n_samples = len(df)
        n_batches = (n_samples + batch_size - 1) // batch_size
        
        all_predictions = []
        all_probas = []
        
        if self.verbose:
            print(f"🔄 Procesando {n_samples:,} transacciones en {n_batches} batches...")
        
        for i in range(n_batches):
            start_idx = i * batch_size
            end_idx = min((i + 1) * batch_size, n_samples)
            
            batch_df = df.iloc[start_idx:end_idx]
            preds, probas = self.predict(batch_df, return_probas=True)
            
            all_predictions.append(preds)
            all_probas.append(probas)
            
            if self.verbose and (i + 1) % 10 == 0:
                print(f"   Batch {i+1}/{n_batches} completado")
        
        predictions = np.concatenate(all_predictions)
        probas = np.vstack(all_probas)
        
        if self.verbose:
            print(f"✅ Predicción batch completada: {n_samples:,} transacciones")
        
        return predictions, probas
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Retorna información del modelo cargado
        """
        info = {
            "model_type": type(self.model).__name__,
            "n_features": len(self.columns),
            "classes": self.model.classes_.tolist(),
            "thresholds": self.thresholds,
            "config_version": self.config.get("modelos", {}).get("version", "unknown"),
            "has_unsupervised": self.bundle_ns is not None
        }
        
        return info


# =============================================================================
# EJEMPLO DE USO
# =============================================================================

if __name__ == "__main__":
    """
    Ejemplo de uso del predictor
    """
    import pandas as pd
    
    print("="*70)
    print("🧪 TEST: TarantulaHawk Predictor")
    print("="*70)
    
    # Inicializar predictor
    predictor = TarantulaHawkPredictor(verbose=True)
    
    # Info del modelo
    info = predictor.get_model_info()
    print("\n📊 Información del modelo:")
    for key, val in info.items():
        print(f"   {key}: {val}")
    
    # Cargar dataset de prueba
    try:
        test_data_path = predictor.base_dir / "uploads" / "enriched" / "dataset_pld_lfpiorpi_1500_enriched_v2.csv"
        
        if test_data_path.exists():
            df_test = pd.read_csv(test_data_path)
            
            # Remover clasificacion si existe (simular producción)
            if "clasificacion_lfpiorpi" in df_test.columns:
                y_true = df_test["clasificacion_lfpiorpi"].copy()
                df_test = df_test.drop(columns=["clasificacion_lfpiorpi"])
            else:
                y_true = None
            
            print(f"\n🔍 Prediciendo {len(df_test):,} transacciones...")
            
            # Predecir
            predictions, probas = predictor.predict(df_test, return_probas=True)
            
            print(f"\n✅ Predicción completada")
            print(f"   Distribución:")
            from collections import Counter
            dist = Counter(predictions)
            for clase, count in dist.items():
                print(f"      {clase}: {count:,} ({count/len(predictions)*100:.1f}%)")
            
            # Si tenemos ground truth, calcular accuracy
            if y_true is not None:
                from sklearn.metrics import accuracy_score, classification_report
                acc = accuracy_score(y_true, predictions)
                print(f"\n🎯 Accuracy vs ground truth: {acc:.4f} ({acc*100:.2f}%)")
                print("\n" + classification_report(y_true, predictions))
            
        else:
            print(f"\n⚠️ No se encontró dataset de prueba en {test_data_path}")
            print("   Genera uno con: python generators/generar_dataset_pld_mexico_prod_lfpiorpi.py 1500 random")
    
    except Exception as e:
        print(f"\n❌ Error en test: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "="*70)
    print("✅ Test completado")
    print("="*70)
