"""
Synthetic Data Generator for Smart Enterprise Platform
Generates realistic CSV datasets for ML model training.

Usage: python -m app.data.generate_data
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

OUTPUT_DIR = os.path.join(os.path.dirname(__file__))
np.random.seed(42)


def generate_attrition_data(n: int = 500) -> pd.DataFrame:
    """Generate synthetic employee attrition dataset."""
    satisfaction = np.random.uniform(1.0, 5.0, n)
    performance = np.random.uniform(1.5, 5.0, n)
    years = np.random.exponential(4, n).clip(0.5, 25)
    overtime = np.random.exponential(8, n).clip(0, 60)
    projects = np.random.randint(1, 8, n)
    salary = np.random.normal(65000, 20000, n).clip(30000, 150000)
    days_promo = np.random.exponential(400, n).clip(30, 3000).astype(int)

    departments = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations"]
    dept_ids = np.random.choice(departments, n)

    attrition_prob = (
        0.25 * (5 - satisfaction) / 4
        + 0.10 * (5 - performance) / 4
        + 0.10 * np.clip(overtime / 40, 0, 1)
        + 0.15 * np.clip(days_promo / 1500, 0, 1)
        + 0.10 * np.clip(projects / 7, 0, 1)
        - 0.15 * np.clip(salary / 150000, 0, 1)
        - 0.05 * np.clip(years / 15, 0, 1)
        + np.random.normal(0, 0.08, n)
    )
    attrition = (np.clip(attrition_prob, 0, 1) > 0.45).astype(int)

    return pd.DataFrame({
        "satisfaction_score": np.round(satisfaction, 2),
        "performance_score": np.round(performance, 2),
        "years_at_company": np.round(years, 1),
        "overtime_hours_avg": np.round(overtime, 1),
        "num_projects": projects,
        "salary": np.round(salary, 2),
        "days_since_last_promotion": days_promo,
        "department": dept_ids,
        "attrition": attrition,
    })


def generate_revenue_data(days: int = 730) -> pd.DataFrame:
    """Generate 2 years of daily revenue data."""
    dates = pd.date_range(end=datetime.now(), periods=days, freq="D")
    base = 50000
    trend = np.linspace(0, 15000, days)
    seasonality = 5000 * np.sin(np.arange(days) * 2 * np.pi / 365)
    weekly = 2000 * np.sin(np.arange(days) * 2 * np.pi / 7)
    noise = np.random.normal(0, 2000, days)
    values = base + trend + seasonality + weekly + noise

    return pd.DataFrame({"date": dates.strftime("%Y-%m-%d"), "value": np.round(values, 2)})


def generate_headcount_data(days: int = 730) -> pd.DataFrame:
    """Generate 2 years of daily headcount data."""
    dates = pd.date_range(end=datetime.now(), periods=days, freq="D")
    base = 45
    trend = np.linspace(0, 15, days)
    noise = np.random.normal(0, 0.5, days)
    values = np.round(base + trend + noise).clip(min=30)

    return pd.DataFrame({"date": dates.strftime("%Y-%m-%d"), "value": values.astype(int)})


def generate_budget_utilization_data(days: int = 730) -> pd.DataFrame:
    """Generate 2 years of budget utilization % data."""
    dates = pd.date_range(end=datetime.now(), periods=days, freq="D")
    base = 60
    trend = np.linspace(0, 20, days)
    seasonality = 5 * np.sin(np.arange(days) * 2 * np.pi / 90)
    noise = np.random.normal(0, 3, days)
    values = np.clip(base + trend + seasonality + noise, 0, 100)

    return pd.DataFrame({"date": dates.strftime("%Y-%m-%d"), "value": np.round(values, 2)})


def generate_system_health_data(days: int = 90) -> pd.DataFrame:
    """Generate 90 days of system health metrics (for anomaly detection)."""
    records = []
    metrics = ["cpu_usage", "memory_usage", "disk_io", "network_latency", "error_rate"]
    base_values = {"cpu_usage": 45, "memory_usage": 60, "disk_io": 30, "network_latency": 15, "error_rate": 2}
    stds = {"cpu_usage": 10, "memory_usage": 8, "disk_io": 8, "network_latency": 5, "error_rate": 1}

    for metric in metrics:
        base = base_values[metric]
        std = stds[metric]
        for i in range(days * 24):  # hourly
            timestamp = datetime.now() - timedelta(hours=days * 24 - i)
            value = base + np.random.normal(0, std)

            # Inject anomalies (~5%)
            if np.random.random() < 0.05:
                value = base + np.random.choice([-1, 1]) * std * np.random.uniform(3, 5)

            records.append({
                "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "metric": metric,
                "value": round(max(0, value), 2),
            })

    return pd.DataFrame(records)


def generate_workforce_survey_data(n_respondents: int = 200) -> pd.DataFrame:
    """Generate survey response data."""
    questions = [
        "Overall job satisfaction",
        "Work-life balance",
        "Management effectiveness",
        "Career growth opportunities",
        "Team collaboration",
        "Compensation fairness",
        "Work environment",
        "Communication quality",
    ]

    records = []
    for i in range(n_respondents):
        dept = np.random.choice(["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations"])
        base_satisfaction = np.random.normal(3.5, 0.8)

        for q in questions:
            score = base_satisfaction + np.random.normal(0, 0.5)
            score = round(min(5, max(1, score)), 1)
            records.append({
                "respondent_id": f"EMP-{i+1:04d}",
                "department": dept,
                "question": q,
                "score": score,
            })

    return pd.DataFrame(records)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Generating attrition data...")
    attrition_df = generate_attrition_data(500)
    attrition_df.to_csv(os.path.join(OUTPUT_DIR, "attrition_data.csv"), index=False)
    print(f"  → {len(attrition_df)} rows, attrition rate: {attrition_df['attrition'].mean():.2%}")

    print("Generating revenue data...")
    revenue_df = generate_revenue_data(730)
    revenue_df.to_csv(os.path.join(OUTPUT_DIR, "revenue_data.csv"), index=False)
    print(f"  → {len(revenue_df)} rows")

    print("Generating headcount data...")
    headcount_df = generate_headcount_data(730)
    headcount_df.to_csv(os.path.join(OUTPUT_DIR, "headcount_data.csv"), index=False)
    print(f"  → {len(headcount_df)} rows")

    print("Generating budget utilization data...")
    budget_df = generate_budget_utilization_data(730)
    budget_df.to_csv(os.path.join(OUTPUT_DIR, "budget_utilization_data.csv"), index=False)
    print(f"  → {len(budget_df)} rows")

    print("Generating system health data...")
    health_df = generate_system_health_data(90)
    health_df.to_csv(os.path.join(OUTPUT_DIR, "system_health_data.csv"), index=False)
    print(f"  → {len(health_df)} rows")

    print("Generating workforce survey data...")
    survey_df = generate_workforce_survey_data(200)
    survey_df.to_csv(os.path.join(OUTPUT_DIR, "survey_data.csv"), index=False)
    print(f"  → {len(survey_df)} rows")

    print("\nAll datasets generated successfully!")


if __name__ == "__main__":
    main()
