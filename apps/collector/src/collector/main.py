"""
AgentOps Collector Service - Main application entry point.
"""

from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from collector.config import get_settings
from collector.database import init_db, close_db
from collector.consumer import get_consumer
from collector.aggregator import get_aggregation_worker
from collector.alerting import get_alert_worker
from collector.semantic import get_semantic_analyzer

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    settings = get_settings()
    
    logger.info(
        "Starting AgentOps Collector",
        environment=settings.environment,
    )
    
    # Initialize database
    await init_db()
    
    # Start Kafka consumer
    consumer = get_consumer()
    await consumer.start()
    
    # Start background workers
    aggregation_worker = get_aggregation_worker()
    await aggregation_worker.start()
    
    alert_worker = get_alert_worker()
    await alert_worker.start()
    
    semantic_analyzer = get_semantic_analyzer()
    await semantic_analyzer.start()
    
    logger.info("AgentOps Collector started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AgentOps Collector")
    
    await semantic_analyzer.stop()
    await alert_worker.stop()
    await aggregation_worker.stop()
    await consumer.stop()
    await close_db()
    
    logger.info("AgentOps Collector shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="AgentOps Collector",
    description="High-throughput event collector for AgentOps Observer",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "agentops-collector",
    }


@app.get("/ready")
async def readiness_check():
    """Readiness check endpoint."""
    from collector.database import get_pool
    from collector.consumer import get_consumer
    
    # Check database
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_ok = True
    except Exception:
        db_ok = False
    
    # Check Kafka consumer
    consumer = get_consumer()
    kafka_ok = consumer.consumer is not None and consumer._running
    
    ready = db_ok and kafka_ok
    
    return {
        "ready": ready,
        "checks": {
            "database": db_ok,
            "kafka": kafka_ok,
        },
    }


@app.get("/metrics")
async def get_metrics():
    """Get collector metrics (Prometheus format placeholder)."""
    from collector.consumer import get_consumer
    
    consumer = get_consumer()
    
    return {
        "consumer": {
            "running": consumer._running,
        },
    }


if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    
    uvicorn.run(
        "collector.main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.debug,
    )
