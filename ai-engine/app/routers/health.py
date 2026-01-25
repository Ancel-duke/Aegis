from fastapi import APIRouter, Request
from datetime import datetime
import time

from app.schemas.inference import HealthCheckResponse

router = APIRouter()

start_time = time.time()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(request: Request):
    """Health check endpoint"""
    model_service = getattr(request.app.state, 'model_service', None)
    
    return HealthCheckResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        uptime=time.time() - start_time,
        models_loaded=model_service.models_loaded if model_service else False,
        database_connected=True  # TODO: Add actual DB check
    )


@router.get("/ping")
async def ping():
    """Simple ping endpoint"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
