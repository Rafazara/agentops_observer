"""
AgentOps Observer SDK

Enterprise-grade observability for autonomous AI agents.
"""

from agentops.client import AgentOps
from agentops.context import trace_context, TraceContext
from agentops.decorators import trace
from agentops.models import ExecutionStatus, EventType

__version__ = "0.1.0"

# Global client instance
_client: AgentOps | None = None


def init(
    api_key: str | None = None,
    endpoint: str = "https://api.agentops.ai",
    *,
    buffer_size: int = 100,
    flush_interval_ms: int = 5000,
    max_retries: int = 3,
    retry_backoff_ms: int = 1000,
    circuit_breaker_threshold: int = 5,
    redact_pii: bool = True,
    pii_patterns: list[str] | None = None,
    sample_rate: float = 1.0,
    environment: str = "production",
    version: str | None = None,
    disabled: bool = False,
) -> AgentOps:
    """
    Initialize the AgentOps SDK.
    
    Args:
        api_key: API key for authentication. Can also be set via AGENTOPS_API_KEY env var.
        endpoint: API endpoint URL.
        buffer_size: Number of events to buffer before flushing.
        flush_interval_ms: Flush interval in milliseconds.
        max_retries: Maximum retry attempts for failed requests.
        retry_backoff_ms: Initial backoff time for retries.
        circuit_breaker_threshold: Number of failures before circuit opens.
        redact_pii: Enable automatic PII redaction.
        pii_patterns: List of PII patterns to detect (email, phone, ssn, credit_card).
        sample_rate: Sampling rate (0.0-1.0) for traces.
        environment: Environment name (production, staging, development).
        version: Agent version string.
        disabled: Disable the SDK entirely.
    
    Returns:
        AgentOps client instance.
    """
    global _client
    
    _client = AgentOps(
        api_key=api_key,
        endpoint=endpoint,
        buffer_size=buffer_size,
        flush_interval_ms=flush_interval_ms,
        max_retries=max_retries,
        retry_backoff_ms=retry_backoff_ms,
        circuit_breaker_threshold=circuit_breaker_threshold,
        redact_pii=redact_pii,
        pii_patterns=pii_patterns,
        sample_rate=sample_rate,
        environment=environment,
        version=version,
        disabled=disabled,
    )
    
    return _client


def get_client() -> AgentOps:
    """Get the global AgentOps client instance."""
    if _client is None:
        raise RuntimeError(
            "AgentOps SDK not initialized. Call agentops.init() first."
        )
    return _client


async def shutdown() -> None:
    """Gracefully shutdown the SDK, flushing any remaining events."""
    if _client is not None:
        await _client.shutdown()


def patch_langchain() -> None:
    """Auto-instrument LangChain."""
    from agentops.integrations.langchain import patch
    patch(get_client())


def patch_openai() -> None:
    """Auto-instrument OpenAI."""
    from agentops.integrations.openai import patch
    patch(get_client())


def patch_anthropic() -> None:
    """Auto-instrument Anthropic."""
    from agentops.integrations.anthropic import patch
    patch(get_client())


__all__ = [
    "__version__",
    "init",
    "get_client",
    "shutdown",
    "trace",
    "trace_context",
    "TraceContext",
    "patch_langchain",
    "patch_openai",
    "patch_anthropic",
    "ExecutionStatus",
    "EventType",
]
