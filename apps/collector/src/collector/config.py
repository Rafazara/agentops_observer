"""
Configuration for the Collector service.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Collector service settings."""
    
    # Service
    service_name: str = "agentops-collector"
    environment: str = "development"
    debug: bool = False
    
    # Kafka/Redpanda
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_consumer_group: str = "agentops-collector"
    kafka_events_topic: str = "agentops.events"
    kafka_auto_offset_reset: str = "earliest"
    kafka_batch_size: int = 100
    kafka_batch_timeout_ms: int = 1000
    
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/agentops"
    database_pool_min: int = 5
    database_pool_max: int = 20
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Anthropic (for semantic analysis)
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-haiku-20240307"
    semantic_analysis_enabled: bool = True
    
    # Aggregation
    aggregation_interval_seconds: int = 60
    retention_days: int = 90
    
    # Alerting
    alerting_enabled: bool = True
    alert_check_interval_seconds: int = 30
    
    model_config = {
        "env_prefix": "COLLECTOR_",
        "env_file": ".env",
    }


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
