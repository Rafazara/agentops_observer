"""
Redis Cache Manager

Provides async Redis connection for caching and session management.
Supports both standard Redis (TCP) and Upstash Redis (HTTP REST API).
"""

from abc import ABC, abstractmethod
from typing import Any

import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


class BaseCacheClient(ABC):
    """Abstract base class for cache implementations."""
    
    @abstractmethod
    async def connect(self) -> None:
        """Initialize connection."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Close connection."""
        pass
    
    @abstractmethod
    async def get(self, key: str) -> str | None:
        """Get a value."""
        pass
    
    @abstractmethod
    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> bool:
        """Set a value."""
        pass
    
    @abstractmethod
    async def delete(self, key: str) -> int:
        """Delete a key."""
        pass
    
    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        pass
    
    @abstractmethod
    async def incr(self, key: str) -> int:
        """Increment a counter."""
        pass
    
    @abstractmethod
    async def expire(self, key: str, ttl_seconds: int) -> bool:
        """Set TTL on a key."""
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check connection health."""
        pass


class StandardRedisClient(BaseCacheClient):
    """
    Standard Redis client using TCP connection.
    
    Used for local development and self-hosted Redis.
    """
    
    def __init__(self) -> None:
        self._client = None
    
    async def connect(self) -> None:
        if self._client is not None:
            return
        
        import redis.asyncio as redis
        
        logger.info(
            "Connecting to standard Redis",
            host=settings.redis_host,
            port=settings.redis_port,
        )
        
        self._client = redis.Redis(
            host=settings.redis_host,
            port=settings.redis_port,
            password=settings.redis_password or None,
            db=settings.redis_db,
            decode_responses=True,
        )
        
        await self._client.ping()
        logger.info("Standard Redis connection established")
    
    async def disconnect(self) -> None:
        if self._client is None:
            return
        
        logger.info("Closing standard Redis connection")
        await self._client.close()
        self._client = None
        logger.info("Standard Redis connection closed")
    
    @property
    def client(self):
        if self._client is None:
            raise RuntimeError("Redis client not initialized. Call connect() first.")
        return self._client
    
    async def get(self, key: str) -> str | None:
        return await self.client.get(key)
    
    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> bool:
        if ttl_seconds:
            return await self.client.setex(key, ttl_seconds, value)
        return await self.client.set(key, value)
    
    async def delete(self, key: str) -> int:
        return await self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        return bool(await self.client.exists(key))
    
    async def incr(self, key: str) -> int:
        return await self.client.incr(key)
    
    async def expire(self, key: str, ttl_seconds: int) -> bool:
        return await self.client.expire(key, ttl_seconds)
    
    async def health_check(self) -> bool:
        try:
            return await self.client.ping()
        except Exception as e:
            logger.error("Standard Redis health check failed", error=str(e))
            return False


class UpstashRedisClient(BaseCacheClient):
    """
    Upstash Redis client using HTTP REST API.
    
    Used for free-tier cloud deployments (Render, Vercel, etc.).
    Upstash provides a serverless Redis with HTTP-based access.
    """
    
    def __init__(self) -> None:
        self._client = None
    
    async def connect(self) -> None:
        if self._client is not None:
            return
        
        from upstash_redis import Redis
        
        logger.info(
            "Connecting to Upstash Redis (HTTP)",
            url=settings.upstash_redis_rest_url[:30] + "...",
        )
        
        self._client = Redis(
            url=settings.upstash_redis_rest_url,
            token=settings.upstash_redis_rest_token,
        )
        
        # Test connection
        self._client.ping()
        logger.info("Upstash Redis connection established")
    
    async def disconnect(self) -> None:
        if self._client is None:
            return
        
        logger.info("Closing Upstash Redis connection")
        self._client = None
        logger.info("Upstash Redis connection closed")
    
    @property
    def client(self):
        if self._client is None:
            raise RuntimeError("Upstash client not initialized. Call connect() first.")
        return self._client
    
    async def get(self, key: str) -> str | None:
        # Upstash client is synchronous but HTTP-based (non-blocking)
        result = self.client.get(key)
        return str(result) if result is not None else None
    
    async def set(self, key: str, value: str, ttl_seconds: int | None = None) -> bool:
        if ttl_seconds:
            result = self.client.setex(key, ttl_seconds, value)
        else:
            result = self.client.set(key, value)
        return bool(result)
    
    async def delete(self, key: str) -> int:
        return self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        return bool(self.client.exists(key))
    
    async def incr(self, key: str) -> int:
        return self.client.incr(key)
    
    async def expire(self, key: str, ttl_seconds: int) -> bool:
        return bool(self.client.expire(key, ttl_seconds))
    
    async def health_check(self) -> bool:
        try:
            return bool(self.client.ping())
        except Exception as e:
            logger.error("Upstash Redis health check failed", error=str(e))
            return False


class RedisCache:
    """
    Unified Redis cache manager.
    
    Automatically selects between Standard Redis (TCP) and Upstash Redis (HTTP)
    based on environment configuration.
    
    - If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set, uses Upstash
    - Otherwise, falls back to standard Redis connection
    """
    
    def __init__(self) -> None:
        """Initialize Redis cache manager with appropriate backend."""
        self._backend: BaseCacheClient | None = None
    
    async def connect(self) -> None:
        """
        Create Redis connection using appropriate backend.
        
        Should be called during application startup.
        """
        if self._backend is not None:
            return
        
        if settings.use_upstash:
            logger.info("Using Upstash Redis (HTTP REST API)")
            self._backend = UpstashRedisClient()
        else:
            logger.info("Using Standard Redis (TCP)")
            self._backend = StandardRedisClient()
        
        await self._backend.connect()
    
    async def disconnect(self) -> None:
        """
        Close Redis connection.
        
        Should be called during application shutdown.
        """
        if self._backend is None:
            return
        
        await self._backend.disconnect()
        self._backend = None
    
    @property
    def backend(self) -> BaseCacheClient:
        """
        Get the cache backend.
        
        Raises:
            RuntimeError: If backend is not initialized
        
        Returns:
            BaseCacheClient: Cache backend
        """
        if self._backend is None:
            raise RuntimeError("Cache backend not initialized. Call connect() first.")
        return self._backend
    
    async def get(self, key: str) -> str | None:
        """Get a value from cache."""
        return await self.backend.get(key)
    
    async def set(
        self,
        key: str,
        value: str,
        ttl_seconds: int | None = None,
    ) -> bool:
        """Set a value in cache."""
        return await self.backend.set(key, value, ttl_seconds)
    
    async def delete(self, key: str) -> int:
        """Delete a key from cache."""
        return await self.backend.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if a key exists."""
        return await self.backend.exists(key)
    
    async def incr(self, key: str) -> int:
        """Increment a counter."""
        return await self.backend.incr(key)
    
    async def expire(self, key: str, ttl_seconds: int) -> bool:
        """Set TTL on an existing key."""
        return await self.backend.expire(key, ttl_seconds)
    
    async def get_json(self, key: str) -> dict[str, Any] | None:
        """Get a JSON value from cache."""
        import orjson
        
        value = await self.get(key)
        if value is None:
            return None
        return orjson.loads(value)
    
    async def set_json(
        self,
        key: str,
        value: dict[str, Any],
        ttl_seconds: int | None = None,
    ) -> bool:
        """Set a JSON value in cache."""
        import orjson
        
        return await self.set(key, orjson.dumps(value).decode(), ttl_seconds)
    
    async def health_check(self) -> bool:
        """Check if Redis connection is healthy."""
        return await self.backend.health_check()


# Global Redis cache instance
cache = RedisCache()


async def get_cache() -> RedisCache:
    """
    FastAPI dependency for cache access.
    
    Returns:
        RedisCache: Cache instance
    """
    return cache
