"""
Execution and Event Models

Pydantic models for agent executions and execution events.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models import (
    BaseSchema,
    EnvironmentType,
    EventType,
    ExecutionStatus,
    ProviderType,
)


# ============================================================================
# Execution Models
# ============================================================================

class ExecutionBase(BaseSchema):
    """Execution base schema."""
    agent_id: str
    project_id: UUID | None = None
    version: str | None = None
    environment: EnvironmentType = EnvironmentType.PRODUCTION
    task_input: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExecutionCreate(ExecutionBase):
    """Create execution request (from SDK)."""
    execution_id: UUID | None = None  # Allow SDK to specify ID


class ExecutionUpdate(BaseSchema):
    """Update execution request."""
    status: ExecutionStatus | None = None
    final_output: dict[str, Any] | None = None
    error_details: dict[str, Any] | None = None
    quality_score: Decimal | None = None
    goal_completion_score: Decimal | None = None
    reasoning_coherence_score: Decimal | None = None
    tool_efficiency_score: Decimal | None = None


class ExecutionSummary(BaseSchema):
    """Execution summary for list views."""
    execution_id: UUID
    agent_id: str
    project_id: UUID | None
    version: str | None
    environment: EnvironmentType
    status: ExecutionStatus
    
    # Scores
    quality_score: Decimal | None
    
    # Cost & tokens
    total_cost_usd: Decimal
    total_tokens: int
    
    # Timing
    duration_ms: int | None
    started_at: datetime
    completed_at: datetime | None
    
    # Counts
    llm_calls_count: int
    tool_calls_count: int


class Execution(ExecutionSummary):
    """Full execution details."""
    org_id: UUID
    
    # Task data
    task_input: dict[str, Any] | None
    final_output: dict[str, Any] | None
    error_details: dict[str, Any] | None
    
    # Quality scores
    goal_completion_score: Decimal | None
    reasoning_coherence_score: Decimal | None
    tool_efficiency_score: Decimal | None
    
    # Token breakdown
    input_tokens: int
    output_tokens: int
    thinking_tokens: int
    
    # Metadata
    metadata: dict[str, Any]


class ExecutionWithTrace(Execution):
    """Execution with full event trace."""
    events: list["ExecutionEvent"]


# ============================================================================
# Execution Event Models
# ============================================================================

class ExecutionEventBase(BaseSchema):
    """Execution event base schema."""
    event_type: EventType
    sequence_number: int = 0
    duration_ms: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExecutionEventCreate(ExecutionEventBase):
    """Create execution event request."""
    execution_id: UUID
    
    # Cost and tokens
    cost_usd: Decimal | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    thinking_tokens: int | None = None
    
    # LLM call data
    model_id: str | None = None
    provider: ProviderType | None = None
    temperature: Decimal | None = None
    llm_input: dict[str, Any] | None = None
    llm_output: dict[str, Any] | None = None
    
    # Tool call data
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    tool_output: dict[str, Any] | None = None
    
    # Error data
    error: dict[str, Any] | None = None


class ExecutionEvent(ExecutionEventBase):
    """Execution event response."""
    event_id: UUID
    execution_id: UUID
    org_id: UUID
    occurred_at: datetime
    
    # Cost and tokens
    cost_usd: Decimal
    input_tokens: int
    output_tokens: int
    thinking_tokens: int
    
    # LLM call data
    model_id: str | None
    provider: ProviderType | None
    temperature: Decimal | None
    llm_input: dict[str, Any] | None
    llm_output: dict[str, Any] | None
    
    # Tool call data
    tool_name: str | None
    tool_input: dict[str, Any] | None
    tool_output: dict[str, Any] | None
    
    # Error data
    error: dict[str, Any] | None


# ============================================================================
# Statistics Models
# ============================================================================

class ExecutionStats(BaseSchema):
    """Execution statistics for a time period."""
    total_executions: int
    successful: int
    failed: int
    loops_detected: int
    timeouts: int
    
    success_rate: float
    
    avg_quality_score: float | None
    avg_duration_ms: float | None
    p95_duration_ms: float | None
    
    total_cost_usd: Decimal
    total_tokens: int
    avg_cost_per_execution: Decimal | None


class AgentStats(BaseSchema):
    """Agent performance statistics."""
    agent_id: str
    period: str
    
    executions: ExecutionStats
    
    # Time series data
    hourly_executions: list[dict[str, Any]] | None = None
    hourly_costs: list[dict[str, Any]] | None = None
    hourly_quality: list[dict[str, Any]] | None = None


class AgentComparison(BaseSchema):
    """Comparison between two agent versions."""
    agent_id: str
    version_a: str
    version_b: str
    
    stats_a: ExecutionStats
    stats_b: ExecutionStats
    
    quality_diff: float | None
    cost_diff: Decimal | None
    duration_diff: float | None
    success_rate_diff: float | None
    
    recommendation: str | None


# ============================================================================
# AI Analysis Models
# ============================================================================

class SemanticAnalysis(BaseSchema):
    """AI-powered execution analysis."""
    execution_id: UUID
    
    root_cause: str | None
    failure_category: str | None
    
    goal_completion: int  # 0-100
    reasoning_quality: int  # 0-100
    
    recommended_fix: str | None
    confidence: float  # 0-1
    
    analyzed_at: datetime


# Update forward references
ExecutionWithTrace.model_rebuild()
