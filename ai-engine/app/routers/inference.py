from fastapi import APIRouter, Request, HTTPException
from typing import List
import logging

from app.schemas.inference import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    FailureDetectionRequest,
    FailureDetectionResponse
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/detect-anomaly", response_model=AnomalyDetectionResponse)
async def detect_anomaly(
    request: Request,
    data: AnomalyDetectionRequest
):
    """
    Detect anomalies in API usage metrics
    
    This endpoint analyzes metrics to identify unusual patterns that may indicate:
    - Sudden traffic spikes
    - Performance degradation
    - Resource exhaustion
    - DDoS attempts
    
    Returns recommended remediation actions and severity scores.
    """
    model_service = request.app.state.model_service
    
    if not model_service.models_loaded:
        raise HTTPException(
            status_code=503,
            detail="Models not loaded. Service is initializing."
        )
    
    logger.info(f"Anomaly detection request with {len(data.metrics)} metrics")
    
    try:
        response = await model_service.detect_anomaly(data.metrics)
        
        logger.info(
            f"Anomaly detection complete: is_anomaly={response.is_anomaly}, "
            f"score={response.anomaly_score:.3f}, severity={response.severity}"
        )
        
        return response
    except Exception as e:
        logger.error(f"Error in anomaly detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detect-failure", response_model=FailureDetectionResponse)
async def detect_failure(
    request: Request,
    data: FailureDetectionRequest
):
    """
    Detect failure patterns for self-healing triggers
    
    This endpoint analyzes both metrics and logs to identify:
    - Service failures
    - Memory leaks
    - Connection timeouts
    - Cascading failures
    
    Returns recommended remediation actions, root cause analysis, and affected services.
    """
    model_service = request.app.state.model_service
    
    if not model_service.models_loaded:
        raise HTTPException(
            status_code=503,
            detail="Models not loaded. Service is initializing."
        )
    
    logger.info(
        f"Failure detection request with {len(data.metrics)} metrics "
        f"and {len(data.logs)} logs"
    )
    
    try:
        response = await model_service.detect_failure(data.metrics, data.logs)
        
        logger.info(
            f"Failure detection complete: failure_detected={response.failure_detected}, "
            f"type={response.failure_type}, severity={response.severity}"
        )
        
        return response
    except Exception as e:
        logger.error(f"Error in failure detection: {e}")
        raise HTTPException(status_code=500, detail=str(e))
