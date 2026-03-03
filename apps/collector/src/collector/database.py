"""
Database connection pool for the Collector service.
"""

import asyncpg
import structlog
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from collector.config import get_settings

logger = structlog.get_logger()

# Connection pool
_pool: asyncpg.Pool | None = None


async def init_db() -> None:
    """Initialize the database connection pool."""
    global _pool
    
    settings = get_settings()
    
    _pool = await asyncpg.create_pool(
        settings.database_url,
        min_size=settings.database_pool_min,
        max_size=settings.database_pool_max,
        command_timeout=60,
    )
    
    logger.info("Database pool initialized")


async def close_db() -> None:
    """Close the database connection pool."""
    global _pool
    
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed")


def get_pool() -> asyncpg.Pool:
    """Get the database connection pool."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get a database connection from the pool."""
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn
