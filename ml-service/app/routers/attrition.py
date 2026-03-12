from fastapi import APIRouter, HTTPException
from app.schemas.models import (
    AttritionPredictionRequest,
    AttritionBatchRequest,
    AttritionPredictionResponse,
    TrainRequest,
    TrainResponse,
)
from app.services import attrition_model
from typing import List

router = APIRouter()


@router.post("/attrition", response_model=AttritionPredictionResponse)
async def predict_attrition(request: AttritionPredictionRequest):
    """Predict attrition risk for a single employee."""
    try:
        features = request.features.model_dump()
        result = attrition_model.predict(features)
        return AttritionPredictionResponse(
            employee_id=request.employee_id,
            risk_score=result["risk_score"],
            risk_level=result["risk_level"],
            top_factors=result["top_factors"],
            confidence=result["confidence"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/attrition/batch", response_model=List[AttritionPredictionResponse])
async def predict_attrition_batch(request: AttritionBatchRequest):
    """Predict attrition risk for multiple employees."""
    try:
        results = []
        for emp in request.employees:
            features = emp.features.model_dump()
            result = attrition_model.predict(features)
            results.append(AttritionPredictionResponse(
                employee_id=emp.employee_id,
                risk_score=result["risk_score"],
                risk_level=result["risk_level"],
                top_factors=result["top_factors"],
                confidence=result["confidence"],
            ))
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


@router.post("/attrition/train")
async def train_attrition_model(request: TrainRequest = TrainRequest()):
    """Train or retrain the attrition model."""
    try:
        result = attrition_model.train_model(force=request.force_retrain)
        return {
            "success": True,
            "data": result,
            "message": result["message"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")
