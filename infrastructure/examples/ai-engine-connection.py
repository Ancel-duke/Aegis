"""
AI Engine - PostgreSQL Connection Setup
with SSL/TLS and Connection Pooling

NOTE: This is example/reference code showing how to configure database connections.
Install dependencies: pip install sqlalchemy psycopg2-binary redis
"""

import os
from sqlalchemy import create_engine, text  # type: ignore
from sqlalchemy.ext.declarative import declarative_base  # type: ignore
from sqlalchemy.orm import sessionmaker  # type: ignore
from sqlalchemy.pool import QueuePool  # type: ignore
import redis  # type: ignore
from typing import Optional, Any

# Database Configuration
class DatabaseConfig:
    """PostgreSQL database configuration"""
    
    def __init__(self):
        self.host = os.getenv('AI_DB_HOST', 'localhost')
        self.port = int(os.getenv('AI_DB_PORT', '5433'))
        self.user = os.getenv('AI_DB_USER', 'aegis_ai_user')
        self.password = os.getenv('AI_DB_PASSWORD')
        self.database = os.getenv('AI_DB_NAME', 'aegis_ai')
        self.ssl_mode = os.getenv('AI_DB_SSL_MODE', 'require')
        self.pool_size = int(os.getenv('AI_DB_POOL_SIZE', '10'))
        self.max_overflow = int(os.getenv('AI_DB_POOL_MAX_OVERFLOW', '20'))
        
    def get_connection_url(self) -> str:
        """Generate database connection URL"""
        return (
            f"postgresql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.database}"
        )
    
    def get_connect_args(self) -> dict:
        """Get SSL/TLS connection arguments"""
        if self.ssl_mode == 'disable':
            return {}
        
        return {
            'sslmode': self.ssl_mode,
            'sslcert': './ssl/postgres/ai/client.crt',
            'sslkey': './ssl/postgres/ai/client.key',
            'sslrootcert': './ssl/postgres/ai/ca.crt',
        }


# Create database engine with connection pooling
def create_db_engine(config: DatabaseConfig):
    """
    Create SQLAlchemy engine with connection pooling and SSL
    """
    engine = create_engine(
        config.get_connection_url(),
        poolclass=QueuePool,
        pool_size=config.pool_size,
        max_overflow=config.max_overflow,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=3600,   # Recycle connections after 1 hour
        echo=os.getenv('SQL_ECHO', 'false').lower() == 'true',
        connect_args=config.get_connect_args()
    )
    return engine


# Database setup
config = DatabaseConfig()
engine = create_db_engine(config)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_database_connection() -> bool:
    """
    Test database connection
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT NOW()"))
            row = result.fetchone()
            print(f"✅ Database connection successful: {row[0]}")
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {str(e)}")
        return False


# Redis Configuration
class RedisConfig:
    """Redis cache configuration"""
    
    def __init__(self):
        self.host = os.getenv('REDIS_HOST', 'localhost')
        self.port = int(os.getenv('REDIS_PORT', '6379'))
        self.password = os.getenv('REDIS_PASSWORD')
        self.db = int(os.getenv('REDIS_DB', '0'))
        self.ssl = os.getenv('REDIS_TLS', 'false').lower() == 'true'
        self.ssl_ca_certs = './ssl/redis/ca.crt'
        self.ssl_certfile = './ssl/redis/client.crt'
        self.ssl_keyfile = './ssl/redis/client.key'


def create_redis_client(config: RedisConfig) -> redis.Redis:
    """
    Create Redis client with SSL/TLS
    """
    connection_kwargs = {
        'host': config.host,
        'port': config.port,
        'password': config.password,
        'db': config.db,
        'decode_responses': True,
        'socket_keepalive': True,
        'socket_connect_timeout': 5,
        'socket_timeout': 5,
        'retry_on_timeout': True,
        'health_check_interval': 30,
    }
    
    if config.ssl:
        connection_kwargs.update({
            'ssl': True,
            'ssl_ca_certs': config.ssl_ca_certs,
            'ssl_certfile': config.ssl_certfile,
            'ssl_keyfile': config.ssl_keyfile,
            'ssl_cert_reqs': 'required',
        })
    
    return redis.Redis(**connection_kwargs)


# Redis client
redis_config = RedisConfig()
redis_client = create_redis_client(redis_config)


def test_redis_connection() -> bool:
    """
    Test Redis connection
    """
    try:
        response = redis_client.ping()
        if response:
            print("✅ Redis connection successful")
            return True
        return False
    except Exception as e:
        print(f"❌ Redis connection failed: {str(e)}")
        return False


# Cache decorator
def cache_result(key_prefix: str, ttl: int = 300):
    """
    Decorator to cache function results in Redis
    
    Args:
        key_prefix: Prefix for the cache key
        ttl: Time to live in seconds (default 5 minutes)
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            import json
            import hashlib
            
            # Generate cache key
            key_data = f"{key_prefix}:{str(args)}:{str(kwargs)}"
            cache_key = hashlib.md5(key_data.encode()).hexdigest()
            
            # Try to get from cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            redis_client.setex(
                cache_key,
                ttl,
                json.dumps(result, default=str)
            )
            
            return result
        return wrapper
    return decorator


# Loki logging configuration
class LokiConfig:
    """Loki logging configuration"""
    
    def __init__(self):
        self.url = os.getenv('LOKI_URL', 'http://localhost:3100')
        self.enabled = os.getenv('LOKI_ENABLED', 'true').lower() == 'true'


def send_to_loki(message: dict, labels: Optional[dict] = None):
    """
    Send log message to Loki
    
    Args:
        message: Log message dictionary
        labels: Loki labels (job, level, etc.)
    """
    import requests  # type: ignore
    import time
    
    config = LokiConfig()
    if not config.enabled:
        return
    
    default_labels = {
        'job': 'aegis-ai-engine',
        'level': 'info',
    }
    
    if labels:
        default_labels.update(labels)
    
    log_entry = {
        'streams': [
            {
                'stream': default_labels,
                'values': [
                    [
                        str(int(time.time() * 1e9)),  # Nanosecond timestamp
                        str(message)
                    ]
                ]
            }
        ]
    }
    
    try:
        requests.post(
            f"{config.url}/loki/api/v1/push",
            json=log_entry,
            headers={'Content-Type': 'application/json'},
            timeout=5
        )
    except Exception as e:
        print(f"Failed to send log to Loki: {str(e)}")


# Example usage
if __name__ == "__main__":
    print("Testing database connections...\n")
    
    # Test PostgreSQL
    test_database_connection()
    
    # Test Redis
    test_redis_connection()
    
    # Example: Send log to Loki
    send_to_loki(
        {
            'message': 'AI Engine started',
            'model_type': 'anomaly_detection',
            'status': 'initialized'
        },
        labels={'level': 'info'}
    )
    
    print("\n✅ Connection tests complete!")
