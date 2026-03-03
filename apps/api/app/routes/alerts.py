"""
Alerts Routes

Handles alert rule management and notification channels.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
import structlog

from app.core.database import db, Database, get_db
from app.routes.auth import get_current_user, CurrentUser
from app.models.incidents import AlertRule, AlertRuleCreate, AlertRuleUpdate, AlertChannel
from app.models import BaseSchema

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# List Alert Rules
# ============================================================================

@router.get(
    "/rules",
    response_model=list[AlertRule],
    summary="List alert rules",
    description="List all alert rules for the organization.",
)
async def list_alert_rules(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    enabled: bool | None = Query(None, description="Filter by enabled status"),
):
    """
    List alert rules configured for the organization.
    """
    conditions = ["org_id = $1"]
    params: list = [current_user.org_id]
    param_idx = 2
    
    if enabled is not None:
        conditions.append(f"enabled = ${param_idx}")
        params.append(enabled)
        param_idx += 1
    
    where_clause = " AND ".join(conditions)
    
    rows = await database.fetch_all(
        f"""
        SELECT *
        FROM alert_rules
        WHERE {where_clause}
        ORDER BY created_at DESC
        """,
        *params,
    )
    
    return [AlertRule(**dict(row)) for row in rows]


# ============================================================================
# Get Alert Rule
# ============================================================================

@router.get(
    "/rules/{rule_id}",
    response_model=AlertRule,
    summary="Get alert rule",
    responses={404: {"description": "Alert rule not found"}},
)
async def get_alert_rule(
    rule_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Get details of a specific alert rule.
    """
    row = await database.fetch_one(
        """
        SELECT *
        FROM alert_rules
        WHERE id = $1 AND org_id = $2
        """,
        rule_id,
        current_user.org_id,
    )
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found",
        )
    
    return AlertRule(**dict(row))


# ============================================================================
# Create Alert Rule
# ============================================================================

@router.post(
    "/rules",
    response_model=AlertRule,
    status_code=status.HTTP_201_CREATED,
    summary="Create alert rule",
    description="Create a new alert rule.",
)
async def create_alert_rule(
    request: AlertRuleCreate,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Create a new alert rule.
    
    Alert rules define conditions that trigger incidents or notifications.
    
    Supported conditions:
    - success_rate_below: Trigger when success rate drops below threshold
    - cost_exceeds: Trigger when cost exceeds threshold
    - latency_p95_exceeds: Trigger when P95 latency exceeds threshold
    - loop_detected: Trigger immediately on loop detection
    - error_rate_above: Trigger when error rate exceeds threshold
    """
    rule_id = uuid4()
    
    row = await database.fetch_one(
        """
        INSERT INTO alert_rules (
            id, org_id, name, description,
            severity, conditions, 
            agent_filter, project_filter,
            channels, enabled,
            created_by
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6,
            $7, $8,
            $9, $10,
            $11
        )
        RETURNING *
        """,
        rule_id,
        current_user.org_id,
        request.name,
        request.description,
        request.severity.value,
        request.conditions,
        request.agent_filter,
        request.project_filter,
        request.channels,
        request.enabled,
        current_user.id,
    )
    
    logger.info(
        "Alert rule created",
        rule_id=str(rule_id),
        name=request.name,
        severity=request.severity.value,
    )
    
    return AlertRule(**dict(row))


# ============================================================================
# Update Alert Rule
# ============================================================================

@router.put(
    "/rules/{rule_id}",
    response_model=AlertRule,
    summary="Update alert rule",
    responses={404: {"description": "Alert rule not found"}},
)
async def update_alert_rule(
    rule_id: UUID,
    request: AlertRuleUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Update an existing alert rule.
    """
    updates = []
    params = []
    param_idx = 1
    
    if request.name is not None:
        updates.append(f"name = ${param_idx}")
        params.append(request.name)
        param_idx += 1
    
    if request.description is not None:
        updates.append(f"description = ${param_idx}")
        params.append(request.description)
        param_idx += 1
    
    if request.severity is not None:
        updates.append(f"severity = ${param_idx}")
        params.append(request.severity.value)
        param_idx += 1
    
    if request.conditions is not None:
        updates.append(f"conditions = ${param_idx}")
        params.append(request.conditions)
        param_idx += 1
    
    if request.channels is not None:
        updates.append(f"channels = ${param_idx}")
        params.append(request.channels)
        param_idx += 1
    
    if request.enabled is not None:
        updates.append(f"enabled = ${param_idx}")
        params.append(request.enabled)
        param_idx += 1
    
    if request.agent_filter is not None:
        updates.append(f"agent_filter = ${param_idx}")
        params.append(request.agent_filter)
        param_idx += 1
    
    if request.project_filter is not None:
        updates.append(f"project_filter = ${param_idx}")
        params.append(request.project_filter)
        param_idx += 1
    
    if not updates:
        return await get_alert_rule(rule_id, current_user, database)
    
    updates.append("updated_at = NOW()")
    params.extend([rule_id, current_user.org_id])
    
    row = await database.fetch_one(
        f"""
        UPDATE alert_rules
        SET {", ".join(updates)}
        WHERE id = ${param_idx} AND org_id = ${param_idx + 1}
        RETURNING *
        """,
        *params,
    )
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found",
        )
    
    logger.info(
        "Alert rule updated",
        rule_id=str(rule_id),
        updates=list(request.model_dump(exclude_unset=True).keys()),
    )
    
    return AlertRule(**dict(row))


