"""
Rate Limiting Middleware

Uses slowapi for rate limiting based on IP, user, and API key.
"""

from typing import Callable

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


def get_real_ip(request: Request) -> str:
    """Get real client IP, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return get_remote_address(request) or "unknown"


def get_api_key_identifier(request: Request) -> str:
    """Get rate limit key from API key header."""
    api_key = request.headers.get("X-API-Key", "")
    if api_key:
        # Use first 20 chars (prefix) as identifier
        return f"apikey:{api_key[:20]}"
    return get_real_ip(request)


def get_user_identifier(request: Request) -> str:
    """Get rate limit key from authenticated user."""
    # Try to get user ID from request state (set by auth middleware)
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return get_real_ip(request)


# Create limiter instance
limiter = Limiter(
    key_func=get_real_ip,
    default_limits=[f"{settings.rate_limit_default}/minute"],
    storage_uri=settings.redis_url if not settings.use_upstash else None,
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Custom handler for rate limit exceeded errors."""
    retry_after = getattr(exc, "retry_after", 60)
    
    logger.warning(
        "Rate limit exceeded",
        path=request.url.path,
        method=request.method,
        limit=str(exc.detail) if hasattr(exc, "detail") else "unknown",
        ip=get_real_ip(request),
    )
    
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please slow down.",
            "retry_after": retry_after,
        },
        headers={
            "Retry-After": str(retry_after),
            "X-RateLimit-Limit": str(getattr(exc, "limit", "unknown")),
        },
    )


# Pre-defined rate limit decorators
def limit_auth_login(func: Callable) -> Callable:
    """Rate limit for login: 5 requests/minute per IP."""
    return limiter.limit("5/minute", key_func=get_real_ip)(func)


def limit_auth_register(func: Callable) -> Callable:
    """Rate limit for registration: 3 requests/minute per IP."""
    return limiter.limit("3/minute", key_func=get_real_ip)(func)


def limit_ingest(func: Callable) -> Callable:
    """Rate limit for ingest: 10000 requests/minute per API key."""
    return limiter.limit(
        f"{settings.rate_limit_ingest}/minute",
        key_func=get_api_key_identifier
    )(func)


def limit_read(func: Callable) -> Callable:
    """Rate limit for GET endpoints: 100 requests/minute per user."""
    return limiter.limit("100/minute", key_func=get_user_identifier)(func)


def limit_write(func: Callable) -> Callable:
    """Rate limit for POST/PUT/DELETE: 30 requests/minute per user."""
    return limiter.limit("30/minute", key_func=get_user_identifier)(func)
