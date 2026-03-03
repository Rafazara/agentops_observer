"""
Application Configuration

Centralized configuration management using Pydantic Settings.
All configuration is loaded from environment variables.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # =========================================================================
    # Application
    # =========================================================================
    app_env: Literal["development", "staging", "production"] = "development"
    secret_key: str = Field(default="change-me-in-production")
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    frontend_url: str = "http://localhost:3000"
    log_level: str = "INFO"
    debug: bool = False
    
    # =========================================================================
    # Database
    # =========================================================================
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "agentops"
    postgres_password: str = "agentops_secret"
    postgres_db: str = "agentops"
    postgres_pool_size: int = 10
    postgres_pool_max_overflow: int = 20
    
    @computed_field
    @property
    def database_url(self) -> str:
        """Construct database URL from components."""
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    
    @computed_field
    @property
    def async_database_url(self) -> str:
        """Construct async database URL for asyncpg."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
    
    # =========================================================================
    # Redis (Standard or Upstash HTTP)
    # =========================================================================
    # Standard Redis (local/Docker)
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""
    redis_db: int = 0
    
    # Upstash Redis (free tier - HTTP-based)
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    
    @computed_field
    @property
    def use_upstash(self) -> bool:
        """Check if Upstash Redis should be used."""
        return bool(self.upstash_redis_rest_url and self.upstash_redis_rest_token)
    
    @computed_field
    @property
    def redis_url(self) -> str:
        """Construct Redis URL from components."""
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    # =========================================================================
    # Kafka
    # =========================================================================
    kafka_bootstrap_servers: str = "localhost:19092"
    kafka_consumer_group_id: str = "agentops-consumer"
    kafka_topic_events_raw: str = "agentops.events.raw"
    kafka_topic_events_processed: str = "agentops.events.processed"
    kafka_topic_executions_completed: str = "agentops.executions.completed"
    kafka_topic_incidents: str = "agentops.incidents.created"
    kafka_topic_dlq: str = "agentops.dlq"
    
    # =========================================================================
    # Anthropic (Semantic Analysis)
    # =========================================================================
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"
    
    # =========================================================================
    # Authentication
    # =========================================================================
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 30
    password_hash_rounds: int = 12
    api_key_prefix: str = "agentops_sk_"
    
    # =========================================================================
    # Rate Limiting
    # =========================================================================
    rate_limit_default: int = 1000
    rate_limit_ingest: int = 10000
    rate_limit_auth: int = 60
    
    # =========================================================================
    # Feature Flags
    # =========================================================================
    feature_semantic_analysis: bool = True
    feature_anomaly_detection: bool = True
    feature_pii_redaction: bool = True
    feature_audit_logging: bool = True
    
    # =========================================================================
    # Monitoring
    # =========================================================================
    metrics_enabled: bool = True
    metrics_port: int = 9090
    sentry_dsn: str = ""
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Returns:
        Settings: Application settings
    """
    return Settings()


# Global settings instance
settings = get_settings()
