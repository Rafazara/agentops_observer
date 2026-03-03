"""
Configuration for the AgentOps SDK.
"""

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    """SDK configuration."""
    
    # Authentication
    api_key: str | None = field(
        default_factory=lambda: os.getenv("AGENTOPS_API_KEY")
    )
    endpoint: str = field(
        default_factory=lambda: os.getenv("AGENTOPS_ENDPOINT", "https://api.agentops.ai")
    )
    
    # Buffering
    buffer_size: int = 100
    flush_interval_ms: int = 5000
    
    # Retry
    max_retries: int = 3
    retry_backoff_ms: int = 1000
    
    # Circuit breaker
    circuit_breaker_threshold: int = 5
    circuit_breaker_reset_ms: int = 30000
    
    # PII
    redact_pii: bool = True
    pii_patterns: list[str] = field(default_factory=lambda: ["email", "phone", "ssn", "credit_card"])
    
    # Sampling
    sample_rate: float = 1.0
    
    # Environment
    environment: str = field(
        default_factory=lambda: os.getenv("AGENTOPS_ENVIRONMENT", "production")
    )
    version: str | None = field(
        default_factory=lambda: os.getenv("AGENTOPS_VERSION")
    )
    
    # Debug
    disabled: bool = field(
        default_factory=lambda: os.getenv("AGENTOPS_DISABLED", "").lower() == "true"
    )
    debug: bool = field(
        default_factory=lambda: os.getenv("AGENTOPS_DEBUG", "").lower() == "true"
    )
    
    def __post_init__(self):
        """Validate configuration."""
        if not self.disabled and not self.api_key:
            raise ValueError(
                "API key required. Set AGENTOPS_API_KEY environment variable "
                "or pass api_key to agentops.init()"
            )
        
        if not 0.0 <= self.sample_rate <= 1.0:
            raise ValueError("sample_rate must be between 0.0 and 1.0")
