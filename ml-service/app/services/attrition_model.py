"""
SEP — Smart Enterprise Platform
Enhanced Attrition Model with Random Forest + LightGBM Comparison
Supports the 56,599-row Kaggle dataset
Author: Saqqaf Al-Yazidi (TP075880)
"""

import os
import json
import time
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Any, Optional, List
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
    roc_curve
)

# Try importing LightGBM (preferred), fall back to sklearn GradientBoosting
try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

import warnings
warnings.filterwarnings('ignore')


MODEL_DIR = os.environ.get('MODEL_DIR', os.path.join(os.path.dirname(__file__), '..', 'models'))
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

# Column mapping from the 56k Kaggle dataset to internal names
KAGGLE_56K_COLUMNS = {
    'Employee ID': 'employee_id',
    'Age': 'age',
    'Gender': 'gender',
    'Years at Company': 'years_at_company',
    'Job Role': 'job_role',
    'Monthly Income': 'monthly_income',
    'Work-Life Balance': 'work_life_balance',
    'Job Satisfaction': 'job_satisfaction',
    'Performance Rating': 'performance_rating',
    'Number of Promotions': 'num_promotions',
    'Overtime': 'overtime',
    'Distance from Home': 'distance_from_home',
    'Education Level': 'education_level',
    'Marital Status': 'marital_status',
    'Number of Dependents': 'num_dependents',
    'Job Level': 'job_level',
    'Company Size': 'company_size',
    'Company Tenure': 'company_tenure',
    'Remote Work': 'remote_work',
    'Leadership Opportunities': 'leadership_opportunities',
    'Innovation Opportunities': 'innovation_opportunities',
    'Company Reputation': 'company_reputation',
    'Employee Recognition': 'employee_recognition',
    'Attrition': 'attrition'
}

# Features used for training (all except ID and target)
FEATURE_COLUMNS = [
    'age', 'gender', 'years_at_company', 'job_role', 'monthly_income',
    'work_life_balance', 'job_satisfaction', 'performance_rating',
    'num_promotions', 'overtime', 'distance_from_home', 'education_level',
    'marital_status', 'num_dependents', 'job_level', 'company_size',
    'company_tenure', 'remote_work', 'leadership_opportunities',
    'innovation_opportunities', 'company_reputation', 'employee_recognition'
]

# Categorical columns that need encoding
CATEGORICAL_COLUMNS = [
    'gender', 'job_role', 'work_life_balance', 'job_satisfaction',
    'performance_rating', 'overtime', 'education_level', 'marital_status',
    'job_level', 'company_size', 'remote_work', 'leadership_opportunities',
    'innovation_opportunities', 'company_reputation', 'employee_recognition'
]

