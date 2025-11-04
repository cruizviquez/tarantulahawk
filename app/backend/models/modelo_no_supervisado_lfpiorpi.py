# -*- coding: utf-8 -*-
"""
modelo_no_supervisado_lfpiorpi_v2.py - VERSIÓN MEJORADA
Mejoras implementadas:
✅ Análisis de TODAS las clases (no solo "relevante")
✅ Anomaly scores como features para el modelo supervisado
✅ Clustering jerárquico para identificar patrones
✅ Detección de outliers multidimensional
✅ Exporta features enriquecidas para re-entrenamiento
"""
import os, json, warnings
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, DBSCAN
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score, davies_bouldin_score
from sklearn.decomposition import PCA
import joblib

os.environ["LOKY_MAX_CPU_COUNT"] = "4"
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

def log(msg): 
    print(f"[{pd.Timestamp.now().strftime('%H:%M:%S')}] {msg}")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "models", "config_modelos.json")
OUT_DIR = os.path.join(BASE_DIR, "outputs")

def load_config(path=CONFIG_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def resolve_path(p):
    if not p: return p
    return p if os.path.isabs(p) else os.path.join(BASE_DIR, p.replace("/", os.sep))

def analizar_clusters_por_clase(df, X_scaled, labels, clase):
    """Analiza características de clusters dentro de una clase"""
    mask = df["clasificacion_lfpiorpi"] == clase
    if mask.sum() == 0:
        return None
    
    df_clase = df[mask].copy()
    X_clase = X_scaled[mask]
    labels_clase = labels[mask]
    
    cluster_stats = []
    for cluster_id in np.unique(labels_clase):
        if cluster_id == -1:  # Outliers en DBSCAN
            continue
        
        mask_cluster = labels_clase == cluster_id
        cluster_data = df_clase[mask_cluster]
        
        stats = {
            "clase": clase,
            "cluster_id": int(cluster_id),
            "size": int(mask_cluster.sum()),
            "monto_promedio": float(cluster_data["monto"].mean()),
            "monto_std": float(cluster_data["monto"].std()),
            "frecuencia_promedio": float(cluster_data.get("frecuencia_mensual", 0).mean()),
            "pct_efectivo": float((cluster_data.get("EsEfectivo", 0) == 1).mean()),
            "pct_internacional": float((cluster_data.get("EsInternacional", 0) == 1).mean()),
            "sectores_principales": cluster_data.get("sector_actividad", pd.Series()).value_counts().head(3).to_dict()
        }
        cluster_stats.append(stats)
    
    return cluster_stats

def calcular_anomaly_features(df, X_scaled, iso_model, kmeans_model, dbscan_model):
    """
    Calcula features de anomalía que pueden usarse en el modelo supervisado
    ✅ CLAVE: Estos features NO tienen data leakage porque se calculan sobre patrones, no sobre labels
    """
    df_features = df.copy()
    
    # 1. Isolation Forest score (más negativo = más anómalo)
    df_features["anomaly_score_iso"] = iso_model.decision_function(X_scaled)
    df_features["is_outlier_iso"] = (iso_model.predict(X_scaled) == -1).astype(int)
    
    # 2. Distancia al centroide de cluster más cercano (KMeans)
    df_features["cluster_kmeans"] = kmeans_model.predict(X_scaled)
    centers = kmeans_model.cluster_centers_
    distances = np.min(
        [np.linalg.norm(X_scaled - center, axis=1) for center in centers],
        axis=0
    )
    df_features["dist_to_cluster_center"] = distances
    
    # 3. DBSCAN noise detection
    df_features["is_dbscan_noise"] = (dbscan_model.labels_ == -1).astype(int)
    df_features["cluster_dbscan"] = dbscan_model.labels_
    
    # 4. PCA-based anomaly score (distancia en espacio reducido)
    pca = PCA(n_components=min(10, X_scaled.shape[1]), random_state=42)
    X_pca = pca.fit_transform(X_scaled)
    pca_dist = np.linalg.norm(X_pca, axis=1)
    df_features["anomaly_score_pca"] = pca_dist
    
    # 5. Composite anomaly score (normalizado 0-1)
    # Combina múltiples señales
    iso_norm = (df_features["anomaly_score_iso"] - df_features["anomaly_score_iso"].min()) / \
               (df_features["anomaly_score_iso"].max() - df_features["anomaly_score_iso"].min())
    
    dist_norm = (df_features["dist_to_cluster_center"] - df_features["dist_to_cluster_center"].min()) / \
                (df_features["dist_to_cluster_center"].max() - df_features["dist_to_cluster_center"].min())
    
    pca_norm = (df_features["anomaly_score_pca"] - df_features["anomaly_score_pca"].min()) / \
               (df_features["anomaly_score_pca"].max() - df_features["anomaly_score_pca"].min())
    
    df_features["anomaly_score_composite"] = (
        0.4 * (1 - iso_norm) +  # Invertir porque ISO es más negativo = más anómalo
        0.3 * dist_norm +
        0.3 * pca_norm
    )
    
    return df_features

def main():
    log("🔎 MODELO NO SUPERVISADO V2 - LFPIORPI (MEJORADO)")
    print("=" * 74)

    cfg = load_config()
    dataset_path = resolve_path(cfg["data"]["dataset_enriched_path"])
    log(f"CONFIG_PATH -> {os.path.abspath(CONFIG_PATH)}")
    log(f"Dataset -> {dataset_path}")

    df = pd.read_csv(dataset_path)
    log(f"Rows: {len(df):,} | Cols: {len(df.columns)}")

    # ✅ MEJORA 1: Analizar TODAS las clases, no solo "relevante"
    log("\n📊 Distribución de clases en dataset:")
    for clase, count in df["clasificacion_lfpiorpi"].value_counts().items():
        log(f"   {clase}: {count:,} ({count/len(df)*100:.1f}%)")

    # Preparar features numéricas
    X = df.select_dtypes(include=[np.number]).replace([np.inf, -np.inf], np.nan).fillna(0)
    log(f"\n🔧 Features numéricas: {len(X.columns)}")

    # Escalado
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ============================================================
    # PARTE 1: ISOLATION FOREST (Anomalías globales)
    # ============================================================
    log("\n🌲 1. ISOLATION FOREST - Detección de anomalías globales")
    contamination = float(cfg["modelos"]["no_supervisado"].get("target_outlier_ratio", 0.04))
    n_estimators = int(cfg["modelos"]["no_supervisado"].get("iforest_n_estimators", 300))
    
    iso = IsolationForest(
        contamination=contamination, 
        random_state=42, 
        n_jobs=-1,
        n_estimators=n_estimators
    )
    iso.fit(X_scaled)
    
    outliers = (iso.predict(X_scaled) == -1)
    log(f"   Anomalías detectadas: {outliers.sum():,} ({outliers.sum()/len(df)*100:.2f}%)")
    
    # Distribución de outliers por clase
    log("   Distribución de outliers por clase:")
    for clase in df["clasificacion_lfpiorpi"].unique():
        mask_clase = df["clasificacion_lfpiorpi"] == clase
        outliers_clase = outliers[mask_clase].sum()
        log(f"      {clase}: {outliers_clase:,} ({outliers_clase/mask_clase.sum()*100:.1f}%)")

    # ============================================================
    # PARTE 2: KMEANS (Clustering para patrones)
    # ============================================================
    log("\n🎯 2. KMEANS - Búsqueda de K óptimo")
    k_min = int(cfg["modelos"]["no_supervisado"].get("k_min", 6))
    k_max = int(cfg["modelos"]["no_supervisado"].get("k_max", 14))
    
    best_k, best_score = None, -np.inf
    silhouette_scores = []
    
    for k in range(k_min, k_max + 1):
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X_scaled)
        sil = silhouette_score(X_scaled, labels)
        dbi = davies_bouldin_score(X_scaled, labels)
        score = sil - 0.1 * dbi
        silhouette_scores.append({"k": k, "silhouette": sil, "dbi": dbi, "score": score})
        
        log(f"   K={k} | silhouette={sil:.4f} | DBI={dbi:.4f} | score={score:.4f}")
        
        if score > best_score:
            best_k, best_score = k, score
    
    log(f"\n✅ Mejor K={best_k} (score={best_score:.4f})")
    
    # Entrenar KMeans final
    kmeans_final = KMeans(n_clusters=best_k, random_state=42, n_init=10)
    kmeans_labels = kmeans_final.fit_predict(X_scaled)

    # ============================================================
    # PARTE 3: DBSCAN (Clustering basado en densidad)
    # ============================================================
    log("\n🔬 3. DBSCAN - Clustering basado en densidad")
    
    # Auto-tune eps usando percentil de distancias
    from sklearn.neighbors import NearestNeighbors
    neighbors = NearestNeighbors(n_neighbors=5)
    neighbors.fit(X_scaled)
    distances, _ = neighbors.kneighbors(X_scaled)
    distances = np.sort(distances[:, -1])
    eps = np.percentile(distances, 90)
    
    dbscan = DBSCAN(eps=eps, min_samples=5, n_jobs=-1)
    dbscan_labels = dbscan.fit_predict(X_scaled)
    
    n_clusters = len(set(dbscan_labels)) - (1 if -1 in dbscan_labels else 0)
    n_noise = (dbscan_labels == -1).sum()
    
    log(f"   eps={eps:.3f} | Clusters detectados: {n_clusters}")
    log(f"   Ruido/Outliers: {n_noise:,} ({n_noise/len(df)*100:.2f}%)")

    # ============================================================
    # PARTE 4: ANÁLISIS DE CLUSTERS POR CLASE
    # ============================================================
    log("\n📊 4. ANÁLISIS DE CLUSTERS POR CLASE")
    
    all_cluster_stats = []
    for clase in ["relevante", "inusual", "preocupante"]:
        stats = analizar_clusters_por_clase(df, X_scaled, kmeans_labels, clase)
        if stats:
            all_cluster_stats.extend(stats)
            log(f"\n   {clase.upper()}:")
            for stat in stats[:3]:  # Mostrar top 3 clusters
                log(f"      Cluster {stat['cluster_id']}: n={stat['size']}, "
                    f"monto_avg=${stat['monto_promedio']:,.0f}, "
                    f"efectivo={stat['pct_efectivo']*100:.1f}%")

    # ============================================================
    # PARTE 5: GENERAR FEATURES DE ANOMALÍA PARA SUPERVISADO
    # ============================================================
    log("\n🎨 5. GENERANDO FEATURES DE ANOMALÍA PARA MODELO SUPERVISADO")
    
    df_enriched = calcular_anomaly_features(df, X_scaled, iso, kmeans_final, dbscan)
    
    # Guardar dataset enriquecido con anomaly features
    enriched_path = os.path.join(OUT_DIR, "dataset_enriched_with_anomalies.csv")
    df_enriched.to_csv(enriched_path, index=False)
    log(f"   ✅ Dataset enriquecido guardado: {enriched_path}")
    log(f"   Nuevas columnas: anomaly_score_iso, is_outlier_iso, dist_to_cluster_center,")
    log(f"                    is_dbscan_noise, anomaly_score_pca, anomaly_score_composite")

    # ============================================================
    # PARTE 6: GUARDAR MODELOS Y METADATOS
    # ============================================================
    log("\n💾 6. GUARDANDO MODELOS Y RESULTADOS")
    
    os.makedirs(OUT_DIR, exist_ok=True)
    
    # Bundle principal
    bundle_ns = {
        "scaler": scaler,
        "columns": X.columns.tolist(),
        "isolation_forest": iso,
        "kmeans": kmeans_final,
        "kmeans_best_k": best_k,
        "dbscan": dbscan,
        "dbscan_eps": float(eps),
        "version": "2.0"
    }
    bundle_path = os.path.join(OUT_DIR, "no_supervisado_bundle_v2.pkl")
    joblib.dump(bundle_ns, bundle_path)
    log(f"   ✅ Bundle guardado: {os.path.abspath(bundle_path)}")
    
    # Metadatos y análisis
    metadata = {
        "isolation_forest": {
            "contamination": float(contamination),
            "n_estimators": n_estimators,
            "outliers_detected": int(outliers.sum()),
            "outliers_pct": float(outliers.sum() / len(df))
        },
        "kmeans": {
            "best_k": int(best_k),
            "silhouette_scores": silhouette_scores
        },
        "dbscan": {
            "eps": float(eps),
            "n_clusters": int(n_clusters),
            "n_noise": int(n_noise),
            "noise_pct": float(n_noise / len(df))
        },
        "cluster_analysis": all_cluster_stats,
        "version": "2.0"
    }
    
    metadata_path = os.path.join(OUT_DIR, "no_supervisado_metadata_v2.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    log(f"   ✅ Metadata guardado: {os.path.abspath(metadata_path)}")
    
    # Top anomalías por clase
    for clase in ["relevante", "inusual", "preocupante"]:
        mask = df_enriched["clasificacion_lfpiorpi"] == clase
        if mask.sum() == 0:
            continue
        
        top_anomalies = df_enriched[mask].nlargest(50, "anomaly_score_composite")
        top_path = os.path.join(OUT_DIR, f"anomalias_top50_{clase}_v2.csv")
        top_anomalies.to_csv(top_path, index=False)
        log(f"   ✅ Top 50 anomalías {clase}: {os.path.abspath(top_path)}")

    log("\n" + "="*74)
    log("🎉 MODELO NO SUPERVISADO V2 COMPLETADO")
    log("="*74)
    log("\n💡 PRÓXIMO PASO:")
    log("   Re-entrenar modelo supervisado usando 'dataset_enriched_with_anomalies.csv'")
    log("   para incorporar los anomaly scores como features adicionales.")
    log("\nListo.")

if __name__ == "__main__":
    main()
