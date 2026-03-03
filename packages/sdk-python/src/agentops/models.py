"""
Data models for the AgentOps SDK.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field


class ExecutionStatus(str, Enum):
    """Execution status."""
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    LOOP_DETECTED = "loop_detected"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class EventType(str, Enum):
    """Event types."""
    LLM_CALL = "llm_call"
    TOOL_CALL = "tool_call"
    MEMORY_READ = "memory_read"
    MEMORY_WRITE = "memory_write"
    PLANNING_STEP = "planning_step"
    SUBAGENT_CALL = "subagent_call"
    ERROR = "error"
    CHECKPOINT = "checkpoint"
    CUSTOM = "custom"


class BaseEvent(BaseModel):
    """Base event model."""
    
    model_config = ConfigDict(
        use_enum_values=True,
        populate_by_name=True,
    )
    
    event_id: UUID = Field(default_factory=uuid4)
    execution_id: UUID
    event_type: EventType
    sequence_number: int = 0
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    duration_ms: int | None = None
    
    # Token and cost tracking
    cost_usd: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    thinking_tokens: int | None = None
    
    metadata: dict[str, Any] = Field(default_factory=dict)


class LLMCallEvent(BaseEvent):
    """LLM call event."""
    
    event_type: EventType = EventType.LLM_CALL
    
    model_id: str
    provider: str | None = None
    temperature: float | None = None
    
    llm_input: dict[str, Any]
    llm_output: dict[str, Any] | None = None
    
    # Whether output is streaming
    is_streaming: bool = False


class ToolCallEvent(BaseEvent):
    """Tool call event."""
    
    event_type: EventType = EventType.TOOL_CALL
    
    tool_name: str
    tool_input: dict[str, Any]
    tool_output: dict[str, Any] | None = None
    tool_error: str | None = None


class ErrorEvent(BaseEvent):
    """Error event."""
    
    event_type: EventType = EventType.ERROR
    
    error_type: str
    error_message: str
    error_traceback: str | None = None


class CustomEvent(BaseEvent):
    """Custom event."""
    
    event_type: EventType = EventType.CUSTOM
    
    custom_type: str
    data: dict[str, Any] = Field(default_factory=dict)


class Execution(BaseModel):
    """Execution (trace) model."""
    
    model_config = ConfigDict(
        use_enum_values=True,
        populate_by_name=True,
    )
    
    execution_id: UUID = Field(default_factory=uuid4)
    agent_id: str
    project_id: UUID | None = None
    version: str | None = None
    environment: str = "production"
    
    status: ExecutionStatus = ExecutionStatus.RUNNING
    
    task_input: dict[str, Any] | None = None
    final_output: dict[str, Any] | None = None
    error_details: dict[str, Any] | None = None
    
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestBatch(BaseModel):
    """Batch of events for ingestion."""
    
    executions: list[dict[str, Any]] = Field(default_factory=list)
    events: list[dict[str, Any]] = Field(default_factory=list)
