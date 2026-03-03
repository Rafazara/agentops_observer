"""
Main AgentOps client.
"""

import asyncio
import logging
import random
from typing import Any

from agentops.config import Config
from agentops.buffer import EventBuffer
from agentops.context import TraceContext
from agentops.models import Execution, ExecutionStatus

logger = logging.getLogger("agentops")


class AgentOps:
    """
    Main AgentOps client for tracing and monitoring AI agents.
    
    Example:
        >>> import agentops
        >>> client = agentops.init(api_key="your-key")
        >>> async with agentops.trace_context(agent_id="my-agent") as ctx:
        ...     ctx.record_llm_call(model="gpt-4", ...)
    """
    
    def __init__(
        self,
        api_key: str | None = None,
        endpoint: str = "https://api.agentops.ai",
        **kwargs,
    ):
        """Initialize the AgentOps client."""
        self.config = Config(
            api_key=api_key,
            endpoint=endpoint,
            **{k: v for k, v in kwargs.items() if v is not None},
        )
        
        self._buffer = EventBuffer(self.config)
        self._started = False
        
        # Active traces
        self._active_traces: dict[str, TraceContext] = {}
    
    @property
    def is_disabled(self) -> bool:
        """Check if SDK is disabled."""
        return self.config.disabled
    
    def should_sample(self) -> bool:
        """Check if this trace should be sampled."""
        if self.config.sample_rate >= 1.0:
            return True
        return random.random() < self.config.sample_rate
    
    async def start(self) -> None:
        """Start the client and background tasks."""
        if self._started or self.config.disabled:
            return
        
        await self._buffer.start()
        self._started = True
        
        logger.info("AgentOps SDK initialized", extra={
            "endpoint": self.config.endpoint,
            "environment": self.config.environment,
        })
    
    async def shutdown(self) -> None:
        """Shutdown the client, flushing remaining events."""
        if not self._started:
            return
        
        # End any active traces
        for trace in list(self._active_traces.values()):
            await trace.end(status=ExecutionStatus.CANCELLED)
        
        await self._buffer.stop()
        self._started = False
        
        logger.info("AgentOps SDK shutdown complete")
    
    def create_trace(self, agent_id: str, **kwargs) -> TraceContext:
        """
        Create a new trace context.
        
        Args:
            agent_id: Unique identifier for the agent.
            **kwargs: Additional trace parameters (version, environment, etc.)
        
        Returns:
            TraceContext for the new trace.
        """
        trace = TraceContext(
            client=self,
            agent_id=agent_id,
            version=kwargs.get("version", self.config.version),
            environment=kwargs.get("environment", self.config.environment),
            project_id=kwargs.get("project_id"),
            task_input=kwargs.get("task_input"),
            metadata=kwargs.get("metadata"),
        )
        
        self._active_traces[str(trace.execution_id)] = trace
        return trace
    
    def get_active_trace(self, execution_id: str) -> TraceContext | None:
        """Get an active trace by execution ID."""
        return self._active_traces.get(execution_id)
    
    def _remove_trace(self, execution_id: str) -> None:
        """Remove a trace from active traces."""
        self._active_traces.pop(str(execution_id), None)
    
    async def record_event(self, event: dict[str, Any]) -> None:
        """Record an event to the buffer."""
        if not self._started:
            await self.start()
        
        # Apply PII redaction
        if self.config.redact_pii:
            from agentops.redact import redact_dict
            event = redact_dict(event, self.config.pii_patterns)
        
        await self._buffer.add_event(event)
    
    async def record_execution(self, execution: dict[str, Any]) -> None:
        """Record an execution update to the buffer."""
        if not self._started:
            await self.start()
        
        # Apply PII redaction
        if self.config.redact_pii:
            from agentops.redact import redact_dict
            execution = redact_dict(execution, self.config.pii_patterns)
        
        await self._buffer.add_execution(execution)
    
    async def flush(self) -> bool:
        """Manually flush the event buffer."""
        return await self._buffer.flush()
