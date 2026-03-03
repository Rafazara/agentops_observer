"""
Trace context and context management.
"""

from __future__ import annotations

import asyncio
from contextvars import ContextVar
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from agentops.models import (
    Execution,
    ExecutionStatus,
    EventType,
    LLMCallEvent,
    ToolCallEvent,
    ErrorEvent,
    CustomEvent,
)

if TYPE_CHECKING:
    from agentops.client import AgentOps


# Context variable for the current trace
_current_trace: ContextVar[TraceContext | None] = ContextVar("current_trace", default=None)


def get_current_trace() -> TraceContext | None:
    """Get the current trace context."""
    return _current_trace.get()


class TraceContext:
    """
    Context manager for tracing an agent execution.
    
    Records events, LLM calls, tool calls, and manages the execution lifecycle.
    
    Example:
        >>> async with trace_context(client, agent_id="my-agent") as ctx:
        ...     response = await llm.complete("Hello")
        ...     ctx.record_llm_call(model="gpt-4", input=..., output=response)
        ...     ctx.set_outcome(status="success", output={"result": response})
    """
    
    def __init__(
        self,
        client: AgentOps,
        agent_id: str,
        version: str | None = None,
        environment: str = "production",
        project_id: UUID | None = None,
        task_input: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ):
        self._client = client
        self._token = None
        
        # Execution data
        self.execution_id = uuid4()
        self.agent_id = agent_id
        self.version = version
        self.environment = environment
        self.project_id = project_id
        self.task_input = task_input
        self.metadata = metadata or {}
        
        # State
        self._started_at = datetime.utcnow()
        self._completed_at: datetime | None = None
        self._status = ExecutionStatus.RUNNING
        self._final_output: dict[str, Any] | None = None
        self._error_details: dict[str, Any] | None = None
        
        # Event tracking
        self._sequence_number = 0
        self._events: list[dict[str, Any]] = []
        
        # Loop detection
        self._llm_call_hashes: list[str] = []
        self._loop_threshold = 5  # Consecutive similar calls to detect loop
    
    async def __aenter__(self) -> TraceContext:
        """Enter the trace context."""
        # Set context variable
        self._token = _current_trace.set(self)
        
        # Record execution start
        await self._client.record_execution(self._to_execution_dict())
        
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit the trace context."""
        # Reset context variable
        if self._token:
            _current_trace.reset(self._token)
        
        # Handle exception
        if exc_type is not None:
            await self.end(
                status=ExecutionStatus.FAILED,
                error={
                    "type": exc_type.__name__,
                    "message": str(exc_val),
                },
            )
        elif self._status == ExecutionStatus.RUNNING:
            # Still running means success
            await self.end(status=ExecutionStatus.SUCCESS)
        
        # Remove from active traces
        self._client._remove_trace(str(self.execution_id))
    
    def _to_execution_dict(self) -> dict[str, Any]:
        """Convert to execution dictionary for API."""
        return {
            "execution_id": str(self.execution_id),
            "agent_id": self.agent_id,
            "project_id": str(self.project_id) if self.project_id else None,
            "version": self.version,
            "environment": self.environment,
            "status": self._status.value,
            "task_input": self.task_input,
            "final_output": self._final_output,
            "error_details": self._error_details,
            "started_at": self._started_at.isoformat() + "Z",
            "completed_at": self._completed_at.isoformat() + "Z" if self._completed_at else None,
            "metadata": self.metadata,
        }
    
    def _next_sequence(self) -> int:
        """Get the next sequence number."""
        seq = self._sequence_number
        self._sequence_number += 1
        return seq
    
    def _check_loop(self, call_hash: str) -> bool:
        """
        Check for loop detection.
        
        Returns True if a loop is detected.
        """
        self._llm_call_hashes.append(call_hash)
        
        # Keep only recent hashes
        if len(self._llm_call_hashes) > self._loop_threshold * 2:
            self._llm_call_hashes = self._llm_call_hashes[-self._loop_threshold * 2:]
        
        # Check for consecutive identical calls
        if len(self._llm_call_hashes) >= self._loop_threshold:
            recent = self._llm_call_hashes[-self._loop_threshold:]
            if len(set(recent)) == 1:
                return True
        
        return False
    
    async def record_llm_call(
        self,
        model: str,
        input: dict[str, Any],
        output: dict[str, Any] | None = None,
        *,
        provider: str | None = None,
        temperature: float | None = None,
        duration_ms: int | None = None,
        input_tokens: int | None = None,
        output_tokens: int | None = None,
        thinking_tokens: int | None = None,
        cost_usd: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Record an LLM call event.
        
        Args:
            model: Model ID (e.g., "gpt-4", "claude-3-opus").
            input: Input to the LLM (messages, prompt, etc.).
            output: Output from the LLM.
            provider: Provider name (openai, anthropic, etc.).
            temperature: Temperature setting.
            duration_ms: Call duration in milliseconds.
            input_tokens: Number of input tokens.
            output_tokens: Number of output tokens.
            thinking_tokens: Number of thinking/reasoning tokens.
            cost_usd: Cost of the call in USD.
            metadata: Additional metadata.
        """
        # Loop detection
        import hashlib
        call_hash = hashlib.md5(
            f"{model}:{str(input)}".encode()
        ).hexdigest()
        
        if self._check_loop(call_hash):
            await self.end(
                status=ExecutionStatus.LOOP_DETECTED,
                error={
                    "type": "LoopDetected",
                    "message": f"Detected {self._loop_threshold} consecutive identical LLM calls",
                },
            )
            raise RuntimeError("Agent loop detected - terminated execution")
        
        event = LLMCallEvent(
            execution_id=self.execution_id,
            sequence_number=self._next_sequence(),
            model_id=model,
            provider=provider,
            temperature=temperature,
            llm_input=input,
            llm_output=output,
            duration_ms=duration_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            thinking_tokens=thinking_tokens,
            cost_usd=cost_usd,
            metadata=metadata or {},
        )
        
        await self._client.record_event(event.model_dump(mode="json"))
    
    async def record_tool_call(
        self,
        tool_name: str,
        input: dict[str, Any],
        output: dict[str, Any] | None = None,
        *,
        error: str | None = None,
        duration_ms: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Record a tool call event.
        
        Args:
            tool_name: Name of the tool invoked.
            input: Input parameters to the tool.
            output: Output from the tool.
            error: Error message if tool failed.
            duration_ms: Call duration in milliseconds.
            metadata: Additional metadata.
        """
        event = ToolCallEvent(
            execution_id=self.execution_id,
            sequence_number=self._next_sequence(),
            tool_name=tool_name,
            tool_input=input,
            tool_output=output,
            tool_error=error,
            duration_ms=duration_ms,
            metadata=metadata or {},
        )
        
        await self._client.record_event(event.model_dump(mode="json"))
    
    async def record_event(
        self,
        event_type: str,
        data: dict[str, Any] | None = None,
        *,
        duration_ms: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Record a custom event.
        
        Args:
            event_type: Custom event type name.
            data: Event data.
            duration_ms: Duration in milliseconds.
            metadata: Additional metadata.
        """
        event = CustomEvent(
            execution_id=self.execution_id,
            sequence_number=self._next_sequence(),
            custom_type=event_type,
            data=data or {},
            duration_ms=duration_ms,
            metadata=metadata or {},
        )
        
        await self._client.record_event(event.model_dump(mode="json"))
    
    async def record_error(
        self,
        error_type: str,
        error_message: str,
        *,
        traceback: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Record an error event.
        
        Args:
            error_type: Type of error (exception class name).
            error_message: Error message.
            traceback: Full traceback string.
            metadata: Additional metadata.
        """
        event = ErrorEvent(
            execution_id=self.execution_id,
            sequence_number=self._next_sequence(),
            error_type=error_type,
            error_message=error_message,
            error_traceback=traceback,
            metadata=metadata or {},
        )
        
        await self._client.record_event(event.model_dump(mode="json"))
    
    def set_output(self, output: dict[str, Any]) -> None:
        """Set the final output for the execution."""
        self._final_output = output
    
    async def end(
        self,
        status: ExecutionStatus = ExecutionStatus.SUCCESS,
        output: dict[str, Any] | None = None,
        error: dict[str, Any] | None = None,
        quality_score: float | None = None,
    ) -> None:
        """
        End the execution with the given status.
        
        Args:
            status: Final execution status.
            output: Final output (overrides previous set_output).
            error: Error details if failed.
            quality_score: Quality score (0-100).
        """
        self._status = status
        self._completed_at = datetime.utcnow()
        
        if output is not None:
            self._final_output = output
        
        if error is not None:
            self._error_details = error
        
        if quality_score is not None:
            self.metadata["quality_score"] = quality_score
        
        # Record final execution state
        await self._client.record_execution(self._to_execution_dict())


async def trace_context(
    agent_id: str,
    **kwargs,
) -> TraceContext:
    """
    Create a trace context using the global client.
    
    Args:
        agent_id: Unique identifier for the agent.
        **kwargs: Additional trace parameters.
    
    Returns:
        TraceContext for the new trace.
    
    Example:
        >>> async with agentops.trace_context(agent_id="my-agent") as ctx:
        ...     # Your agent code here
        ...     ctx.set_output({"result": "done"})
    """
    import agentops
    
    client = agentops.get_client()
    return client.create_trace(agent_id, **kwargs)
