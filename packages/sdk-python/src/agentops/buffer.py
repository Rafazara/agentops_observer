"""
Async event buffer with batching, retry, and circuit breaker.
"""

import asyncio
from datetime import datetime, timedelta
from enum import Enum
import logging
import random
from typing import Any

import httpx

from agentops.config import Config
from agentops.models import IngestBatch

logger = logging.getLogger("agentops")


class CircuitState(Enum):
    """Circuit breaker state."""
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class EventBuffer:
    """
    Async event buffer with batching, retry, and circuit breaker.
    
    Features:
    - Batches events for efficient network usage
    - Automatic flush on buffer size or interval
    - Exponential backoff retry with jitter
    - Circuit breaker to prevent cascade failures
    """
    
    def __init__(self, config: Config):
        self.config = config
        
        # Buffer state
        self._events: list[dict[str, Any]] = []
        self._executions: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()
        
        # Circuit breaker state
        self._circuit_state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: datetime | None = None
        
        # HTTP client
        self._client: httpx.AsyncClient | None = None
        
        # Background task
        self._flush_task: asyncio.Task | None = None
        self._shutdown_event = asyncio.Event()
    
    async def start(self) -> None:
        """Start the buffer with background flush task."""
        if self.config.disabled:
            return
        
        self._client = httpx.AsyncClient(
            base_url=self.config.endpoint,
            headers={
                "X-API-Key": self.config.api_key or "",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        
        # Start background flush
        self._flush_task = asyncio.create_task(self._flush_loop())
    
    async def stop(self) -> None:
        """Stop the buffer and flush remaining events."""
        if self._flush_task:
            self._shutdown_event.set()
            await self._flush_task
            self._flush_task = None
        
        # Final flush
        await self.flush()
        
        if self._client:
            await self._client.aclose()
            self._client = None
    
    async def add_event(self, event: dict[str, Any]) -> None:
        """Add an event to the buffer."""
        if self.config.disabled:
            return
        
        async with self._lock:
            self._events.append(event)
            
            # Flush if buffer is full
            if len(self._events) >= self.config.buffer_size:
                asyncio.create_task(self.flush())
    
    async def add_execution(self, execution: dict[str, Any]) -> None:
        """Add an execution (trace) to the buffer."""
        if self.config.disabled:
            return
        
        async with self._lock:
            # Check for existing execution with same ID
            for i, ex in enumerate(self._executions):
                if ex.get("execution_id") == execution.get("execution_id"):
                    # Update existing
                    self._executions[i] = execution
                    return
            
            self._executions.append(execution)
    
    async def flush(self) -> bool:
        """Flush buffered events to the server."""
        if self.config.disabled or self._client is None:
            return True
        
        # Check circuit breaker
        if not self._can_send():
            logger.warning("Circuit breaker is open, dropping events")
            return False
        
        # Get events to flush
        async with self._lock:
            if not self._events and not self._executions:
                return True
            
            events = self._events.copy()
            executions = self._executions.copy()
            self._events.clear()
            self._executions.clear()
        
        batch = IngestBatch(
            executions=executions,
            events=events,
        )
        
        # Send with retry
        return await self._send_with_retry(batch)
    
    async def _flush_loop(self) -> None:
        """Background loop that flushes events periodically."""
        interval_seconds = self.config.flush_interval_ms / 1000.0
        
        while not self._shutdown_event.is_set():
            try:
                await asyncio.wait_for(
                    self._shutdown_event.wait(),
                    timeout=interval_seconds,
                )
                # Shutdown requested
                break
            except asyncio.TimeoutError:
                # Timeout - time to flush
                await self.flush()
    
    def _can_send(self) -> bool:
        """Check if we can send based on circuit breaker state."""
        if self._circuit_state == CircuitState.CLOSED:
            return True
        
        if self._circuit_state == CircuitState.OPEN:
            # Check if we should try again
            if self._last_failure_time:
                reset_time = self._last_failure_time + timedelta(
                    milliseconds=self.config.circuit_breaker_reset_ms
                )
                if datetime.utcnow() >= reset_time:
                    self._circuit_state = CircuitState.HALF_OPEN
                    return True
            return False
        
        # HALF_OPEN - allow one request
        return True
    
    def _record_success(self) -> None:
        """Record successful request."""
        self._failure_count = 0
        self._circuit_state = CircuitState.CLOSED
    
    def _record_failure(self) -> None:
        """Record failed request."""
        self._failure_count += 1
        self._last_failure_time = datetime.utcnow()
        
        if self._failure_count >= self.config.circuit_breaker_threshold:
            self._circuit_state = CircuitState.OPEN
            logger.warning(
                f"Circuit breaker opened after {self._failure_count} failures"
            )
    
    async def _send_with_retry(self, batch: IngestBatch) -> bool:
        """Send batch with exponential backoff retry."""
        for attempt in range(self.config.max_retries):
            try:
                response = await self._client.post(
                    "/api/v1/ingest/events",
                    json=batch.model_dump(mode="json"),
                )
                
                if response.status_code == 202:
                    self._record_success()
                    if self.config.debug:
                        logger.debug(
                            f"Flushed {len(batch.events)} events, "
                            f"{len(batch.executions)} executions"
                        )
                    return True
                
                if response.status_code >= 400 and response.status_code < 500:
                    # Client error, don't retry
                    logger.error(
                        f"Client error: {response.status_code} - {response.text}"
                    )
                    self._record_failure()
                    return False
                
                # Server error, retry
                logger.warning(
                    f"Server error: {response.status_code}, attempt {attempt + 1}"
                )
                
            except httpx.HTTPError as e:
                logger.warning(f"HTTP error: {e}, attempt {attempt + 1}")
            
            # Wait before retry with exponential backoff + jitter
            if attempt < self.config.max_retries - 1:
                backoff = self.config.retry_backoff_ms * (2 ** attempt)
                jitter = random.uniform(0, backoff * 0.1)
                await asyncio.sleep((backoff + jitter) / 1000.0)
        
        # All retries failed
        self._record_failure()
        return False
