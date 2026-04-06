"""
SEP — Enhanced Attrition Router
New endpoints for model comparison, department-level risks, visualizations
Author: Saqqaf Al-Yazidi (TP075880)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.services.attrition_model import attrition_model

router = APIRouter(prefix="/predict/attrition", tags=["Attrition Prediction"])


class TrainRequest(BaseModel):
    models: Optional[List[str]] = None  # e.g. ["random_forest", "gradient_boosting", "logistic_regression"]


class PredictRequest(BaseModel):
    employee_data: Dict[str, Any]
    model_name: Optional[str] = "gradient_boosting"


class BatchPredictRequest(BaseModel):
    employees: List[Dict[str, Any]]
    model_name: Optional[str] = "gradient_boosting"


@router.post("/train")
async def train_models(request: TrainRequest = TrainRequest()):
    """
    Train attrition models on the 56k dataset.
    Trains Random Forest, LightGBM, and Logistic Regression.
    Returns metrics, confusion matrices, ROC data, and feature importance for each.
    """
    try:
        result = attrition_model.train(models_to_train=request.models)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/predict")
async def predict_attrition(request: PredictRequest):
    """Predict attrition risk for a single employee."""
    try:
        result = attrition_model.predict(request.employee_data, request.model_name)
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/batch")
async def batch_predict(request: BatchPredictRequest):
    """Predict attrition risk for multiple employees."""
    try:
        result = attrition_model.batch_predict(request.employees, request.model_name)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


@router.get("/models/comparison")
async def get_model_comparison():
    """
    Get side-by-side comparison of all trained models.
    Returns metrics, feature importance, confusion matrices, and ROC data.
    """
    comparison = attrition_model.get_model_comparison()
    if not comparison['models']:
        raise HTTPException(
            status_code=404, 
            detail="No models trained yet. Call POST /predict/attrition/train first."
        )
    return comparison


@router.get("/feature-importance")
async def get_feature_importance(model_name: Optional[str] = None):
    """Get feature importance for a specific model or all models."""
    if model_name:
        if model_name not in attrition_model.feature_importance:
            raise HTTPException(status_code=404, detail=f"No feature importance for {model_name}")
        return {model_name: attrition_model.feature_importance[model_name]}
    return attrition_model.feature_importance


@router.get("/confusion-matrix")
async def get_confusion_matrix(model_name: Optional[str] = None):
    """Get confusion matrix for a specific model or all models."""
    if model_name:
        if model_name not in attrition_model.confusion_matrices:
            raise HTTPException(status_code=404, detail=f"No confusion matrix for {model_name}")
        return {model_name: attrition_model.confusion_matrices[model_name]}
    return attrition_model.confusion_matrices


@router.get("/roc-curve")
async def get_roc_curve(model_name: Optional[str] = None):
    """Get ROC curve data for a specific model or all models."""
    if model_name:
        if model_name not in attrition_model.roc_data:
            raise HTTPException(status_code=404, detail=f"No ROC data for {model_name}")
        return {model_name: attrition_model.roc_data[model_name]}
    return attrition_model.roc_data


@router.get("/department-risks")
async def get_department_risks():
    """Get attrition risk breakdown by department/job role."""
    risks = attrition_model.get_department_risks()
    if 'error' in risks:
        raise HTTPException(status_code=404, detail=risks['error'])
    return risks


@router.get("/training-history")
async def get_training_history():
    """Get history of all training runs with timestamps and metrics."""
    history = attrition_model.get_training_history()
    return {'history': history, 'total_runs': len(history)}
