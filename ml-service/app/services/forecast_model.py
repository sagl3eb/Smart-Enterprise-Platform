import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sklearn.metrics import mean_absolute_error, mean_squared_error

MODEL_DIR = os.getenv("MODEL_DIR", os.path.join(os.path.dirname(__file__), "..", "models"))

_prophet_available = False
try:
    from prophet import Prophet
    _prophet_available = True
except ImportError:
    pass

_metrics: Dict = {}
_version: str = "1.0.0"
_trained_at: Optional[str] = None


def forecast(metric: str, historical_data: List[Dict], forecast_days: int = 90) -> Dict:
    df = pd.DataFrame(historical_data)
    df.columns = ["ds", "y"]
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = pd.to_numeric(df["y"], errors="coerce")
    df = df.dropna()

    if len(df) < 30:
        raise ValueError("Need at least 30 data points for forecasting")

    if _prophet_available:
        return _forecast_prophet(metric, df, forecast_days)
    else:
        return _forecast_fallback(metric, df, forecast_days)


def _forecast_prophet(metric: str, df: pd.DataFrame, forecast_days: int) -> Dict:
    global _metrics, _version, _trained_at

    model = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=True,
        changepoint_prior_scale=0.05,
        interval_width=0.95,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=forecast_days)
    forecast_df = model.predict(future)

    forecast_only = forecast_df.tail(forecast_days)

    # Calculate in-sample metrics
    in_sample = forecast_df.head(len(df))
    actuals = df["y"].values
    predictions = in_sample["yhat"].values[:len(actuals)]
    mse = float(np.mean((actuals - predictions) ** 2))
    mae = float(np.mean(np.abs(actuals - predictions)))

    _metrics = {"mse": round(mse, 4), "mae": round(mae, 4)}
    _version = f"1.0.{int(datetime.now().timestamp()) % 10000}"
    _trained_at = datetime.now().isoformat()

    forecast_points = []
    for _, row in forecast_only.iterrows():
        forecast_points.append({
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted": round(float(row["yhat"]), 2),
            "lower_bound": round(float(row["yhat_lower"]), 2),
            "upper_bound": round(float(row["yhat_upper"]), 2),
        })

    # 80/20 validation split for accuracy metrics
    split_idx = int(len(df) * 0.8)
    val_actuals = df["y"].values[split_idx:]
    val_predictions = in_sample["yhat"].values[split_idx:len(df)]
    accuracy_metrics = compute_accuracy_metrics(val_actuals.tolist(), val_predictions.tolist())

    return {
        "metric": metric,
        "forecast": forecast_points,
        "model_info": {
            "algorithm": "Prophet",
            "version": _version,
            "training_points": len(df),
            "forecast_days": forecast_days,
            "metrics": _metrics,
        },
        "accuracy_metrics": accuracy_metrics,
    }

def compute_accuracy_metrics(actual: list, predicted: list) -> dict:
    """
    Compute forecast accuracy metrics: MAPE, RMSE, MAE, R².
    These are shown on the frontend so users can assess forecast reliability.
    """
    actual = np.array(actual, dtype=float)
    predicted = np.array(predicted, dtype=float)
    
    # Remove zero/nan values for MAPE calculation
    mask = (actual != 0) & ~np.isnan(actual) & ~np.isnan(predicted)
    actual_clean = actual[mask]
    predicted_clean = predicted[mask]
    
    if len(actual_clean) == 0:
        return {'mape': None, 'rmse': None, 'mae': None, 'r_squared': None}
    
    # MAPE - Mean Absolute Percentage Error
    mape = float(np.mean(np.abs((actual_clean - predicted_clean) / actual_clean)) * 100)
    
    # RMSE - Root Mean Squared Error
    rmse = float(np.sqrt(mean_squared_error(actual_clean, predicted_clean)))
    
    # MAE - Mean Absolute Error
    mae = float(mean_absolute_error(actual_clean, predicted_clean))
    
    # R² - Coefficient of Determination
    ss_res = np.sum((actual_clean - predicted_clean) ** 2)
    ss_tot = np.sum((actual_clean - np.mean(actual_clean)) ** 2)
    r_squared = float(1 - (ss_res / ss_tot)) if ss_tot != 0 else 0.0
    
    return {
        'mape': round(mape, 2),           # Lower is better, < 10% is excellent
        'rmse': round(rmse, 2),            # Lower is better
        'mae': round(mae, 2),             # Lower is better
        'r_squared': round(r_squared, 4),  # Closer to 1.0 is better
        'interpretation': {
            'mape_quality': 'Excellent' if mape < 10 else ('Good' if mape < 20 else ('Fair' if mape < 30 else 'Poor')),
            'r_squared_quality': 'Excellent' if r_squared > 0.9 else ('Good' if r_squared > 0.7 else ('Fair' if r_squared > 0.5 else 'Poor'))
        }
    }

