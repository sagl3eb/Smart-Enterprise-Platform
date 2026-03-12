from fastapi import APIRouter, HTTPException
from app.services import attrition_model, forecast_model, anomaly_model
from app.schemas.models import TrainRequest

router = APIRouter()


@router.get("/")
async def list_models():
    """List all available ML models and their status."""
    models = [
        attrition_model.get_model_info(),
        forecast_model.get_model_info(),
        anomaly_model.get_model_info(),
    ]

    return {
        "success": True,
        "data": models,
        "message": f"{len(models)} models available",
    }


@router.get("/{model_name}")
async def get_model(model_name: str):
    """Get detailed info about a specific model."""
    model_map = {
        "attrition": attrition_model.get_model_info,
        "attrition_classifier": attrition_model.get_model_info,
        "forecast": forecast_model.get_model_info,
        "time_series_forecaster": forecast_model.get_model_info,
        "anomaly": anomaly_model.get_model_info,
        "anomaly_detector": anomaly_model.get_model_info,
    }

    getter = model_map.get(model_name)
    if not getter:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' not found. Available: attrition, forecast, anomaly",
        )

    return {
        "success": True,
        "data": getter(),
        "message": f"Model info for {model_name}",
    }


@router.post("/train/{model_name}")
async def train_model(model_name: str, request: TrainRequest = TrainRequest()):
    """Trigger training for a specific model."""
    if model_name in ("attrition", "attrition_classifier"):
        result = attrition_model.train_model(force=request.force_retrain)
        return {"success": True, "data": result, "message": result["message"]}
    elif model_name in ("forecast", "time_series_forecaster"):
        return {
            "success": True,
            "data": {"message": "Forecast model trains on-demand with each prediction"},
            "message": "Forecast model is always ready",
        }
    elif model_name in ("anomaly", "anomaly_detector"):
        return {
            "success": True,
            "data": {"message": "Anomaly model trains on-demand with each detection"},
            "message": "Anomaly model is always ready",
        }
    else:
        raise HTTPException(
            status_code=404,
            detail=f"Model '{model_name}' not found. Available: attrition, forecast, anomaly",
        )
