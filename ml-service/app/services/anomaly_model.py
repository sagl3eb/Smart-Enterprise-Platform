import os
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime
from typing import Dict, List, Optional

MODEL_DIR = os.getenv("MODEL_DIR", os.path.join(os.path.dirname(__file__), "..", "models"))

_metrics: Dict = {}
_version: str = "1.0.0"
_trained_at: Optional[str] = None


def detect_anomalies(metric: str, data: List[Dict], contamination: float = 0.1) -> Dict:
    global _metrics, _version, _trained_at

    df = pd.DataFrame(data)
    df.columns = ["timestamp", "value"]
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df = df.dropna()

    if len(df) < 10:
        raise ValueError("Need at least 10 data points for anomaly detection")

    values = df["value"].values.reshape(-1, 1)

    # Feature engineering: value, rolling mean, rolling std, rate of change
    value_series = df["value"].values
    features = []
    window = min(5, len(value_series) - 1)

    for i in range(len(value_series)):
        start = max(0, i - window)
        window_values = value_series[start:i + 1]

        rolling_mean = float(np.mean(window_values))
        rolling_std = float(np.std(window_values)) if len(window_values) > 1 else 0
        rate_of_change = float(value_series[i] - value_series[i - 1]) if i > 0 else 0
        deviation = float(abs(value_series[i] - rolling_mean))

        features.append([
            value_series[i],
            rolling_mean,
            rolling_std,
            rate_of_change,
            deviation,
        ])

    X = np.array(features)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_scaled)

    predictions = model.predict(X_scaled)
    scores = model.decision_function(X_scaled)

    # Calculate expected range
    global_mean = float(np.mean(value_series))
    global_std = float(np.std(value_series))

    results = []
    anomaly_count = 0

    for i in range(len(df)):
        is_anomaly = predictions[i] == -1
        if is_anomaly:
            anomaly_count += 1

        anomaly_score = round(float(-scores[i]), 4)

        start = max(0, i - window)
        local_values = value_series[start:i + 1]
        local_mean = float(np.mean(local_values))
        local_std = float(np.std(local_values)) if len(local_values) > 1 else global_std

        results.append({
            "timestamp": df.iloc[i]["timestamp"],
            "value": round(float(df.iloc[i]["value"]), 2),
            "is_anomaly": bool(is_anomaly),
            "anomaly_score": anomaly_score,
            "expected_min": round(local_mean - 2 * max(local_std, 0.01), 2),
            "expected_max": round(local_mean + 2 * max(local_std, 0.01), 2),
        })

    anomaly_rate = anomaly_count / len(df) if len(df) > 0 else 0

    _metrics = {
        "total_points": len(df),
        "anomalies_detected": anomaly_count,
        "contamination_param": contamination,
    }
    _version = f"1.0.{int(datetime.now().timestamp()) % 10000}"
    _trained_at = datetime.now().isoformat()

    return {
        "metric": metric,
        "total_points": len(df),
        "anomaly_count": anomaly_count,
        "anomaly_rate": round(anomaly_rate, 4),
        "results": results,
    }


def get_model_info() -> Dict:
    return {
        "name": "anomaly_detector",
        "type": "Isolation Forest",
        "version": _version,
        "status": "active",
        "metrics": _metrics,
        "trained_at": _trained_at,
        "description": "Detects anomalies in time series data using Isolation Forest with rolling statistics features.",
    }
