"""
Cost and Analytics Models

Pydantic models for cost tracking, forecasting, and analytics.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models import BaseSchema, ProviderType


# ============================================================================
# Cost Models
# ============================================================================

class CostSummary(BaseSchema):
    """Cost summary for a period."""
    period: str
    
    total_cost_usd: Decimal
    total_tokens: int
    execution_count: int
    
    cost_change_pct: float | None = None
    prev_period_cost_usd: Decimal | None = None
    avg_cost_per_execution: Decimal | None = None
    
    breakdown_by_model: list[dict[str, Any]] = Field(default_factory=list)
    breakdown_by_agent: list[dict[str, Any]] = Field(default_factory=list)
    daily_costs: list[dict[str, Any]] = Field(default_factory=list)


class CostByAgent(BaseSchema):
    """Cost breakdown by agent."""
    agent_id: str
    display_name: str | None
    
    total_cost_usd: Decimal
    total_tokens: int
    total_executions: int
    
    avg_cost_per_execution: Decimal
    percent_of_total: float


class CostByProject(BaseSchema):
    """Cost breakdown by project."""
    project_id: UUID | None
    project_name: str | None
    
    total_cost_usd: Decimal
    total_tokens: int
    total_executions: int
    
    agent_count: int
    percent_of_total: float


class CostByModel(BaseSchema):
    """Cost breakdown by LLM model."""
    provider: ProviderType
    model_id: str
    display_name: str | None
    
    total_cost_usd: Decimal
    total_tokens: int
    total_calls: int
    
    avg_cost_per_call: Decimal
    percent_of_total: float


class DailyCost(BaseSchema):
    """Daily cost data point."""
    date: date
    total_cost_usd: Decimal
    total_tokens: int
    total_executions: int


class CostTimeSeries(BaseSchema):
    """Cost time series data."""
    period: str  # "day", "week", "month"
    data: list[DailyCost]
    
    total_cost_usd: Decimal
    avg_daily_cost: Decimal


# ============================================================================
# Forecast Models
# ============================================================================

class CostForecast(BaseSchema):
    """Cost forecast."""
    horizon: str
    
    forecast_cost_usd: float | None
    confidence_low: float | None
    confidence_high: float | None
    
    trend: str  # "increasing", "decreasing", "stable", "insufficient_data"
    avg_daily_cost: float | None = None
    
    daily_forecast: list[dict[str, Any]] = Field(default_factory=list)


class CostBreakdown(BaseSchema):
    """Cost breakdown by dimension."""
    dimension: str  # "model", "agent", "project"
    items: list[dict[str, Any]]


class ModelCostComparison(BaseSchema):
    """Model cost comparison."""
    model_id: str
    provider: str | None
    call_count: int
    total_cost_usd: float
    input_tokens: int
    output_tokens: int
    cost_per_1k_tokens: float | None
    avg_latency_ms: float | None
    input_cost_per_million: float | None
    output_cost_per_million: float | None
    context_window: int | None = None


class CostAlert(BaseSchema):
    """Cost alert."""
    alert_type: str  # "spike", "budget", "threshold"
    severity: str  # "warning", "critical"
    message: str
    current_value: float
    threshold_value: float
    detected_at: str


# ============================================================================
# Model Comparison
# ============================================================================

class ModelPricing(BaseSchema):
    """LLM model pricing information."""
    provider: ProviderType
    model_id: str
    display_name: str | None
    
    input_cost_per_million: Decimal
    output_cost_per_million: Decimal
    thinking_cost_per_million: Decimal
    
    context_window: int | None
    max_output_tokens: int | None


class ModelComparisonResult(BaseSchema):
    """Result of comparing costs across models."""
    current_model: str
    current_cost: Decimal
    
    alternatives: list[dict[str, Any]]
    # Each: {model_id, provider, estimated_cost, savings, savings_percent}
    
    best_alternative: str | None
    max_savings: Decimal | None
    max_savings_percent: float | None


# ============================================================================
# Export Models
# ============================================================================

class CostExportRequest(BaseSchema):
    """Cost export request."""
    start_date: date
    end_date: date
    group_by: str = "day"  # "day", "week", "month"
    include_agents: bool = True
    include_projects: bool = True
    include_models: bool = True


class CostExportResponse(BaseSchema):
    """Cost export response."""
    export_id: UUID
    status: str  # "pending", "processing", "completed", "failed"
    download_url: str | None = None
    expires_at: datetime | None = None
