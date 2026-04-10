from fastapi import APIRouter, HTTPException
from app.schemas.models import ForecastRequest, ForecastResponse, BudgetVarianceRequest, ProjectTimelineRequest
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
            accuracy_metrics=result.get("accuracy_metrics"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")


@router.get("/forecast/sample/{metric}")
async def get_sample_data(metric: str, days: int = 730):
    """Get synthetic historical data for a given metric (for testing)."""
    valid_metrics = ["revenue", "headcount", "budget_utilization", "project_completion", "resource_demand", "ticket_volume", "system_metrics"]
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


@router.post("/forecast/budget-variance")
async def predict_budget_variance(request: BudgetVarianceRequest):
    """Predict budget variance for departments using linear projection."""
    try:
        budgets = [b.model_dump() for b in request.department_budgets]
        result = forecast_model.predict_budget_variance(budgets)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Budget variance prediction failed: {str(e)}")


@router.get("/forecast/sample/budget-variance")
async def get_sample_budget_data():
    """Get sample budget data for testing budget variance prediction."""
    data = forecast_model.generate_sample_budget_data()
    return {"success": True, "data": data, "message": "Sample budget data generated"}


@router.post("/forecast/project-timeline")
async def predict_project_timeline(request: ProjectTimelineRequest):
    """Predict project completion date based on current velocity."""
    try:
        result = forecast_model.predict_project_timeline(
            progress_pct=request.progress_pct,
            start_date=request.start_date,
            expected_end_date=request.expected_end_date,
            days_elapsed=request.days_elapsed,
        )
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Project timeline prediction failed: {str(e)}")
