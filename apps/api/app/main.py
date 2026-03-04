"""
AgentOps Observer API - Main Application

Enterprise-grade observability platform for autonomous AI agents.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import structlog

from app import __version__
from app.core.config import settings
from app.core.database import db
from app.core.cache import cache
from app.core.logging import setup_logging
from app.core.rate_limiter import limiter, rate_limit_exceeded_handler
from app.core.csrf import CSRFMiddleware

# Initialize Sentry if DSN is configured
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=0.1,  # Sample 10% of transactions
        profiles_sample_rate=0.1,  # Sample 10% for profiling
        send_default_pii=False,  # GDPR compliance - no PII
        attach_stacktrace=True,
        release=f"agentops-api@{__version__}",
    )
    structlog.get_logger(__name__).info("Sentry initialized", dsn=settings.sentry_dsn[:20] + "...")

# Import routers
from app.routes import (
    auth,
    executions,
    agents,
    costs,
    incidents,
    alerts,
    compliance,
    ingest,
    websocket,
)

# Setup structured logging
setup_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager.
    
    Handles startup and shutdown of database, cache, and other services.
    """
    # Startup
    logger.info(
        "Starting AgentOps Observer API",
        version=__version__,
        environment=settings.app_env,
    )
    
    try:
        # Connect to database
        await db.connect()
        
        # Connect to Redis
        await cache.connect()
        
        logger.info("All services connected successfully")
        
        yield
        
    finally:
        # Shutdown
        logger.info("Shutting down AgentOps Observer API")
        
        await cache.disconnect()
        await db.disconnect()
        
        logger.info("Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="AgentOps Observer API",
    description="Enterprise-grade observability platform for autonomous AI agents",
    version=__version__,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else "/api/openapi.json",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# Add rate limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


# ============================================================================
# Middleware
# ============================================================================

# CSRF Protection (must be added before CORS)
app.add_middleware(CSRFMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url] if settings.is_production else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log all requests with timing information."""
    import time
    import uuid
    
    request_id = str(uuid.uuid4())[:8]
    start_time = time.perf_counter()
    
    # Add request ID to context
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    
    # Process request
    response = await call_next(request)
    
    # Calculate duration
    duration_ms = (time.perf_counter() - start_time) * 1000
    
    # Log request
    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=round(duration_ms, 2),
    )
    
    # Add headers
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
    
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Add security headers to all responses."""
    response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    
    return response


# ============================================================================
# Health & Info Endpoints
# ============================================================================

@app.get(
    "/health",
    tags=["Health"],
    summary="Health check",
    response_model=dict,
)
async def health_check():
    """
    Check the health of the API and its dependencies.
    
    Returns the status of database, Redis, and Kafka connections.
    """
    db_healthy = await db.health_check()
    redis_healthy = await cache.health_check()
    
    status_ok = db_healthy and redis_healthy
    
    return {
        "status": "healthy" if status_ok else "degraded",
        "version": __version__,
        "checks": {
            "database": "ok" if db_healthy else "error",
            "redis": "ok" if redis_healthy else "error",
        },
    }


@app.get(
    "/ping",
    tags=["Health"],
    summary="Lightweight ping",
    response_model=dict,
)
async def ping():
    """
    Ultra-lightweight health check for load balancers and keep-alive scripts.
    
    Returns immediately without checking any dependencies.
    Used by Render.com health checks and keep-alive cron jobs.
    """
    return {"status": "pong"}


@app.get(
    "/",
    tags=["Info"],
    summary="API info",
    response_model=dict,
)
async def root():
    """Return basic API information."""
    return {
        "name": "AgentOps Observer API",
        "version": __version__,
        "docs": "/docs" if settings.is_development else None,
    }


# ============================================================================
# Register Routers
# ============================================================================

API_V1_PREFIX = "/api/v1"

app.include_router(
    auth.router,
    prefix=f"{API_V1_PREFIX}/auth",
    tags=["Authentication"],
)

app.include_router(
    executions.router,
    prefix=f"{API_V1_PREFIX}/executions",
    tags=["Executions"],
)

app.include_router(
    agents.router,
    prefix=f"{API_V1_PREFIX}/agents",
    tags=["Agents"],
)

app.include_router(
    costs.router,
    prefix=f"{API_V1_PREFIX}/costs",
    tags=["Costs"],
)

app.include_router(
    incidents.router,
    prefix=f"{API_V1_PREFIX}/incidents",
    tags=["Incidents"],
)

app.include_router(
    alerts.router,
    prefix=f"{API_V1_PREFIX}/alerts",
    tags=["Alerts"],
)

app.include_router(
    compliance.router,
    prefix=f"{API_V1_PREFIX}/compliance",
    tags=["Compliance"],
)

app.include_router(
    ingest.router,
    prefix=f"{API_V1_PREFIX}/ingest",
    tags=["Ingest"],
)

app.include_router(
    websocket.router,
    prefix=f"{API_V1_PREFIX}/ws",
    tags=["WebSocket"],
)


# ============================================================================
# Exception Handlers
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    logger.exception(
        "Unhandled exception",
        path=request.url.path,
        method=request.method,
    )
    
    return ORJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": "An unexpected error occurred",
        },
    )