def _forecast_fallback(metric: str, df: pd.DataFrame, forecast_days: int) -> Dict:
    """Simple linear regression fallback when Prophet is not available."""
    global _metrics, _version, _trained_at

    df = df.sort_values("ds").reset_index(drop=True)
    x = np.arange(len(df)).astype(float)
    y = df["y"].values.astype(float)

    # Linear regression
    n = len(x)
    x_mean = np.mean(x)
    y_mean = np.mean(y)
    slope = np.sum((x - x_mean) * (y - y_mean)) / np.sum((x - x_mean) ** 2)
    intercept = y_mean - slope * x_mean

    # In-sample metrics
    predictions = slope * x + intercept
    residuals = y - predictions
    std_residual = float(np.std(residuals))
    mse = float(np.mean(residuals ** 2))
    mae = float(np.mean(np.abs(residuals)))

    _metrics = {"mse": round(mse, 4), "mae": round(mae, 4)}
    _version = f"1.0.{int(datetime.now().timestamp()) % 10000}"
    _trained_at = datetime.now().isoformat()

    # 80/20 validation split for accuracy metrics
    split_idx = int(len(x) * 0.8)
    val_actuals = y[split_idx:]
    val_predictions = predictions[split_idx:]
    accuracy_metrics = compute_accuracy_metrics(val_actuals.tolist(), val_predictions.tolist())

    last_date = df["ds"].max()
    forecast_points = []
    for i in range(1, forecast_days + 1):
        future_x = n + i - 1
        pred = slope * future_x + intercept
        forecast_date = last_date + timedelta(days=i)
        forecast_points.append({
            "date": forecast_date.strftime("%Y-%m-%d"),
            "predicted": round(float(pred), 2),
            "lower_bound": round(float(pred - 1.96 * std_residual), 2),
            "upper_bound": round(float(pred + 1.96 * std_residual), 2),
        })

    return {
        "metric": metric,
        "forecast": forecast_points,
        "model_info": {
            "algorithm": "Linear Regression (Prophet unavailable)",
            "version": _version,
            "training_points": len(df),
            "forecast_days": forecast_days,
            "metrics": _metrics,
        },
        "accuracy_metrics": accuracy_metrics,
    }


def get_model_info() -> Dict:
    return {
        "name": "time_series_forecaster",
        "type": "Prophet / Linear Regression Fallback",
        "version": _version,
        "status": "active",
        "metrics": _metrics,
        "trained_at": _trained_at,
        "description": "Forecasts time series metrics (revenue, headcount, budget, project completion) using Facebook Prophet or linear regression fallback.",
        "prophet_available": _prophet_available,
    }


def predict_budget_variance(department_budgets: List[Dict]) -> Dict:
    """Predict budget variance for each department using linear projection."""
    departments = []
    total_at_risk = 0

    for dept in department_budgets:
        name = dept["department"]
        allocated = dept["allocated"]
        spent = dept["spent_to_date"]
        months_elapsed = dept["months_elapsed"]
        total_months = dept["total_months"]

        # Linear projection: monthly burn rate extrapolated to full period
        if months_elapsed > 0:
            monthly_rate = spent / months_elapsed
            predicted_spending = round(monthly_rate * total_months, 2)
        else:
            predicted_spending = 0.0

        predicted_variance = round(predicted_spending - allocated, 2)
        variance_pct = round((predicted_variance / allocated) * 100, 2) if allocated else 0.0

        if variance_pct > 5:
            risk_level = "over_budget"
            total_at_risk += 1
        elif variance_pct < -5:
            risk_level = "under_budget"
        else:
            risk_level = "on_track"

        departments.append({
            "department": name,
            "allocated": allocated,
            "predicted_spending": predicted_spending,
            "predicted_variance": predicted_variance,
            "variance_pct": variance_pct,
            "risk_level": risk_level,
        })

    return {
        "departments": departments,
        "summary": {
            "total_at_risk": total_at_risk,
            "total_departments": len(departments),
        },
    }


def generate_sample_budget_data() -> List[Dict]:
    """Return sample budget data for 6 departments for testing."""
    return [
        {"department": "Engineering", "allocated": 500000, "spent_to_date": 280000, "months_elapsed": 6, "total_months": 12},
        {"department": "Marketing", "allocated": 200000, "spent_to_date": 130000, "months_elapsed": 6, "total_months": 12},
        {"department": "HR", "allocated": 150000, "spent_to_date": 70000, "months_elapsed": 6, "total_months": 12},
        {"department": "Sales", "allocated": 300000, "spent_to_date": 180000, "months_elapsed": 6, "total_months": 12},
        {"department": "Operations", "allocated": 250000, "spent_to_date": 160000, "months_elapsed": 6, "total_months": 12},
        {"department": "Finance", "allocated": 100000, "spent_to_date": 45000, "months_elapsed": 6, "total_months": 12},
    ]


