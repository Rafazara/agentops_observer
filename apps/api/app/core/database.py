"""
Database Connection Manager

Provides async database connection pool using asyncpg.
All queries use raw SQL for maximum performance and control.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

import asyncpg
import structlog

logger = structlog.get_logger(__name__)


class Database:
    """
    Async database connection pool manager.
    
    Uses asyncpg for high-performance PostgreSQL connections.
    All operations are async and use connection pooling.
    """
    
    def __init__(self) -> None:
        """Initialize database manager."""
        self._pool: asyncpg.Pool | None = None
        self._lock = asyncio.Lock()
        self.database_url = os.getenv("DATABASE_URL")
    
    async def connect(self) -> None:
        """
        Create and configure the connection pool.
        
        Should be called during application startup.
        Supabase pooler handles TLS termination.
        """
        if self._pool is not None:
            return
        
        async with self._lock:
            if self._pool is not None:
                return
            
            if not self.database_url:
                raise RuntimeError("DATABASE_URL is not set")
            
            logger.info("Connecting to database...")
            
            # Extract host for safe logging (hide credentials)
            try:
                db_host = self.database_url.split("@")[1].split("/")[0]
                logger.info(f"Database host: {db_host}")
            except Exception:
                pass
            
            try:
                self._pool = await asyncpg.create_pool(
                    self.database_url,
                    ssl=True,
                    min_size=1,
                    max_size=5,
                    command_timeout=60,
                )
                
                logger.info("Database connection established successfully")
                
            except Exception as e:
                logger.error(f"Database connection failed: {e}")
                raise RuntimeError(f"Failed to connect to database: {e}") from e
    
    async def disconnect(self) -> None:
        """
        Close all connections in the pool.
        
        Should be called during application shutdown.
        """
        if self._pool is None:
            return
        
        logger.info("Closing database connection pool")
        await self._pool.close()
        self._pool = None
        logger.info("Database connection pool closed")
    
    @property
    def pool(self) -> asyncpg.Pool:
        """
        Get the connection pool.
        
        Raises:
            RuntimeError: If pool is not initialized
        
        Returns:
            asyncpg.Pool: The connection pool
        """
        if self._pool is None:
            raise RuntimeError("Database pool not initialized. Call connect() first.")
        return self._pool
    
    @asynccontextmanager
    async def connection(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """
        Get a connection from the pool.
        
        Usage:
            async with db.connection() as conn:
                result = await conn.fetch("SELECT * FROM users")
        
        Yields:
            asyncpg.Connection: Database connection
        """
        async with self.pool.acquire() as conn:
            yield conn
    
    @asynccontextmanager
    async def transaction(self) -> AsyncGenerator[asyncpg.Connection, None]:
        """
        Get a connection with an active transaction.
        
        The transaction is automatically committed on success
        or rolled back on exception.
        
        Usage:
            async with db.transaction() as conn:
                await conn.execute("INSERT INTO users ...")
                await conn.execute("INSERT INTO audit_logs ...")
        
        Yields:
            asyncpg.Connection: Database connection with active transaction
        """
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                yield conn
    
    async def fetch_one(
        self,
        query: str,
        *args: Any,
    ) -> asyncpg.Record | None:
        """
        Execute a query and return the first row.
        
        Args:
            query: SQL query with $1, $2, ... placeholders
            *args: Query parameters
        
        Returns:
            Optional[asyncpg.Record]: First row or None
        """
        async with self.connection() as conn:
            return await conn.fetchrow(query, *args)
    
    async def fetch_all(
        self,
        query: str,
        *args: Any,
    ) -> list[asyncpg.Record]:
        """
        Execute a query and return all rows.
        
        Args:
            query: SQL query with $1, $2, ... placeholders
            *args: Query parameters
        
        Returns:
            List[asyncpg.Record]: All matching rows
        """
        async with self.connection() as conn:
            return await conn.fetch(query, *args)
    
    async def execute(
        self,
        query: str,
        *args: Any,
    ) -> str:
        """
        Execute a query without returning results.
        
        Args:
            query: SQL query with $1, $2, ... placeholders
            *args: Query parameters
        
        Returns:
            str: Command status (e.g., "INSERT 0 1")
        """
        async with self.connection() as conn:
            return await conn.execute(query, *args)
    
    async def execute_many(
        self,
        query: str,
        args: list[tuple[Any, ...]],
    ) -> None:
        """
        Execute a query with multiple sets of parameters.
        
        Efficient for bulk inserts.
        
        Args:
            query: SQL query with $1, $2, ... placeholders
            args: List of parameter tuples
        """
        async with self.connection() as conn:
            await conn.executemany(query, args)
    
    async def health_check(self) -> bool:
        """
        Check if the database connection is healthy.
        
        Returns:
            bool: True if healthy, False otherwise
        """
        try:
            result = await self.fetch_one("SELECT 1 as health")
            return result is not None and result["health"] == 1
        except Exception as e:
            logger.error("Database health check failed", error=str(e))
            return False


# Global database instance
db = Database()


async def get_db() -> Database:
    """
    FastAPI dependency for database access.
    
    Returns:
        Database: Database instance
    """
    return db
