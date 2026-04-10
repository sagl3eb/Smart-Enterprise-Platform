"""
SEP — Equipment Failure Prediction Router
Endpoints for training, predicting, and summarising IT asset failure risk.
Author: Saqqaf Al-Yazidi (TP075880)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from app.services.equipment_model import equipment_model

router = APIRouter(prefix="/predict/equipment", tags=["Equipment Failure Prediction"])


# --------------- Request / Response models ---------------

class AssetPredictRequest(BaseModel):
    asset_data: Dict[str, Any]


class BatchPredictRequest(BaseModel):
    assets: List[Dict[str, Any]]


# --------------- Endpoints ---------------

@router.post("/train")
async def train_model():
    """
    Train the equipment failure prediction model on synthetic data.
    Returns accuracy, precision, recall, F1, and feature importance.
    """
    try:
        result = equipment_model.train()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")


@router.post("/predict")
async def predict_failure(request: AssetPredictRequest):
    """
    Predict failure risk for a single asset.

    Expected fields in `asset_data`:
      asset_type, age_years, usage_hours_daily, maintenance_count,
      days_since_last_maintenance, brand, warranty_expired
    """
    try:
        result = equipment_model.predict(request.asset_data)
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/batch")
async def batch_predict(request: BatchPredictRequest):
    """Predict failure risk for multiple assets at once."""
    try:
        result = equipment_model.batch_predict(request.assets)
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


@router.get("/summary")
async def get_fleet_summary():
    """
    Get fleet health overview: risk distribution, model metrics, feature importance.
    """
    summary = equipment_model.get_fleet_summary()
    if 'error' in summary:
        raise HTTPException(status_code=404, detail=summary['error'])
    return summary
