"""
Data Generator for Smart Enterprise Platform
Generates realistic datasets modeled after IBM HR Analytics Employee Attrition dataset.
1,470 employee records with 35 features for ML training.

Usage: python -m app.data.generate_data
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

OUTPUT_DIR = os.path.join(os.path.dirname(__file__))
np.random.seed(42)


def generate_attrition_data(n: int = 1470) -> pd.DataFrame:
    """
    Generate realistic employee attrition dataset modeled after IBM HR Analytics.
    Features match industry-standard HR analytics research datasets.
    1,470 records with ~16% attrition rate (matching IBM dataset).
    """
    # Demographics
    age = np.random.randint(18, 60, n)
    gender = np.random.choice(["Male", "Female"], n, p=[0.6, 0.4])
    marital_status = np.random.choice(
        ["Single", "Married", "Divorced"], n, p=[0.32, 0.46, 0.22]
    )
    education = np.random.choice([1, 2, 3, 4, 5], n, p=[0.11, 0.19, 0.28, 0.27, 0.15])
    education_field = np.random.choice(
        ["Life Sciences", "Medical", "Marketing", "Technical Degree", "Human Resources", "Other"],
        n, p=[0.37, 0.20, 0.11, 0.18, 0.05, 0.09]
    )

    # Job details
    departments = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations"]
    department = np.random.choice(departments, n, p=[0.25, 0.20, 0.15, 0.10, 0.15, 0.15])
    job_level = np.random.choice([1, 2, 3, 4, 5], n, p=[0.35, 0.30, 0.20, 0.10, 0.05])
    job_involvement = np.random.choice([1, 2, 3, 4], n, p=[0.05, 0.20, 0.55, 0.20])
    
    # Experience & tenure
    total_working_years = np.clip(age - 18 - np.random.randint(0, 5, n), 0, 40).astype(int)
    years_at_company = np.clip(
        np.random.exponential(5, n), 0, total_working_years
    ).astype(int)
    years_in_role = np.clip(
        np.random.exponential(3, n), 0, years_at_company
    ).astype(int)
    years_since_promotion = np.clip(
        np.random.exponential(2, n), 0, years_at_company
    ).astype(int)
    years_with_manager = np.clip(
        np.random.exponential(3, n), 0, years_at_company
    ).astype(int)
    num_companies_worked = np.clip(
        np.random.poisson(2, n), 0, 9
    ).astype(int)
    training_times_last_year = np.random.randint(0, 7, n)

    # Compensation
    base_salary = {1: 2500, 2: 5000, 3: 9000, 4: 14000, 5: 19000}
    monthly_income = np.array([
        int(base_salary[lv] + np.random.normal(0, base_salary[lv] * 0.25))
        for lv in job_level
    ]).clip(1000, 25000)
    daily_rate = np.random.randint(100, 1500, n)
    hourly_rate = np.random.randint(30, 100, n)
    monthly_rate = np.random.randint(2000, 27000, n)
    percent_salary_hike = np.random.randint(11, 25, n)
    stock_option_level = np.random.choice([0, 1, 2, 3], n, p=[0.40, 0.30, 0.20, 0.10])

    # Satisfaction & performance (1-4 scale, matching IBM format)
    environment_satisfaction = np.random.choice([1, 2, 3, 4], n, p=[0.12, 0.18, 0.35, 0.35])
    job_satisfaction = np.random.choice([1, 2, 3, 4], n, p=[0.14, 0.16, 0.34, 0.36])
    relationship_satisfaction = np.random.choice([1, 2, 3, 4], n, p=[0.10, 0.20, 0.35, 0.35])
    work_life_balance = np.random.choice([1, 2, 3, 4], n, p=[0.05, 0.18, 0.50, 0.27])
    performance_rating = np.random.choice([3, 4], n, p=[0.85, 0.15])  # IBM only has 3 & 4

    # Work conditions
    overtime = np.random.choice(["Yes", "No"], n, p=[0.28, 0.72])
    business_travel = np.random.choice(
        ["Non-Travel", "Travel_Rarely", "Travel_Frequently"],
        n, p=[0.12, 0.71, 0.17]
    )
    distance_from_home = np.random.randint(1, 30, n)
    num_projects = np.random.randint(1, 8, n)
    overtime_hours_avg = np.where(
        overtime == "Yes",
        np.random.exponential(15, n).clip(5, 50),
        np.random.exponential(3, n).clip(0, 10)
    ).round(1)

    # Derive satisfaction_score (1-5 scale for our model) from IBM-style features
    satisfaction_score = (
        (job_satisfaction / 4) * 2.5 +
        (environment_satisfaction / 4) * 1.5 +
        (work_life_balance / 4) * 1.0
    ).clip(1.0, 5.0).round(2)

    # Derive performance_score (1-5) 
    performance_score = (
        (performance_rating / 4) * 3.0 +
        (job_involvement / 4) * 2.0
    ).clip(1.0, 5.0).round(2)

    # Salary for our model (annual)
    salary = (monthly_income * 12).astype(float)

    # Days since last promotion
    days_since_last_promotion = (years_since_promotion * 365 + np.random.randint(0, 365, n)).clip(30, 3000)

    # ── Calculate attrition probability ─────────────────────
    # Based on IBM HR research factors
    attrition_prob = (
        0.20 * (4 - job_satisfaction) / 3          # Low satisfaction → leave
        + 0.15 * (4 - environment_satisfaction) / 3  # Bad environment → leave  
        + 0.12 * (overtime == "Yes").astype(float)   # Overtime → leave
        + 0.10 * np.clip(distance_from_home / 30, 0, 1)  # Long commute → leave
        + 0.08 * (4 - work_life_balance) / 3         # Poor balance → leave
        + 0.08 * np.clip(years_since_promotion / 5, 0, 1)  # No promotion → leave
        - 0.10 * np.clip(monthly_income / 20000, 0, 1)     # High pay → stay
        - 0.08 * np.clip(stock_option_level / 3, 0, 1)     # Stock → stay
        - 0.05 * np.clip(years_at_company / 15, 0, 1)      # Tenure → stay
        + 0.05 * (business_travel == "Travel_Frequently").astype(float)
        + 0.03 * (marital_status == "Single").astype(float)  # Single → more mobile
        + np.random.normal(0, 0.06, n)
    )
    attrition = (np.clip(attrition_prob, 0, 1) > 0.38).astype(int)

    # Ensure ~16% attrition rate like IBM dataset
    current_rate = attrition.mean()
    if current_rate > 0.20:
        # Too high — flip some 1s to 0s
        ones = np.where(attrition == 1)[0]
        flip_count = int((current_rate - 0.16) * n)
        flip_idx = np.random.choice(ones, min(flip_count, len(ones)), replace=False)
        attrition[flip_idx] = 0
    elif current_rate < 0.12:
        # Too low — flip some 0s to 1s
        zeros = np.where(attrition == 0)[0]
        flip_count = int((0.16 - current_rate) * n)
        flip_idx = np.random.choice(zeros, min(flip_count, len(zeros)), replace=False)
        attrition[flip_idx] = 1

    df = pd.DataFrame({
        # Core features for our ML model
        "satisfaction_score": satisfaction_score,
        "performance_score": performance_score,
        "years_at_company": years_at_company,
        "overtime_hours_avg": overtime_hours_avg,
        "num_projects": num_projects,
        "salary": salary.round(2),
        "days_since_last_promotion": days_since_last_promotion,
        # IBM-style extended features
        "age": age,
        "gender": gender,
        "marital_status": marital_status,
        "education": education,
        "education_field": education_field,
        "department": department,
        "job_level": job_level,
        "job_involvement": job_involvement,
        "monthly_income": monthly_income,
        "daily_rate": daily_rate,
        "hourly_rate": hourly_rate,
        "monthly_rate": monthly_rate,
        "percent_salary_hike": percent_salary_hike,
        "stock_option_level": stock_option_level,
        "overtime": overtime,
        "business_travel": business_travel,
        "distance_from_home": distance_from_home,
        "environment_satisfaction": environment_satisfaction,
        "job_satisfaction": job_satisfaction,
        "relationship_satisfaction": relationship_satisfaction,
        "work_life_balance": work_life_balance,
        "performance_rating": performance_rating,
        "total_working_years": total_working_years,
        "years_in_role": years_in_role,
        "years_since_promotion": years_since_promotion,
        "years_with_manager": years_with_manager,
        "num_companies_worked": num_companies_worked,
        "training_times_last_year": training_times_last_year,
        "attrition": attrition,
    })

    return df


def generate_revenue_data(days: int = 730) -> pd.DataFrame:
    """Generate 2 years of daily revenue data with trends and seasonality."""
    dates = pd.date_range(end=datetime.now().date(), periods=days, freq="D")
    base = 50000
    trend = np.linspace(0, 15000, days)
    seasonal = 8000 * np.sin(2 * np.pi * np.arange(days) / 365.25)
    weekly = 3000 * np.sin(2 * np.pi * np.arange(days) / 7)
    noise = np.random.normal(0, 3000, days)
    values = (base + trend + seasonal + weekly + noise).clip(10000)

    return pd.DataFrame({"date": dates, "value": values.round(2)})


def generate_headcount_data(days: int = 730) -> pd.DataFrame:
    """Generate headcount data with gradual growth."""
    dates = pd.date_range(end=datetime.now().date(), periods=days, freq="D")
    base = 42
    growth = np.cumsum(np.random.choice([0, 0, 0, 0, 1], days))
    churn = np.cumsum(np.random.choice([0, 0, 0, 0, 0, 0, -1], days))
    values = (base + growth + churn).clip(20)

    return pd.DataFrame({"date": dates, "value": values.astype(int)})


def generate_ticket_volume_data(days: int = 365) -> pd.DataFrame:
    """Generate IT ticket volume with weekly patterns."""
    dates = pd.date_range(end=datetime.now().date(), periods=days, freq="D")
    base = 8
    weekly = 4 * np.sin(2 * np.pi * np.arange(days) / 7)
    trend = np.linspace(0, 3, days)
    noise = np.random.poisson(2, days)
    values = (base + weekly + trend + noise).clip(0).astype(int)

    return pd.DataFrame({"date": dates, "value": values})


def generate_budget_utilization_data(days: int = 365) -> pd.DataFrame:
    """Generate budget utilization percentage data."""
    dates = pd.date_range(end=datetime.now().date(), periods=days, freq="D")
    values = np.cumsum(np.random.uniform(0.1, 0.4, days)).clip(0, 100)
    values = (values / values.max() * 85 + np.random.normal(0, 2, days)).clip(0, 100)

    return pd.DataFrame({"date": dates, "value": values.round(1)})


def generate_system_metrics(days: int = 90) -> pd.DataFrame:
    """Generate system health metrics for anomaly detection (hourly)."""
    n = days * 24
    timestamps = pd.date_range(end=datetime.now(), periods=n, freq="h")

    cpu = np.random.normal(45, 12, n).clip(5, 95)
    memory = np.random.normal(55, 10, n).clip(20, 92)
    disk_io = np.random.exponential(150, n).clip(10, 1000)
    network_latency = np.random.lognormal(2.5, 0.5, n).clip(1, 500)
    error_rate = np.random.exponential(0.5, n).clip(0, 15)

    # Inject anomalies (5% of points)
    anomaly_indices = np.random.choice(n, int(n * 0.05), replace=False)
    cpu[anomaly_indices] = np.random.uniform(85, 99, len(anomaly_indices))
    memory[anomaly_indices] = np.random.uniform(80, 98, len(anomaly_indices))
    error_rate[anomaly_indices] = np.random.uniform(8, 20, len(anomaly_indices))

    return pd.DataFrame({
        "timestamp": timestamps,
        "cpu_usage": cpu.round(1),
        "memory_usage": memory.round(1),
        "disk_io_mbps": disk_io.round(1),
        "network_latency_ms": network_latency.round(1),
        "error_rate": error_rate.round(2),
    })


def generate_project_completion_data(days: int = 365) -> pd.DataFrame:
    """Generate project completion rate data."""
    dates = pd.date_range(end=datetime.now().date(), periods=days, freq="D")
    base = 65
    trend = np.linspace(0, 15, days)
    noise = np.random.normal(0, 3, days)
    values = (base + trend + noise).clip(40, 100)

    return pd.DataFrame({"date": dates, "value": values.round(1)})


if __name__ == "__main__":
    print("Generating datasets for SEP ML Service...")
    print(f"Output directory: {OUTPUT_DIR}")

    datasets = {
        "attrition_data.csv": generate_attrition_data,
        "revenue_data.csv": generate_revenue_data,
        "headcount_data.csv": generate_headcount_data,
        "ticket_volume_data.csv": generate_ticket_volume_data,
        "budget_utilization_data.csv": generate_budget_utilization_data,
        "system_metrics.csv": generate_system_metrics,
        "project_completion_data.csv": generate_project_completion_data,
    }

    for filename, generator in datasets.items():
        df = generator()
        filepath = os.path.join(OUTPUT_DIR, filename)
        df.to_csv(filepath, index=False)
        print(f"  {filename}: {len(df)} rows, {len(df.columns)} columns")

    # Print attrition stats
    attrition_df = pd.read_csv(os.path.join(OUTPUT_DIR, "attrition_data.csv"))
    attrition_rate = attrition_df["attrition"].mean() * 100
    print(f"\n  Attrition rate: {attrition_rate:.1f}%")
    print(f"  Attrition=1: {attrition_df['attrition'].sum()}")
    print(f"  Attrition=0: {(1 - attrition_df['attrition']).sum().astype(int)}")
    print(f"  Features: {len(attrition_df.columns)} columns")

    print("\nAll datasets generated successfully!")
