import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import StandardScaler
from datetime import datetime
from typing import Dict, List, Tuple, Optional

MODEL_DIR = os.getenv("MODEL_DIR", os.path.join(os.path.dirname(__file__), "..", "models"))
MODEL_PATH = os.path.join(MODEL_DIR, "attrition_model.pkl")
SCALER_PATH = os.path.join(MODEL_DIR, "attrition_scaler.pkl")
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "attrition_data.csv")

FEATURE_NAMES = [
    "satisfaction_score",
    "performance_score",
    "years_at_company",
    "overtime_hours_avg",
    "num_projects",
    "salary",
    "days_since_last_promotion",
]

_model: Optional[RandomForestClassifier] = None
_scaler: Optional[StandardScaler] = None
_metrics: Dict = {}
_version: str = "1.0.0"
_trained_at: Optional[str] = None


def _ensure_model_dir():
    os.makedirs(MODEL_DIR, exist_ok=True)


def load_model() -> Tuple[Optional[RandomForestClassifier], Optional[StandardScaler]]:
    global _model, _scaler, _metrics, _trained_at
    if _model is not None:
        return _model, _scaler

    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        _model = joblib.load(MODEL_PATH)
        _scaler = joblib.load(SCALER_PATH)
        _trained_at = datetime.fromtimestamp(os.path.getmtime(MODEL_PATH)).isoformat()
        return _model, _scaler

    return None, None


def train_model(force: bool = False) -> Dict:
    global _model, _scaler, _metrics, _version, _trained_at
    _ensure_model_dir()

    if not force and _model is not None:
        return {"message": "Model already trained", "metrics": _metrics, "version": _version}

    if os.path.exists(DATA_PATH):
        df = pd.read_csv(DATA_PATH)
    else:
        df = _generate_synthetic_data()
        os.makedirs(os.path.dirname(DATA_PATH), exist_ok=True)
        df.to_csv(DATA_PATH, index=False)

    X = df[FEATURE_NAMES].values
    y = df["attrition"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1_score": round(f1_score(y_test, y_pred, zero_division=0), 4),
    }

    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    _model = model
    _scaler = scaler
    _metrics = metrics
    _version = f"1.0.{int(datetime.now().timestamp()) % 10000}"
    _trained_at = datetime.now().isoformat()

    return {"message": "Model trained successfully", "metrics": metrics, "version": _version}


def predict(features: Dict) -> Dict:
    model, scaler = load_model()

    if model is None or scaler is None:
        result = train_model()
        model, scaler = _model, _scaler
        if model is None or scaler is None:
            raise RuntimeError("Failed to train or load attrition model")

    feature_values = np.array([[
        features["satisfaction_score"],
        features["performance_score"],
        features["years_at_company"],
        features["overtime_hours_avg"],
        features["num_projects"],
        features["salary"],
        features["days_since_last_promotion"],
    ]])

    feature_scaled = scaler.transform(feature_values)

    probabilities = model.predict_proba(feature_scaled)[0]
    risk_score = round(float(probabilities[1]), 4)

    if risk_score >= 0.7:
        risk_level = "high"
    elif risk_score >= 0.4:
        risk_level = "medium"
    else:
        risk_level = "low"

    importances = model.feature_importances_
    factor_pairs = sorted(
        zip(FEATURE_NAMES, importances),
        key=lambda x: x[1],
        reverse=True,
    )
    top_factors = [
        {"factor": name, "importance": round(float(imp), 4)}
        for name, imp in factor_pairs[:5]
    ]

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "top_factors": top_factors,
        "confidence": round(float(max(probabilities)), 4),
    }


def get_model_info() -> Dict:
    model, _ = load_model()
    return {
        "name": "attrition_classifier",
        "type": "Random Forest Classifier",
        "version": _version,
        "status": "active" if model is not None else "not_trained",
        "metrics": _metrics,
        "trained_at": _trained_at,
        "description": "Predicts employee attrition risk using satisfaction, performance, tenure, overtime, projects, salary, and promotion recency.",
        "features": FEATURE_NAMES,
    }


def _generate_synthetic_data() -> pd.DataFrame:
    np.random.seed(42)
    n = 500

    satisfaction = np.random.uniform(1.0, 5.0, n)
    performance = np.random.uniform(1.5, 5.0, n)
    years = np.random.exponential(4, n).clip(0.5, 25)
    overtime = np.random.exponential(8, n).clip(0, 60)
    projects = np.random.randint(1, 8, n)
    salary = np.random.normal(65000, 20000, n).clip(30000, 150000)
    days_promo = np.random.exponential(400, n).clip(30, 3000).astype(int)

    attrition_prob = (
        0.25 * (5 - satisfaction) / 4
        + 0.10 * (5 - performance) / 4
        + 0.10 * np.clip(overtime / 40, 0, 1)
        + 0.15 * np.clip(days_promo / 1500, 0, 1)
        + 0.10 * np.clip(projects / 7, 0, 1)
        - 0.15 * np.clip(salary / 150000, 0, 1)
        - 0.05 * np.clip(years / 15, 0, 1)
        + np.random.normal(0, 0.08, n)
    )
    attrition_prob = np.clip(attrition_prob, 0, 1)
    attrition = (attrition_prob > 0.45).astype(int)

    df = pd.DataFrame({
        "satisfaction_score": np.round(satisfaction, 2),
        "performance_score": np.round(performance, 2),
        "years_at_company": np.round(years, 1),
        "overtime_hours_avg": np.round(overtime, 1),
        "num_projects": projects,
        "salary": np.round(salary, 2),
        "days_since_last_promotion": days_promo,
        "attrition": attrition,
    })

    return df