# Ordinal mappings for ordered categories
ORDINAL_MAPS = {
    'work_life_balance': {'Poor': 1, 'Fair': 2, 'Good': 3, 'Excellent': 4},
    'job_satisfaction': {'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4},
    'performance_rating': {'Low': 1, 'Below Average': 2, 'Average': 3, 'High': 4},
    'company_reputation': {'Poor': 1, 'Fair': 2, 'Good': 3, 'Excellent': 4},
    'employee_recognition': {'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4},
    'job_level': {'Entry': 1, 'Mid': 2, 'Senior': 3},
    'company_size': {'Small': 1, 'Medium': 2, 'Large': 3},
}

# Binary mappings
BINARY_MAPS = {
    'overtime': {'No': 0, 'Yes': 1},
    'remote_work': {'No': 0, 'Yes': 1},
    'leadership_opportunities': {'No': 0, 'Yes': 1},
    'innovation_opportunities': {'No': 0, 'Yes': 1},
    'gender': {'Male': 0, 'Female': 1},
    'attrition': {'Stayed': 0, 'Left': 1},
}


class EnhancedAttritionModel:
    """
    Enhanced attrition prediction with multiple model comparison.
    Supports: Random Forest, LightGBM (or Gradient Boosting fallback), Logistic Regression.
    Trained on 56,599-row Kaggle Employee Attrition dataset.
    """

    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.scalers: Dict[str, StandardScaler] = {}
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.is_trained: Dict[str, bool] = {}
        self.metrics: Dict[str, Dict] = {}
        self.feature_importance: Dict[str, Dict] = {}
        self.confusion_matrices: Dict[str, Any] = {}
        self.roc_data: Dict[str, Dict] = {}
        self.training_history: List[Dict] = []
        self.dataset_info: Dict = {}
        self.feature_names: List[str] = []
        self.department_risks: Dict = {}

        os.makedirs(MODEL_DIR, exist_ok=True)
        self._try_load_models()

    def _try_load_models(self):
        """Try to load previously trained models from disk."""
        for model_name in ['random_forest', 'gradient_boosting', 'logistic_regression']:
            model_path = os.path.join(MODEL_DIR, f'attrition_{model_name}.joblib')
            meta_path = os.path.join(MODEL_DIR, f'attrition_{model_name}_meta.json')
            if os.path.exists(model_path) and os.path.exists(meta_path):
                try:
                    self.models[model_name] = joblib.load(model_path)
                    with open(meta_path, 'r') as f:
                        meta = json.load(f)
                    self.metrics[model_name] = meta.get('metrics', {})
                    self.is_trained[model_name] = True
                    self.feature_names = meta.get('feature_names', [])
                    self.dataset_info = meta.get('dataset_info', {})
                    
                    fi_path = os.path.join(MODEL_DIR, f'attrition_{model_name}_fi.json')
                    if os.path.exists(fi_path):
                        with open(fi_path, 'r') as f:
                            self.feature_importance[model_name] = json.load(f)
                    
                    cm_path = os.path.join(MODEL_DIR, f'attrition_{model_name}_cm.json')
                    if os.path.exists(cm_path):
                        with open(cm_path, 'r') as f:
                            self.confusion_matrices[model_name] = json.load(f)
                    
                    roc_path = os.path.join(MODEL_DIR, f'attrition_{model_name}_roc.json')
                    if os.path.exists(roc_path):
                        with open(roc_path, 'r') as f:
                            self.roc_data[model_name] = json.load(f)

                    print(f"  Loaded {model_name} model (accuracy: {self.metrics[model_name].get('accuracy', 'N/A')})")
                except Exception as e:
                    print(f"  Failed to load {model_name}: {e}")
        
        # Load scalers and encoders
        scaler_path = os.path.join(MODEL_DIR, 'attrition_scaler.joblib')
        if os.path.exists(scaler_path):
            self.scalers = joblib.load(scaler_path)
        
        encoder_path = os.path.join(MODEL_DIR, 'attrition_encoders.joblib')
        if os.path.exists(encoder_path):
            self.label_encoders = joblib.load(encoder_path)
        
        dept_path = os.path.join(MODEL_DIR, 'attrition_department_risks.json')
        if os.path.exists(dept_path):
            with open(dept_path, 'r') as f:
                self.department_risks = json.load(f)
        
        history_path = os.path.join(MODEL_DIR, 'attrition_training_history.json')
        if os.path.exists(history_path):
            with open(history_path, 'r') as f:
                self.training_history = json.load(f)

    def _load_dataset(self) -> pd.DataFrame:
        """Load the 56k Kaggle dataset."""
        # Try multiple possible filenames
        possible_files = [
            'employee_attrition_dataset.csv',
            'Employee-Attrition-Dataset.csv', 
            'train.csv',
            'attrition_data.csv',
            'employee_attrition.csv',
        ]
        
        for fname in possible_files:
            fpath = os.path.join(DATA_DIR, fname)
            if os.path.exists(fpath):
                df = pd.read_csv(fpath)
                print(f"  Loaded dataset: {fname} ({len(df):,} rows, {len(df.columns)} columns)")
                return df
        
        raise FileNotFoundError(
            f"No attrition dataset found in {DATA_DIR}. "
            f"Please place the CSV file (downloaded from Kaggle) in the data directory. "
            f"Tried: {', '.join(possible_files)}"
        )

    def _preprocess(self, df: pd.DataFrame, fit: bool = False) -> tuple:
        """Preprocess the dataset: encode categoricals, scale numerics."""
        df = df.copy()
        
        # Rename columns if they match the Kaggle format
        if 'Employee ID' in df.columns:
            df.rename(columns=KAGGLE_56K_COLUMNS, inplace=True)
        
        # Handle the target variable
        has_target = 'attrition' in df.columns
        if has_target:
            if df['attrition'].dtype == object:
                df['attrition'] = df['attrition'].map(BINARY_MAPS['attrition'])
            y = df['attrition'].values
        else:
            y = None
        
        # Select feature columns (only those present in the dataframe)
        available_features = [c for c in FEATURE_COLUMNS if c in df.columns]
        X = df[available_features].copy()
        
        # Apply ordinal mappings
        for col, mapping in ORDINAL_MAPS.items():
            if col in X.columns and X[col].dtype == object:
                X[col] = X[col].map(mapping).fillna(0).astype(int)
        
        # Apply binary mappings
        for col, mapping in BINARY_MAPS.items():
            if col in X.columns and X[col].dtype == object and col != 'attrition':
                X[col] = X[col].map(mapping).fillna(0).astype(int)
        
        # Label encode remaining categorical columns
        remaining_cats = [c for c in ['job_role', 'education_level', 'marital_status'] if c in X.columns]
        for col in remaining_cats:
            if X[col].dtype == object:
                if fit:
                    le = LabelEncoder()
                    X[col] = le.fit_transform(X[col].astype(str))
                    self.label_encoders[col] = le
                else:
                    if col in self.label_encoders:
                        le = self.label_encoders[col]
                        # Handle unseen labels
                        X[col] = X[col].astype(str).apply(
                            lambda x: le.transform([x])[0] if x in le.classes_ else -1
                        )
                    else:
                        X[col] = 0
        
        # Fill any remaining NaN
        X = X.fillna(0)
        
        # Scale numeric features
        numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
        if fit:
            scaler = StandardScaler()
            X[numeric_cols] = scaler.fit_transform(X[numeric_cols])
            self.scalers['main'] = scaler
        else:
            if 'main' in self.scalers:
                X[numeric_cols] = self.scalers['main'].transform(X[numeric_cols])
        
        self.feature_names = available_features
        return X.values, y, available_features

    def train(self, models_to_train: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Train all models on the 56k dataset.
        Returns training results with metrics for each model.
        """
        start_time = time.time()
        
        # Load and preprocess data
        print("Loading dataset...")
        df = self._load_dataset()
        
        self.dataset_info = {
            'total_rows': len(df),
            'columns': len(df.columns),
            'attrition_rate': float(df[df.columns[-1]].value_counts(normalize=True).to_dict().get('Left', 0)),
        }
        
        print("Preprocessing data...")
        X, y, feature_names = self._preprocess(df, fit=True)
        
        self.dataset_info['features_used'] = len(feature_names)
        self.dataset_info['feature_names'] = feature_names
        
        # Split data: 70% train, 15% validation, 15% test
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
        )
        
        print(f"  Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")
        
        if models_to_train is None:
            models_to_train = ['random_forest', 'gradient_boosting', 'logistic_regression']
        
        results = {}
        
        # --- Model 1: Random Forest ---
        if 'random_forest' in models_to_train:
            print("\nTraining Random Forest (500 trees)...")
            rf_start = time.time()
            rf = RandomForestClassifier(
                n_estimators=500,
                max_depth=20,
                min_samples_split=5,
                min_samples_leaf=2,
                max_features='sqrt',
                random_state=42,
                n_jobs=-1,
                class_weight='balanced'
            )
            rf.fit(X_train, y_train)
            rf_time = time.time() - rf_start
            
            self.models['random_forest'] = rf
            self.is_trained['random_forest'] = True
            self._evaluate_model('random_forest', rf, X_test, y_test, feature_names, rf_time)
            results['random_forest'] = self.metrics['random_forest']
            print(f"  Random Forest trained in {rf_time:.1f}s — Accuracy: {self.metrics['random_forest']['accuracy']:.4f}")
        
        # --- Model 2: LightGBM / Gradient Boosting ---
        if 'gradient_boosting' in models_to_train:
            if HAS_LIGHTGBM:
                print("\nTraining LightGBM...")
                gb_start = time.time()
                gb = lgb.LGBMClassifier(
                    n_estimators=500,
                    max_depth=15,
                    learning_rate=0.05,
                    num_leaves=63,
                    min_child_samples=20,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    reg_alpha=0.1,
                    reg_lambda=0.1,
                    random_state=42,
                    n_jobs=-1,
                    is_unbalance=True,
                    verbose=-1
                )
                gb.fit(
                    X_train, y_train,
                    eval_set=[(X_val, y_val)],
                    callbacks=[lgb.log_evaluation(period=0)]
                )
                gb_time = time.time() - gb_start
                model_label = 'LightGBM'
            else:
                print("\nTraining Gradient Boosting (sklearn fallback — LightGBM not installed)...")
                gb_start = time.time()
                gb = GradientBoostingClassifier(
                    n_estimators=300,
                    max_depth=10,
                    learning_rate=0.05,
                    min_samples_split=5,
                    min_samples_leaf=2,
                    subsample=0.8,
                    random_state=42
                )
                gb.fit(X_train, y_train)
                gb_time = time.time() - gb_start
                model_label = 'Gradient Boosting (sklearn)'
            
            self.models['gradient_boosting'] = gb
            self.is_trained['gradient_boosting'] = True
            self._evaluate_model('gradient_boosting', gb, X_test, y_test, feature_names, gb_time)
            self.metrics['gradient_boosting']['model_type'] = model_label
            results['gradient_boosting'] = self.metrics['gradient_boosting']
            print(f"  {model_label} trained in {gb_time:.1f}s — Accuracy: {self.metrics['gradient_boosting']['accuracy']:.4f}")
        
        # --- Model 3: Logistic Regression ---
        if 'logistic_regression' in models_to_train:
            print("\nTraining Logistic Regression...")
            lr_start = time.time()
            lr = LogisticRegression(
                max_iter=1000,
                random_state=42,
                class_weight='balanced',
                C=1.0,
                solver='lbfgs'
            )
            lr.fit(X_train, y_train)
            lr_time = time.time() - lr_start
            
            self.models['logistic_regression'] = lr
            self.is_trained['logistic_regression'] = True
            self._evaluate_model('logistic_regression', lr, X_test, y_test, feature_names, lr_time)
            results['logistic_regression'] = self.metrics['logistic_regression']
            print(f"  Logistic Regression trained in {lr_time:.1f}s — Accuracy: {self.metrics['logistic_regression']['accuracy']:.4f}")
        
        # --- Cross-validation for all trained models ---
        print("\nRunning 5-fold cross-validation...")
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        for name, model in self.models.items():
            if name in models_to_train:
                cv_scores = cross_val_score(model, X, y, cv=cv, scoring='accuracy', n_jobs=-1)
                self.metrics[name]['cv_accuracy_mean'] = float(np.mean(cv_scores))
                self.metrics[name]['cv_accuracy_std'] = float(np.std(cv_scores))
                self.metrics[name]['cv_scores'] = [float(s) for s in cv_scores]
                print(f"  {name}: CV Accuracy = {np.mean(cv_scores):.4f} (+/- {np.std(cv_scores):.4f})")
        
        # --- Department-level risk analysis ---
        print("\nComputing department-level attrition risks...")
        self._compute_department_risks(df)
        
        # --- Save everything ---
        self._save_all()
        
        total_time = time.time() - start_time
        
        # Record training history
        history_entry = {
            'timestamp': datetime.now().isoformat(),
            'dataset_rows': len(df),
            'features': len(feature_names),
            'training_time_seconds': round(total_time, 1),
            'models_trained': models_to_train,
            'results': {name: {
                'accuracy': self.metrics[name]['accuracy'],
                'f1': self.metrics[name]['f1_score'],
                'auc_roc': self.metrics[name].get('auc_roc', 0)
            } for name in models_to_train}
        }
        self.training_history.append(history_entry)
        
        history_path = os.path.join(MODEL_DIR, 'attrition_training_history.json')
        with open(history_path, 'w') as f:
            json.dump(self.training_history, f, indent=2)
        
        print(f"\nAll models trained in {total_time:.1f}s total")
        
        return {
            'success': True,
            'training_time': round(total_time, 1),
            'dataset': self.dataset_info,
            'models': results,
            'best_model': max(results.keys(), key=lambda k: results[k].get('accuracy', 0)),
            'department_risks': self.department_risks
        }

    def _evaluate_model(self, name: str, model, X_test, y_test, feature_names, train_time):
        """Compute all evaluation metrics for a model."""
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1] if hasattr(model, 'predict_proba') else np.zeros(len(y_test))
        
        # Core metrics
        self.metrics[name] = {
            'accuracy': float(accuracy_score(y_test, y_pred)),
            'precision': float(precision_score(y_test, y_pred, zero_division=0)),
            'recall': float(recall_score(y_test, y_pred, zero_division=0)),
            'f1_score': float(f1_score(y_test, y_pred, zero_division=0)),
            'auc_roc': float(roc_auc_score(y_test, y_prob)) if y_prob.any() else 0,
            'training_time': round(train_time, 2),
            'test_samples': int(len(y_test)),
        }
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        self.confusion_matrices[name] = {
            'matrix': cm.tolist(),
            'labels': ['Stayed', 'Left'],
            'true_negatives': int(cm[0][0]),
            'false_positives': int(cm[0][1]),
            'false_negatives': int(cm[1][0]),
            'true_positives': int(cm[1][1]),
        }
        
        # ROC curve data (sampled for JSON size)
        if y_prob.any():
            fpr, tpr, thresholds = roc_curve(y_test, y_prob)
            # Sample every Nth point to keep JSON manageable
            step = max(1, len(fpr) // 100)
            self.roc_data[name] = {
                'fpr': [float(x) for x in fpr[::step]],
                'tpr': [float(x) for x in tpr[::step]],
                'auc': float(roc_auc_score(y_test, y_prob))
            }
        
        # Feature importance
        if hasattr(model, 'feature_importances_'):
            importances = model.feature_importances_
        elif hasattr(model, 'coef_'):
            importances = np.abs(model.coef_[0])
        else:
            importances = np.zeros(len(feature_names))
        
        sorted_idx = np.argsort(importances)[::-1]
        self.feature_importance[name] = {
            'features': [feature_names[i] for i in sorted_idx],
            'importances': [float(importances[i]) for i in sorted_idx],
            'top_10': [
                {'feature': feature_names[i], 'importance': round(float(importances[i]), 4)}
                for i in sorted_idx[:10]
            ]
        }

    def _compute_department_risks(self, df: pd.DataFrame):
        """Compute attrition risk breakdown by department/job role."""
        df = df.copy()
        
        # Determine column names
        role_col = 'Job Role' if 'Job Role' in df.columns else 'job_role'
        attrition_col = 'Attrition' if 'Attrition' in df.columns else 'attrition'
        
        if role_col not in df.columns:
            self.department_risks = {}
            return
        
        # Convert attrition to binary if needed
        if df[attrition_col].dtype == object:
            df['_attrition_binary'] = (df[attrition_col] == 'Left').astype(int)
        else:
            df['_attrition_binary'] = df[attrition_col]
        
        dept_stats = df.groupby(role_col).agg(
            total_employees=('_attrition_binary', 'count'),
            attrition_count=('_attrition_binary', 'sum'),
            attrition_rate=('_attrition_binary', 'mean'),
            avg_satisfaction=(
                'Job Satisfaction' if 'Job Satisfaction' in df.columns else 'job_satisfaction', 
                lambda x: x.map({'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4}).mean() 
                if x.dtype == object else x.mean()
            ),
            avg_income=(
                'Monthly Income' if 'Monthly Income' in df.columns else 'monthly_income',
                'mean'
            )
        ).reset_index()
        
        self.department_risks = {
            'departments': [],
            'overall_attrition_rate': float(df['_attrition_binary'].mean())
        }
        
        for _, row in dept_stats.iterrows():
            rate = float(row['attrition_rate'])
            risk_level = 'high' if rate > 0.20 else ('medium' if rate > 0.12 else 'low')
            self.department_risks['departments'].append({
                'name': str(row[role_col]),
                'total_employees': int(row['total_employees']),
                'attrition_count': int(row['attrition_count']),
                'attrition_rate': round(rate, 4),
                'risk_level': risk_level,
                'avg_satisfaction': round(float(row['avg_satisfaction']), 2) if pd.notna(row['avg_satisfaction']) else None,
                'avg_income': round(float(row['avg_income']), 0)
            })
        
        # Sort by attrition rate descending
        self.department_risks['departments'].sort(key=lambda x: x['attrition_rate'], reverse=True)

    def _save_all(self):
        """Save all models, metadata, and artifacts to disk."""
        for name, model in self.models.items():
            # Save model
            model_path = os.path.join(MODEL_DIR, f'attrition_{name}.joblib')
            joblib.dump(model, model_path)
            
            # Save metadata
            meta = {
                'metrics': self.metrics.get(name, {}),
                'feature_names': self.feature_names,
                'dataset_info': self.dataset_info,
                'trained_at': datetime.now().isoformat()
            }
            meta_path = os.path.join(MODEL_DIR, f'attrition_{name}_meta.json')
            with open(meta_path, 'w') as f:
                json.dump(meta, f, indent=2)
            
            # Save feature importance
            if name in self.feature_importance:
                fi_path = os.path.join(MODEL_DIR, f'attrition_{name}_fi.json')
                with open(fi_path, 'w') as f:
                    json.dump(self.feature_importance[name], f, indent=2)
            
            # Save confusion matrix
            if name in self.confusion_matrices:
                cm_path = os.path.join(MODEL_DIR, f'attrition_{name}_cm.json')
                with open(cm_path, 'w') as f:
                    json.dump(self.confusion_matrices[name], f, indent=2)
            
            # Save ROC data
            if name in self.roc_data:
                roc_path = os.path.join(MODEL_DIR, f'attrition_{name}_roc.json')
                with open(roc_path, 'w') as f:
                    json.dump(self.roc_data[name], f, indent=2)
        
        # Save scalers and encoders
        scaler_path = os.path.join(MODEL_DIR, 'attrition_scaler.joblib')
        joblib.dump(self.scalers, scaler_path)
        
        encoder_path = os.path.join(MODEL_DIR, 'attrition_encoders.joblib')
        joblib.dump(self.label_encoders, encoder_path)
        
        # Save department risks
        dept_path = os.path.join(MODEL_DIR, 'attrition_department_risks.json')
        with open(dept_path, 'w') as f:
            json.dump(self.department_risks, f, indent=2)

    def predict(self, employee_data: Dict, model_name: str = 'gradient_boosting') -> Dict:
        """Predict attrition risk for a single employee."""
        if model_name not in self.models:
            # Fallback to any available model
            available = list(self.models.keys())
            if not available:
                return {'error': 'No models trained. Call /train first.'}
            model_name = available[0]
        
        model = self.models[model_name]
        
        # Create a single-row DataFrame
        df = pd.DataFrame([employee_data])
        X, _, _ = self._preprocess(df, fit=False)
        
        # Predict
        prediction = model.predict(X)[0]
        probability = model.predict_proba(X)[0] if hasattr(model, 'predict_proba') else [0, 0]
        
        risk_score = float(probability[1])
        risk_level = 'high' if risk_score > 0.6 else ('medium' if risk_score > 0.3 else 'low')
        
        # Get top factors
        top_factors = []
        if model_name in self.feature_importance:
            fi = self.feature_importance[model_name]
            top_factors = fi['top_10'][:5]
        
        return {
            'prediction': 'Left' if prediction == 1 else 'Stayed',
            'risk_score': round(risk_score, 4),
            'risk_level': risk_level,
            'confidence': round(float(max(probability)), 4),
            'model_used': model_name,
            'top_factors': top_factors
        }

    def batch_predict(self, employees: List[Dict], model_name: str = 'gradient_boosting') -> Dict:
        """Predict attrition for multiple employees."""
        results = []
        for emp in employees:
            result = self.predict(emp, model_name)
            results.append(result)
        
        high_risk = sum(1 for r in results if r.get('risk_level') == 'high')
        medium_risk = sum(1 for r in results if r.get('risk_level') == 'medium')
        low_risk = sum(1 for r in results if r.get('risk_level') == 'low')
        
        return {
            'predictions': results,
            'summary': {
                'total': len(results),
                'high_risk': high_risk,
                'medium_risk': medium_risk,
                'low_risk': low_risk,
                'average_risk_score': round(np.mean([r.get('risk_score', 0) for r in results]), 4)
            }
        }

    def get_model_comparison(self) -> Dict:
        """Get side-by-side comparison of all trained models."""
        comparison = {
            'models': {},
            'best_model': None,
            'best_accuracy': 0,
            'dataset_info': self.dataset_info,
            'training_history': self.training_history[-5:] if self.training_history else []
        }
        
        for name in ['random_forest', 'gradient_boosting', 'logistic_regression']:
            if name in self.metrics:
                comparison['models'][name] = {
                    'metrics': self.metrics[name],
                    'feature_importance': self.feature_importance.get(name, {}),
                    'confusion_matrix': self.confusion_matrices.get(name, {}),
                    'roc_data': self.roc_data.get(name, {}),
                    'is_trained': self.is_trained.get(name, False)
                }
                
                acc = self.metrics[name].get('accuracy', 0)
                if acc > comparison['best_accuracy']:
                    comparison['best_accuracy'] = acc
                    comparison['best_model'] = name
        
        return comparison

    def get_department_risks(self) -> Dict:
        """Get department-level attrition risk breakdown."""
        return self.department_risks if self.department_risks else {
            'error': 'No department risk data available. Train the model first.'
        }

    def get_training_history(self) -> List[Dict]:
        """Get history of all training runs."""
        return self.training_history


# Singleton instance
attrition_model = EnhancedAttritionModel()
