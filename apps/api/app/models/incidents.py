"""
Incident and Alert Models

Pydantic models for incidents, anomalies, and alert rules.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models import BaseSchema, IncidentSeverity


# ============================================================================
# Enums
# ============================================================================

class IncidentStatus(str, Enum):
    """Incident status."""
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


# ============================================================================
# Incident Models
# ============================================================================

class IncidentBase(BaseSchema):
    """Incident base schema."""
    incident_type: str
    severity: IncidentSeverity
    title: str = Field(..., max_length=500)
    description: str | None = None


class IncidentCreate(IncidentBase):
    """Create incident request (manual)."""
    agent_id: str | None = None
    execution_ids: list[UUID] | None = None


class IncidentUpdate(BaseSchema):
    """Update incident request."""
    status: IncidentStatus | None = None
    severity: IncidentSeverity | None = None
    resolution_notes: str | None = None
    assigned_to: UUID | None = None


class IncidentSummary(BaseSchema):
    """Incident summary for list views."""
    id: UUID
    incident_type: str
    severity: IncidentSeverity
    status: IncidentStatus = IncidentStatus.OPEN
    title: str
    agent_id: str | None
    
    detected_at: datetime
    acknowledged_at: datetime | None
    resolved_at: datetime | None
    
    auto_resolved: bool = False


class Incident(IncidentSummary):
    """Full incident details."""
    org_id: UUID
    execution_ids: list[UUID] | None = None
    description: str | None
    
    ai_analysis: dict[str, Any] | None = None
    
    acknowledged_by: UUID | None
    resolved_by: UUID | None
    resolution_notes: str | None = None
    assigned_to: UUID | None = None
    
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class IncidentTimeline(BaseSchema):
    """Incident with associated executions and events."""
    incident: Incident
    executions: list[dict[str, Any]]
    events: list[dict[str, Any]]


class IncidentStats(BaseSchema):
    """Incident statistics."""
    period: str
    total_incidents: int
    open_count: int
    acknowledged_count: int
    resolved_count: int
    by_severity: dict[str, int]
    by_type: dict[str, int]
    mtta_hours: float | None  # Mean time to acknowledge
    mttr_hours: float | None  # Mean time to resolve
    daily_counts: list[dict[str, Any]]


class IncidentAcknowledge(BaseSchema):
    """Acknowledge incident request."""
    notes: str | None = None


class IncidentResolve(BaseSchema):
    """Resolve incident request."""
    resolution_notes: str | None = None
    auto_resolved: bool = False


# ============================================================================
# Alert Rule Models
# ============================================================================

class AlertCondition(BaseSchema):
    """Alert condition definition."""
    metric: str  # e.g., "execution_cost", "quality_score", "error_rate"
    operator: str  # "greater_than", "less_than", "equals"
    threshold: float
    window: str  # "single_execution", "5m", "1h", "24h"
    
    # Optional filters
    agent_filter: list[str] | None = None  # Agent IDs or "*" for all
    environment_filter: list[str] | None = None


class AlertChannel(BaseSchema):
    """Alert notification channel."""
    type: str  # "slack", "email", "pagerduty", "opsgenie", "webhook"
    config: dict[str, Any]


class AlertRuleBase(BaseSchema):
    """Alert rule base schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    enabled: bool = True
    severity: IncidentSeverity = IncidentSeverity.WARNING
    
    conditions: dict[str, Any]  # e.g., {"success_rate_below": 0.9, "cost_exceeds": 100}
    channels: list[dict[str, Any]] = Field(default_factory=list)
    
    agent_filter: list[str] | None = None
    project_filter: list[UUID] | None = None


class AlertRuleCreate(AlertRuleBase):
    """Create alert rule request."""
    pass


class AlertRuleUpdate(BaseSchema):
    """Update alert rule request."""
    name: str | None = None
    description: str | None = None
    enabled: bool | None = None
    severity: IncidentSeverity | None = None
    conditions: dict[str, Any] | None = None
    channels: list[dict[str, Any]] | None = None
    agent_filter: list[str] | None = None
    project_filter: list[UUID] | None = None


class AlertRule(AlertRuleBase):
    """Alert rule response."""
    id: UUID
    org_id: UUID
    
    last_triggered_at: datetime | None = None
    trigger_count: int = 0
    
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime | None = None


class AlertHistory(BaseSchema):
    """Alert trigger history entry."""
    id: UUID
    alert_rule_id: UUID
    incident_id: UUID | None
    
    triggered_at: datetime
    channels_notified: list[str]
    
    metric_value: float
    threshold: float


# ============================================================================
# Anomaly Detection Models
# ============================================================================

class AnomalyType(BaseSchema):
    """Detected anomaly type."""
    LOOP_DETECTED = "loop_detected"
    COST_SPIKE = "cost_spike"
    QUALITY_DEGRADATION = "quality_degradation"
    GOAL_DRIFT = "goal_drift"
    VERSION_REGRESSION = "version_regression"
    TOOL_FAILURE_CASCADE = "tool_failure_cascade"
    HALLUCINATION_PATTERN = "hallucination_pattern"


class DetectedAnomaly(BaseSchema):
    """Detected anomaly details."""
    anomaly_type: str
    severity: IncidentSeverity
    
    agent_id: str
    execution_id: UUID | None
    
    description: str
    evidence: dict[str, Any]
    
    detected_at: datetime
    confidence: float  # 0-1
