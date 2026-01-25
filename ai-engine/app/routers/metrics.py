from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.models.database import get_db, PredictionHistory, ModelMetrics

router = APIRouter()


@router.get("/predictions")
async def get_prediction_history(
    limit: int = 100,
    model_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get historical predictions"""
    query = db.query(PredictionHistory)
    
    if model_type:
        query = query.filter(PredictionHistory.model_type == model_type)
    
    predictions = query.order_by(
        PredictionHistory.timestamp.desc()
    ).limit(limit).all()
    
    return {
        "total": len(predictions),
        "predictions": [
            {
                "id": p.id,
                "timestamp": p.timestamp.isoformat(),
                "model_type": p.model_type,
                "severity_score": p.severity_score,
                "recommended_action": p.recommended_action,
                "prediction": p.prediction
            }
            for p in predictions
        ]
    }


@router.get("/model-performance")
async def get_model_performance(
    model_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get model performance metrics"""
    query = db.query(ModelMetrics)
    
    if model_type:
        query = query.filter(ModelMetrics.model_type == model_type)
    
    metrics = query.order_by(ModelMetrics.trained_at.desc()).limit(10).all()
    
    return {
        "metrics": [
            {
                "model_type": m.model_type,
                "model_version": m.model_version,
                "accuracy": m.accuracy,
                "precision": m.precision,
                "recall": m.recall,
                "f1_score": m.f1_score,
                "trained_at": m.trained_at.isoformat()
            }
            for m in metrics
        ]
    }


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get overall statistics"""
    total_predictions = db.query(PredictionHistory).count()
    
    # Last 24 hours
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_predictions = db.query(PredictionHistory).filter(
        PredictionHistory.timestamp >= yesterday
    ).count()
    
    # Anomalies detected
    anomalies = db.query(PredictionHistory).filter(
        PredictionHistory.model_type == 'anomaly',
        PredictionHistory.prediction['is_anomaly'].astext == 'true'
    ).count()
    
    # Failures detected
    failures = db.query(PredictionHistory).filter(
        PredictionHistory.model_type == 'failure',
        PredictionHistory.prediction['failure_detected'].astext == 'true'
    ).count()
    
    return {
        "total_predictions": total_predictions,
        "predictions_last_24h": recent_predictions,
        "total_anomalies_detected": anomalies,
        "total_failures_detected": failures,
        "timestamp": datetime.utcnow().isoformat()
    }
