from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from datetime import datetime

from app.config import settings
from app.models.database import init_db
from app.routers import inference, metrics, health
from app.services.model_service import ModelService

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting AI Engine service...")
    init_db()
    
    # Initialize ML models
    model_service = ModelService()
    await model_service.load_models()
    app.state.model_service = model_service
    
    logger.info("AI Engine service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Engine service...")


app = FastAPI(
    title="Aegis AI Engine",
    description="AI-powered anomaly detection and self-healing engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key authentication
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    """Verify API key for secure endpoints"""
    if settings.api_key and api_key != settings.api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key


# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(
    inference.router,
    prefix="/api/v1",
    tags=["Inference"],
    dependencies=[Depends(verify_api_key)] if settings.api_key else []
)
app.include_router(
    metrics.router,
    prefix="/api/v1/metrics",
    tags=["Metrics"],
    dependencies=[Depends(verify_api_key)] if settings.api_key else []
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Aegis AI Engine",
        "version": "1.0.0",
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat()
    }
