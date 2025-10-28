
# ===================================================================
# ARCHIVO 2: modelo_no_supervisado_lfpiorpi.py
# ===================================================================
"""
Unsupervised Model - Anomaly Detection
"""

import os, json, logging, joblib, warnings
import pandas as pd
import numpy as np
from sklearn.cluster import MiniBatchKMeans
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score


os.environ["LOKY_MAX_CPU_COUNT"] = "4"  # Or your CPU count

warnings.filterwarnings("ignore")

LOG_DIR = os.path.join("backend", "outputs", "logs")
os.makedirs(LOG_DIR, exist_ok=True)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config_modelos.json")

def main():
    print(f"\n{'='*70}")
    print("🔍 MODELO NO SUPERVISADO")
    print(f"{'='*70}\n")
    
    with open(CONFIG_PATH, "r") as f:
        cfg = json.load(f)
    
    dataset_path = cfg["dataset"]["path"]
    df = pd.read_csv(dataset_path)
    
    # Only numeric features
    df_numeric = df.select_dtypes(include=[np.number])
    
    print(f"Dataset: {len(df_numeric)} registros")
    
    # Scale
    scaler = StandardScaler()
    df_scaled = scaler.fit_transform(df_numeric)
    
    # PCA
    pca = PCA(n_components=0.98, random_state=42)
    df_pca = pca.fit_transform(df_scaled)
    print(f"PCA: {pca.n_components_} componentes\n")
    
    # KMeans
    n_clusters = 10
    print(f"Entrenando KMeans ({n_clusters} clusters)...")
    
    kmeans = MiniBatchKMeans(
        n_clusters=n_clusters,
        random_state=42,
        batch_size=2048,
        n_init=10
    )
    kmeans.fit(df_pca)
    labels = kmeans.labels_
    
    # Metrics
    if len(df_pca) <= 10000:
        silhouette = silhouette_score(df_pca, labels)
    else:
        sample_idx = np.random.choice(len(df_pca), 10000, replace=False)
        silhouette = silhouette_score(df_pca[sample_idx], labels[sample_idx])
    
    db_score = davies_bouldin_score(df_pca, labels)
    
    # IsolationForest
    contamination = 0.03
    print(f"Entrenando IsolationForest...")
    
    iforest = IsolationForest(
        contamination=contamination,
        n_estimators=300,
        max_samples=min(2048, len(df_pca)),
        random_state=42,
        n_jobs=-1
    )
    iforest.fit(df_pca)
    
    anomalias = iforest.predict(df_pca)
    outlier_ratio = np.sum(anomalias == -1) / len(anomalias)
    
    print(f"\n{'='*70}")
    print(f"✅ Silhouette: {silhouette:.4f}")
    print(f"📊 Davies-Bouldin: {db_score:.4f}")
    print(f"📊 Outliers: {outlier_ratio:.4f} ({int(outlier_ratio*len(df_pca))} casos)")
    print(f"{'='*70}\n")
    
    # Save
    model_data = {
        "kmeans": kmeans,
        "iforest": iforest,
        "scaler": scaler,
        "pca": pca
    }
    
    joblib.dump(model_data, "backend/outputs/modelo_no_supervisado_th.pkl")
    
    metrics = {
        "silhouette": float(silhouette),
        "davies_bouldin": float(db_score),
        "outlier_ratio": float(outlier_ratio),
        "n_clusters": int(n_clusters)
    }
    
    with open("backend/outputs/metricas_no_supervisado.json", "w") as f:
        json.dump(metrics, f, indent=4)
    
    print("✅ Modelo guardado: backend/outputs/modelo_no_supervisado_th.pkl\n")

if __name__ == "__main__":
    main()
