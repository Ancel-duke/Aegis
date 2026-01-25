from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    environment: str = "development"
    log_level: str = "INFO"
    
    # Database
    db_host: str = "localhost"
    db_port: int = 5432
    db_user: str = "ai_engine_user"
    db_password: str = "password"
    db_name: str = "ai_engine_db"
    
    # External Services
    prometheus_url: str = "http://localhost:9090"
    loki_url: str = "http://localhost:3100"
    policy_engine_url: str = "http://localhost:3000/api/v1/policy/evaluate"
    
    # Model Configuration
    anomaly_threshold: float = 0.85
    failure_detection_window: int = 300  # seconds
    min_samples_for_training: int = 100
    
    # Security
    api_key: Optional[str] = None
    
    @property
    def database_url(self) -> str:
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
