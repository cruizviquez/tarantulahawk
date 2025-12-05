import numpy as np
import pandas as pd

from app.backend.api.ml_runner_ant import aplicar_no_supervisado


class FakeIso:
    def decision_function(self, X):
        # return lower score for more anomalous rows
        return np.array([0.1 * np.sum(row) for row in X])

    def predict(self, X):
        return np.array([1 if np.sum(row) < 1 else -1 for row in X])


class FakeDB:
    def fit_predict(self, X):
        # mark the last row as noise
        return np.array([0] * (X.shape[0] - 1) + [-1])


class FakeKM:
    def transform(self, X):
        # distances: sum along row
        return np.abs(X.sum(axis=1)).reshape(-1, 1)


class FakePCA:
    def transform(self, X):
        return X[:, :min(X.shape[1], 2)]

    def inverse_transform(self, Xr):
        # simple placeholder: pad zeros
        out = np.zeros((Xr.shape[0], 3))
        out[:, :Xr.shape[1]] = Xr
        return out


def run_test():
    df = pd.DataFrame({
        "monto": [100, 200, 1000],
        "tipo_operacion": ["A", "B", "C"],
        "sector_actividad": ["s1", "s2", "s3"],
        "fraccion": ["f1", "f2", "f3"],
        "cliente_id": ["c1", "c2", "c3"],
    })

    bundle = {
        "columns": ["monto"],
        "scaler": None,
        "isolation_forest": FakeIso(),
        "dbscan": FakeDB(),
        "kmeans": FakeKM(),
        "pca": FakePCA(),
        "weights": {"iso": 0.5, "kmeans": 0.2, "pca": 0.0, "dbscan": 0.3},
    }

    out = aplicar_no_supervisado(df, bundle)
    assert "anomaly_score_composite" in out.columns
    assert "anomaly_score_iso" in out.columns
    assert "is_outlier_iso" in out.columns
    assert "is_dbscan_noise" in out.columns
    assert "kmeans_dist" in out.columns
    assert "pca_recon_mse" in out.columns

    print("test_no_supervisado OK")


if __name__ == "__main__":
    run_test()
