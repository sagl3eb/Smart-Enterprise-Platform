from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.routers import attrition, forecasting, anomaly, health, equipment

app = FastAPI(
    title="Smart Enterprise Platform — ML Service",
    description="Machine Learning microservice for attrition prediction, forecasting, and anomaly detection",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("CORS_ORIGIN", "http://localhost:5173"),
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(attrition.router)
app.include_router(forecasting.router, prefix="/predict", tags=["Forecasting"])
app.include_router(anomaly.router, prefix="/predict", tags=["Anomaly Detection"])
app.include_router(health.router, prefix="/models", tags=["Models"])
app.include_router(equipment.router)


@app.get("/")
async def root():
    return {
        "success": True,
        "data": {"service": "ML Service", "status": "running"},
        "message": "Smart Enterprise Platform ML Service",
    }


@app.get("/health")
async def health_check():
    return {
        "success": True,
        "data": {"status": "healthy"},
        "message": "ML Service is healthy",
    }
