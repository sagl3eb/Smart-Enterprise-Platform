from fastapi import APIRouter, HTTPException
from app.schemas.models import ForecastRequest, ForecastResponse
from app.services import forecast_model

router = APIRouter()


@router.post("/forecast", response_model=ForecastResponse)
async def predict_forecast(request: ForecastRequest):
    """Generate time series forecast for a metric."""
    try:
        historical = [{"date": dp.date, "value": dp.value} for dp in request.historical_data]
        result = forecast_model.forecast(
            metric=request.metric,
            historical_data=historical,
            forecast_days=request.forecast_days,
        )
        return ForecastResponse(
            metric=result["metric"],
            forecast=result["forecast"],
            model_info=result["model_info"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")


@router.get("/forecast/sample/{metric}")
async def get_sample_data(metric: str, days: int = 730):
    """Get synthetic historical data for a given metric (for testing)."""
    valid_metrics = ["revenue", "headcount", "budget_utilization", "project_completion"]
    if metric not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Metric must be one of: {', '.join(valid_metrics)}",
        )

    data = forecast_model.generate_sample_historical_data(metric, days)
    return {
        "success": True,
        "data": {
            "metric": metric,
            "points": len(data),
            "data": data,
        },
        "message": f"Sample data for {metric} generated",
    }
