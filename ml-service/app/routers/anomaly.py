from fastapi import APIRouter, HTTPException
from app.schemas.models import AnomalyRequest, AnomalyResponse
from app.services import anomaly_model

router = APIRouter()


@router.post("/anomaly/detect", response_model=AnomalyResponse)
async def detect_anomalies(request: AnomalyRequest):
    """Detect anomalies in time series data."""
    try:
        data = [{"timestamp": dp.timestamp, "value": dp.value} for dp in request.data]
        result = anomaly_model.detect_anomalies(
            metric=request.metric,
            data=data,
            contamination=request.contamination,
        )
        return AnomalyResponse(
            metric=result["metric"],
            total_points=result["total_points"],
            anomaly_count=result["anomaly_count"],
            anomaly_rate=result["anomaly_rate"],
            results=result["results"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")