def predict_project_timeline(progress_pct: float, start_date: str, expected_end_date: str, days_elapsed: int) -> Dict:
    """Predict project completion date based on current velocity."""
    from datetime import datetime, timedelta

    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
    expected_end_dt = datetime.strptime(expected_end_date, "%Y-%m-%d")
    total_planned_days = (expected_end_dt - start_dt).days

    # Current velocity: percent completed per day
    velocity_per_day = progress_pct / days_elapsed if days_elapsed > 0 else 0.0
    remaining_pct = 100.0 - progress_pct

    # Required velocity to finish on time
    remaining_planned_days = total_planned_days - days_elapsed
    required_velocity = remaining_pct / remaining_planned_days if remaining_planned_days > 0 else float("inf")

    # Predicted days to complete remaining work
    if velocity_per_day > 0:
        days_to_complete = remaining_pct / velocity_per_day
        predicted_end_dt = start_dt + timedelta(days=days_elapsed + days_to_complete)
    else:
        # No progress: can't predict
        predicted_end_dt = expected_end_dt + timedelta(days=365)
        days_to_complete = 365 + remaining_planned_days

    days_delay = round((predicted_end_dt - expected_end_dt).total_seconds() / 86400, 1)
    on_track = days_delay <= 0

    # Confidence based on how close velocity is to required
    if required_velocity > 0 and velocity_per_day > 0:
        ratio = velocity_per_day / required_velocity
        confidence = round(min(ratio, 1.0) * 100, 1)
    else:
        confidence = 0.0

    return {
        "predicted_end_date": predicted_end_dt.strftime("%Y-%m-%d"),
        "days_delay": days_delay,
        "on_track": on_track,
        "confidence": confidence,
        "velocity_per_day": round(velocity_per_day, 4),
        "required_velocity": round(required_velocity, 4),
    }


def generate_sample_historical_data(metric: str, days: int = 730) -> List[Dict]:
    """Generate 2 years of synthetic daily data for a metric."""
    np.random.seed(hash(metric) % 2**31)
    dates = pd.date_range(end=datetime.now(), periods=days, freq="D")

    if metric == "revenue":
        base = 50000
        trend = np.linspace(0, 15000, days)
        seasonality = 5000 * np.sin(np.arange(days) * 2 * np.pi / 365)
        noise = np.random.normal(0, 2000, days)
        values = base + trend + seasonality + noise
    elif metric == "headcount":
        base = 45
        trend = np.linspace(0, 15, days)
        noise = np.random.normal(0, 1, days)
        values = base + trend + noise
        values = np.round(values).clip(min=30)
    elif metric == "budget_utilization":
        base = 60
        trend = np.linspace(0, 20, days)
        seasonality = 5 * np.sin(np.arange(days) * 2 * np.pi / 90)
        noise = np.random.normal(0, 3, days)
        values = (base + trend + seasonality + noise).clip(0, 100)
    elif metric == "project_completion":
        base = 70
        trend = np.linspace(0, 10, days)
        noise = np.random.normal(0, 5, days)
        values = (base + trend + noise).clip(0, 100)
    elif metric == "resource_demand":
        base = 25
        # Weekday/weekend pattern: +5 weekdays, -5 weekends
        day_of_week = np.array([dates[i].weekday() for i in range(days)])
        weekday_effect = np.where(day_of_week < 5, 5, -5)
        # Seasonal peaks in Q4 (Oct-Dec) and Q1 (Jan-Mar)
        month = np.array([dates[i].month for i in range(days)])
        seasonal = np.where((month >= 10) | (month <= 3), 8, 0)
        noise = np.random.normal(0, 2, days)
        values = (base + weekday_effect + seasonal + noise).clip(min=0)
        values = np.round(values)
    elif metric == "ticket_volume":
        base = 15
        trend = np.linspace(0, 5, days)
        # Weekday spikes
        day_of_week = np.array([dates[i].weekday() for i in range(days)])
        weekday_effect = np.where(day_of_week < 5, 8, -3)
        # Monday spikes (backlog from weekend)
        monday_spike = np.where(day_of_week == 0, 5, 0)
        noise = np.random.normal(0, 3, days)
        values = (base + trend + weekday_effect + monday_spike + noise).clip(min=0)
        values = np.round(values)
    elif metric == "system_metrics":
        base = 50  # CPU/memory utilization %
        trend = np.linspace(0, 10, days)
        # Daily pattern: higher during business hours (simulated as weekday)
        day_of_week = np.array([dates[i].weekday() for i in range(days)])
        weekday_effect = np.where(day_of_week < 5, 15, -5)
        # Occasional spikes (simulating deployments, incidents)
        spikes = np.zeros(days)
        spike_indices = np.random.choice(days, size=int(days * 0.03), replace=False)
        spikes[spike_indices] = np.random.uniform(15, 35, len(spike_indices))
        noise = np.random.normal(0, 4, days)
        values = (base + trend + weekday_effect + spikes + noise).clip(0, 100)
    else:
        base = 100
        trend = np.linspace(0, 20, days)
        noise = np.random.normal(0, 10, days)
        values = base + trend + noise

    return [
        {"date": d.strftime("%Y-%m-%d"), "value": round(float(v), 2)}
        for d, v in zip(dates, values)
    ]
