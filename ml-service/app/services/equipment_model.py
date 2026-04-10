"""
SEP — Smart Enterprise Platform
Equipment Failure Prediction Model (Random Forest)
Generates synthetic training data and predicts failure risk for IT assets.
Author: Saqqaf Al-Yazidi (TP075880)
"""

import os
import json
import time
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

import warnings
warnings.filterwarnings('ignore')


MODEL_DIR = os.environ.get('MODEL_DIR', os.path.join(os.path.dirname(__file__), '..', 'models'))

ASSET_TYPES = ['Laptop', 'Desktop', 'Server', 'Monitor', 'Printer', 'Network Switch', 'Router', 'Phone']
BRANDS = ['Dell', 'HP', 'Lenovo', 'Apple', 'Cisco', 'Samsung']

FEATURE_COLUMNS = [
    'asset_type', 'age_years', 'usage_hours_daily', 'maintenance_count',
    'days_since_last_maintenance', 'brand', 'warranty_expired'
]

CATEGORICAL_COLUMNS = ['asset_type', 'brand']


class EquipmentFailureModel:
    """
    Equipment failure prediction using Random Forest.
    Trained on synthetic data with realistic failure-risk rules.
    """

    def __init__(self):
        self.model = None
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.is_trained: bool = False
        self.metrics: Dict[str, Any] = {}
        self.feature_importance: Dict[str, Any] = {}
        self.dataset_info: Dict[str, Any] = {}
        self.feature_names: List[str] = []

        os.makedirs(MODEL_DIR, exist_ok=True)
        self._try_load_model()

    def _try_load_model(self):
        """Try to load a previously trained model from disk."""
        model_path = os.path.join(MODEL_DIR, 'equipment_rf.joblib')
        meta_path = os.path.join(MODEL_DIR, 'equipment_rf_meta.json')
        encoder_path = os.path.join(MODEL_DIR, 'equipment_encoders.joblib')

        if os.path.exists(model_path) and os.path.exists(meta_path):
            try:
                self.model = joblib.load(model_path)
                with open(meta_path, 'r') as f:
                    meta = json.load(f)
                self.metrics = meta.get('metrics', {})
                self.feature_names = meta.get('feature_names', [])
                self.dataset_info = meta.get('dataset_info', {})
                self.feature_importance = meta.get('feature_importance', {})
                self.is_trained = True

                if os.path.exists(encoder_path):
                    self.label_encoders = joblib.load(encoder_path)

                print(f"  Loaded equipment model (accuracy: {self.metrics.get('accuracy', 'N/A')})")
            except Exception as e:
                print(f"  Failed to load equipment model: {e}")

    # ------------------------------------------------------------------
    # Synthetic data generation
    # ------------------------------------------------------------------

    def _generate_synthetic_data(self, n_samples: int = 2000) -> pd.DataFrame:
        """
        Generate synthetic equipment data with realistic failure-risk labels.

        Rules:
          - Older assets (3+ years) with expired warranties -> higher risk
          - High maintenance count -> higher risk
          - Servers and printers fail more often than monitors
          - Assets not maintained in 6+ months (180 days) -> higher risk
        """
        rng = np.random.RandomState(42)

        asset_type = rng.choice(ASSET_TYPES, n_samples)
        brand = rng.choice(BRANDS, n_samples)
        age_years = np.round(rng.uniform(0.1, 10.0, n_samples), 1)
        usage_hours_daily = np.round(rng.uniform(1, 24, n_samples), 1)
        maintenance_count = rng.randint(0, 15, n_samples)
        days_since_last_maintenance = rng.randint(0, 730, n_samples)
        warranty_expired = rng.choice([0, 1], n_samples, p=[0.45, 0.55])

        # Derive failure risk label using rule-based logic + noise
        risk_score = np.zeros(n_samples, dtype=float)

        # Age factor
        risk_score += np.where(age_years >= 5, 2.0, np.where(age_years >= 3, 1.0, 0.0))

        # Warranty factor
        risk_score += warranty_expired * 1.0

        # Interaction: old + expired warranty
        risk_score += np.where((age_years >= 3) & (warranty_expired == 1), 1.5, 0.0)

        # Maintenance count factor (many repairs = bad sign)
        risk_score += np.where(maintenance_count >= 8, 2.0, np.where(maintenance_count >= 4, 1.0, 0.0))

        # Days since last maintenance (6+ months)
        risk_score += np.where(days_since_last_maintenance >= 365, 2.0,
                      np.where(days_since_last_maintenance >= 180, 1.0, 0.0))

        # Asset type factor
        type_bonus = {
            'Server': 1.5, 'Printer': 1.2, 'Router': 0.8, 'Network Switch': 0.8,
            'Laptop': 0.5, 'Desktop': 0.3, 'Phone': 0.2, 'Monitor': 0.0
        }
        for i in range(n_samples):
            risk_score[i] += type_bonus.get(asset_type[i], 0.0)

        # Usage hours factor
        risk_score += np.where(usage_hours_daily >= 16, 1.0, np.where(usage_hours_daily >= 10, 0.5, 0.0))

        # Add noise
        risk_score += rng.normal(0, 0.8, n_samples)

        # Map to labels: 0=low, 1=medium, 2=high
        failure_risk = np.where(risk_score >= 6, 2, np.where(risk_score >= 3, 1, 0))

        df = pd.DataFrame({
            'asset_type': asset_type,
            'age_years': age_years,
            'usage_hours_daily': usage_hours_daily,
            'maintenance_count': maintenance_count,
            'days_since_last_maintenance': days_since_last_maintenance,
            'brand': brand,
            'warranty_expired': warranty_expired,
            'failure_risk': failure_risk,
        })

        return df

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def _preprocess(self, df: pd.DataFrame, fit: bool = False):
        """Encode categoricals, return X array and optional y."""
        df = df.copy()

        has_target = 'failure_risk' in df.columns
        y = df['failure_risk'].values if has_target else None

        X = df[FEATURE_COLUMNS].copy()

        for col in CATEGORICAL_COLUMNS:
            if col in X.columns:
                if fit:
                    le = LabelEncoder()
                    X[col] = le.fit_transform(X[col].astype(str))
                    self.label_encoders[col] = le
                else:
                    if col in self.label_encoders:
                        le = self.label_encoders[col]
                        X[col] = X[col].astype(str).apply(
                            lambda x: le.transform([x])[0] if x in le.classes_ else -1
                        )
                    else:
                        X[col] = 0

        X = X.fillna(0)
        self.feature_names = list(X.columns)
        return X.values, y

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self) -> Dict[str, Any]:
        """Train the Random Forest model on synthetic equipment data."""
        start_time = time.time()

        print("Generating synthetic equipment data...")
        df = self._generate_synthetic_data(n_samples=2000)

        self.dataset_info = {
            'total_rows': len(df),
            'features_used': len(FEATURE_COLUMNS),
            'feature_names': FEATURE_COLUMNS,
            'risk_distribution': {
                'low': int((df['failure_risk'] == 0).sum()),
                'medium': int((df['failure_risk'] == 1).sum()),
                'high': int((df['failure_risk'] == 2).sum()),
            },
        }

        print("Preprocessing data...")
        X, y = self._preprocess(df, fit=True)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        print(f"  Train: {len(X_train):,} | Test: {len(X_test):,}")

        print("Training Random Forest (300 trees)...")
        rf = RandomForestClassifier(
            n_estimators=300,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            max_features='sqrt',
            random_state=42,
            n_jobs=-1,
            class_weight='balanced',
        )
        rf.fit(X_train, y_train)

        train_time = time.time() - start_time
        self.model = rf
        self.is_trained = True

        # Evaluate
        y_pred = rf.predict(X_test)
        self.metrics = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
            'f1_score': float(f1_score(y_test, y_pred, average='weighted', zero_division=0)),
            'training_time': round(train_time, 2),
            'test_samples': int(len(y_test)),
        }

        # Feature importance
        importances = rf.feature_importances_
        sorted_idx = np.argsort(importances)[::-1]
        self.feature_importance = {
            'features': [self.feature_names[i] for i in sorted_idx],
            'importances': [float(importances[i]) for i in sorted_idx],
            'top_features': [
                {'feature': self.feature_names[i], 'importance': round(float(importances[i]), 4)}
                for i in sorted_idx
            ],
        }

        # Save
        self._save()

        print(f"Equipment model trained in {train_time:.1f}s — Accuracy: {self.metrics['accuracy']:.4f}")

        return {
            'success': True,
            'training_time': round(train_time, 1),
            'dataset': self.dataset_info,
            'metrics': self.metrics,
            'feature_importance': self.feature_importance,
        }

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(self, asset_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict failure risk for a single asset."""
        if not self.is_trained or self.model is None:
            return {'error': 'Model not trained. Call /train first.'}

        df = pd.DataFrame([asset_data])

        # Ensure all feature columns exist with defaults
        for col in FEATURE_COLUMNS:
            if col not in df.columns:
                df[col] = 0

        X, _ = self._preprocess(df, fit=False)

        prediction = int(self.model.predict(X)[0])
        probabilities = self.model.predict_proba(X)[0]

        risk_level_map = {0: 'Low', 1: 'Medium', 2: 'High'}
        risk_level = risk_level_map.get(prediction, 'Unknown')

        # Overall risk score: weighted probability toward higher risk classes
        risk_score = float(probabilities[1] * 0.5 + probabilities[2] * 1.0)
        risk_score = min(round(risk_score, 4), 1.0)

        # Recommended action
        if prediction == 2:
            recommended_action = 'Consider replacement'
        elif prediction == 1:
            recommended_action = 'Schedule maintenance'
        else:
            # Even low risk might need monitoring depending on score
            if risk_score > 0.2:
                recommended_action = 'Monitor closely'
            else:
                recommended_action = 'OK'

        # Top contributing factors from feature importance
        top_factors = []
        if self.feature_importance:
            top_factors = self.feature_importance.get('top_features', [])[:5]

        return {
            'risk_score': risk_score,
            'risk_level': risk_level,
            'risk_class': prediction,
            'probabilities': {
                'low': round(float(probabilities[0]), 4),
                'medium': round(float(probabilities[1]), 4),
                'high': round(float(probabilities[2]), 4),
            },
            'recommended_action': recommended_action,
            'top_factors': top_factors,
        }

    def batch_predict(self, assets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Predict failure risk for multiple assets."""
        results = []
        for asset in assets:
            result = self.predict(asset)
            results.append(result)

        high_risk = sum(1 for r in results if r.get('risk_level') == 'High')
        medium_risk = sum(1 for r in results if r.get('risk_level') == 'Medium')
        low_risk = sum(1 for r in results if r.get('risk_level') == 'Low')

        return {
            'predictions': results,
            'summary': {
                'total': len(results),
                'high_risk': high_risk,
                'medium_risk': medium_risk,
                'low_risk': low_risk,
                'average_risk_score': round(
                    float(np.mean([r.get('risk_score', 0) for r in results])), 4
                ),
            },
        }

    # ------------------------------------------------------------------
    # Summaries
    # ------------------------------------------------------------------

    def get_fleet_summary(self) -> Dict[str, Any]:
        """Return an overview of the trained model and fleet risk distribution."""
        if not self.is_trained:
            return {'error': 'Model not trained. Call /train first.'}

        return {
            'model_trained': self.is_trained,
            'dataset': self.dataset_info,
            'metrics': self.metrics,
            'feature_importance': self.feature_importance,
        }

    def get_feature_importance(self) -> Dict[str, Any]:
        """Return feature importance rankings."""
        if not self.feature_importance:
            return {'error': 'No feature importance available. Train the model first.'}
        return self.feature_importance

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _save(self):
        """Save model and metadata to disk."""
        model_path = os.path.join(MODEL_DIR, 'equipment_rf.joblib')
        joblib.dump(self.model, model_path)

        encoder_path = os.path.join(MODEL_DIR, 'equipment_encoders.joblib')
        joblib.dump(self.label_encoders, encoder_path)

        meta = {
            'metrics': self.metrics,
            'feature_names': self.feature_names,
            'dataset_info': self.dataset_info,
            'feature_importance': self.feature_importance,
            'trained_at': datetime.now().isoformat(),
        }
        meta_path = os.path.join(MODEL_DIR, 'equipment_rf_meta.json')
        with open(meta_path, 'w') as f:
            json.dump(meta, f, indent=2)

        print(f"  Equipment model saved to {MODEL_DIR}")


# Singleton instance
equipment_model = EquipmentFailureModel()
