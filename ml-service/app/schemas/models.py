from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date


# ─── ATTRITION ──────────────────────────────────────────────

class AttritionFeatures(BaseModel):
    satisfaction_score: float = Field(..., ge=0, le=5, description="Employee satisfaction (0-5)")
    performance_score: float = Field(..., ge=0, le=5, description="Performance rating (0-5)")
    years_at_company: float = Field(..., ge=0, description="Years employed")
    overtime_hours_avg: float = Field(..., ge=0, description="Average monthly overtime hours")
    num_projects: int = Field(..., ge=0, description="Number of active projects")
    salary: float = Field(..., gt=0, description="Annual salary")
    days_since_last_promotion: int = Field(..., ge=0, description="Days since last promotion")
    department_id: Optional[str] = None


class AttritionPredictionRequest(BaseModel):
    employee_id: str
    features: AttritionFeatures


class AttritionBatchRequest(BaseModel):
    employees: List[AttritionPredictionRequest]


class AttritionFactor(BaseModel):
    factor: str
    importance: float


class AttritionPredictionResponse(BaseModel):
    employee_id: str
    risk_score: float
    risk_level: str
    top_factors: List[AttritionFactor]
    confidence: float


# ─── FORECASTING ────────────────────────────────────────────

class HistoricalDataPoint(BaseModel):
    date: str
    value: float


class ForecastRequest(BaseModel):
    metric: str = Field(..., description="Metric name: revenue, headcount, budget_utilization, project_completion")
    historical_data: List[HistoricalDataPoint] = Field(..., min_length=30, description="At least 30 data points")
    forecast_days: int = Field(default=90, ge=7, le=365, description="Days to forecast")


class ForecastPoint(BaseModel):
    date: str
    predicted: float
    lower_bound: float
    upper_bound: float


class ForecastResponse(BaseModel):
    metric: str
    forecast: List[ForecastPoint]
    model_info: dict


# ─── ANOMALY DETECTION ──────────────────────────────────────

class TimeSeriesPoint(BaseModel):
    timestamp: str
    value: float


class AnomalyRequest(BaseModel):
    metric: str
    data: List[TimeSeriesPoint] = Field(..., min_length=10, description="Time series data")
    contamination: float = Field(default=0.1, ge=0.01, le=0.5, description="Expected anomaly fraction")


class AnomalyResult(BaseModel):
    timestamp: str
    value: float
    is_anomaly: bool
    anomaly_score: float
    expected_min: float
    expected_max: float


class AnomalyResponse(BaseModel):
    metric: str
    total_points: int
    anomaly_count: int
    anomaly_rate: float
    results: List[AnomalyResult]


# ─── MODEL INFO ─────────────────────────────────────────────

class ModelMetrics(BaseModel):
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    mse: Optional[float] = None
    mae: Optional[float] = None


class ModelInfo(BaseModel):
    name: str
    type: str
    version: str
    status: str
    metrics: ModelMetrics
    trained_at: Optional[str] = None
    description: str


class TrainRequest(BaseModel):
    force_retrain: bool = Field(default=False, description="Force retraining even if model exists")


class TrainResponse(BaseModel):
    model_name: str
    version: str
    metrics: ModelMetrics
    message: str