# ============================================================================
# Delete Alert Rule
# ============================================================================

@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete alert rule",
    responses={404: {"description": "Alert rule not found"}},
)
async def delete_alert_rule(
    rule_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Delete an alert rule.
    """
    result = await database.execute(
        """
        DELETE FROM alert_rules
        WHERE id = $1 AND org_id = $2
        """,
        rule_id,
        current_user.org_id,
    )
    
    if result == "DELETE 0":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found",
        )
    
    logger.info("Alert rule deleted", rule_id=str(rule_id))


# ============================================================================
# Test Alert Rule
# ============================================================================

class TestAlertResult(BaseSchema):
    """Result of testing an alert rule."""
    would_trigger: bool
    matching_executions: int
    sample_matches: list[dict[str, Any]]
    evaluation_details: dict[str, Any]


@router.post(
    "/rules/{rule_id}/test",
    response_model=TestAlertResult,
    summary="Test alert rule",
    description="Test an alert rule against recent data.",
)
async def test_alert_rule(
    rule_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    lookback_hours: int = Query(1, ge=1, le=24, description="Hours to look back"),
):
    """
    Test an alert rule against recent data to see if it would trigger.
    """
    rule_row = await database.fetch_one(
        """
        SELECT *
        FROM alert_rules
        WHERE id = $1 AND org_id = $2
        """,
        rule_id,
        current_user.org_id,
    )
    
    if not rule_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert rule not found",
        )
    
    conditions = rule_row["conditions"]
    from_time = datetime.utcnow() - timedelta(hours=lookback_hours)
    
    # Evaluate different condition types
    evaluation = {}
    matching_executions = 0
    sample_matches = []
    would_trigger = False
    
    # Apply filters
    base_conditions = ["org_id = $1", "started_at >= $2"]
    base_params: list = [current_user.org_id, from_time]
    param_idx = 3
    
    if rule_row["agent_filter"]:
        base_conditions.append(f"agent_id = ANY(${param_idx})")
        base_params.append(rule_row["agent_filter"])
        param_idx += 1
    
    if rule_row["project_filter"]:
        base_conditions.append(f"project_id = ANY(${param_idx})")
        base_params.append(rule_row["project_filter"])
        param_idx += 1
    
    where_clause = " AND ".join(base_conditions)
    
    # Check success_rate_below
    if "success_rate_below" in conditions:
        threshold = conditions["success_rate_below"]
        stats = await database.fetch_one(
            f"""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'success') as successful
            FROM agent_executions
            WHERE {where_clause}
            """,
            *base_params,
        )
        
        success_rate = stats["successful"] / stats["total"] if stats["total"] > 0 else 1.0
        evaluation["success_rate"] = {
            "current": success_rate,
            "threshold": threshold,
            "triggered": success_rate < threshold,
        }
        
        if success_rate < threshold:
            would_trigger = True
            # Get sample failed executions
            failures = await database.fetch_all(
                f"""
                SELECT execution_id, agent_id, status, started_at
                FROM agent_executions
                WHERE {where_clause} AND status != 'success'
                LIMIT 5
                """,
                *base_params,
            )
            sample_matches = [dict(r) for r in failures]
            matching_executions = stats["total"] - stats["successful"]
    
    # Check cost_exceeds
    if "cost_exceeds" in conditions:
        threshold = Decimal(str(conditions["cost_exceeds"]))
        cost_stats = await database.fetch_one(
            f"""
            SELECT COALESCE(SUM(total_cost_usd), 0) as total_cost
            FROM agent_executions
            WHERE {where_clause}
            """,
            *base_params,
        )
        
        total_cost = cost_stats["total_cost"]
        evaluation["cost"] = {
            "current": float(total_cost),
            "threshold": float(threshold),
            "triggered": total_cost > threshold,
        }
        
        if total_cost > threshold:
            would_trigger = True
    
    # Check error_rate_above
    if "error_rate_above" in conditions:
        threshold = conditions["error_rate_above"]
        stats = await database.fetch_one(
            f"""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
            FROM agent_executions
            WHERE {where_clause}
            """,
            *base_params,
        )
        
        error_rate = stats["failed"] / stats["total"] if stats["total"] > 0 else 0.0
        evaluation["error_rate"] = {
            "current": error_rate,
            "threshold": threshold,
            "triggered": error_rate > threshold,
        }
        
        if error_rate > threshold:
            would_trigger = True
            matching_executions = stats["failed"]
    
    return TestAlertResult(
        would_trigger=would_trigger,
        matching_executions=matching_executions,
        sample_matches=sample_matches,
        evaluation_details=evaluation,
    )


# ============================================================================
# List Notification Channels  
# ============================================================================

class NotificationChannel(BaseSchema):
    """Notification channel configuration."""
    id: UUID
    name: str
    channel_type: str  # email, slack, webhook, pagerduty
    config: dict[str, Any]
    enabled: bool
    created_at: datetime
    updated_at: datetime


@router.get(
    "/channels",
    response_model=list[NotificationChannel],
    summary="List notification channels",
    description="List configured notification channels.",
)
async def list_channels(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    List notification channels.
    
    Note: This is a placeholder. Would need a notification_channels table.
    """
    # Placeholder - would query notification_channels table
    return []
