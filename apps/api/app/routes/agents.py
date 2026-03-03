"""
Agents Routes

Handles agent listing, details, metrics, and version comparison.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
import structlog

from app.core.database import db, Database, get_db
from app.routes.auth import get_current_user, CurrentUser
from app.models import Agent, AgentCreate, AgentUpdate, PaginatedResponse
from app.models.executions import AgentStats, ExecutionStats, AgentComparison

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# List Agents
# ============================================================================

@router.get(
    "",
    response_model=list[Agent],
    summary="List agents",
    description="List all agents for the organization.",
)
async def list_agents(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    project_id: UUID | None = Query(None, description="Filter by project"),
    framework: str | None = Query(None, description="Filter by framework"),
    tags: list[str] | None = Query(None, description="Filter by tags (any match)"),
):
    """
    List all registered agents for the organization.
    """
    conditions = ["org_id = $1"]
    params: list = [current_user.org_id]
    param_idx = 2
    
    if project_id:
        conditions.append(f"project_id = ${param_idx}")
        params.append(project_id)
        param_idx += 1
    
    if framework:
        conditions.append(f"framework = ${param_idx}")
        params.append(framework)
        param_idx += 1
    
    if tags:
        conditions.append(f"tags && ${param_idx}")
        params.append(tags)
        param_idx += 1
    
    where_clause = " AND ".join(conditions)
    
    rows = await database.fetch_all(
        f"""
        SELECT *
        FROM agents
        WHERE {where_clause}
        ORDER BY last_execution_at DESC NULLS LAST, created_at DESC
        """,
        *params,
    )
    
    return [Agent(**dict(row)) for row in rows]


# ============================================================================
# Get Agent
# ============================================================================

@router.get(
    "/{agent_id}",
    response_model=Agent,
    summary="Get agent details",
    responses={
        404: {"description": "Agent not found"},
    },
)
async def get_agent(
    agent_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Get detailed information about a specific agent.
    """
    row = await database.fetch_one(
        """
        SELECT *
        FROM agents
        WHERE agent_id = $1 AND org_id = $2
        """,
        agent_id,
        current_user.org_id,
    )
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    
    return Agent(**dict(row))


# ============================================================================
# Update Agent
# ============================================================================

@router.put(
    "/{agent_id}",
    response_model=Agent,
    summary="Update agent",
    responses={
        404: {"description": "Agent not found"},
    },
)
async def update_agent(
    agent_id: str,
    request: AgentUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Update agent settings.
    """
    # Build update query dynamically
    updates = []
    params = []
    param_idx = 1
    
    if request.display_name is not None:
        updates.append(f"display_name = ${param_idx}")
        params.append(request.display_name)
        param_idx += 1
    
    if request.framework is not None:
        updates.append(f"framework = ${param_idx}")
        params.append(request.framework.value)
        param_idx += 1
    
    if request.tags is not None:
        updates.append(f"tags = ${param_idx}")
        params.append(request.tags)
        param_idx += 1
    
    if request.metadata is not None:
        updates.append(f"metadata = ${param_idx}")
        params.append(request.metadata)
        param_idx += 1
    
    if not updates:
        # No updates provided, just return current state
        return await get_agent(agent_id, current_user, database)
    
    updates.append("updated_at = NOW()")
    
    params.extend([agent_id, current_user.org_id])
    
    row = await database.fetch_one(
        f"""
        UPDATE agents
        SET {", ".join(updates)}
        WHERE agent_id = ${param_idx} AND org_id = ${param_idx + 1}
        RETURNING *
        """,
        *params,
    )
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    
    return Agent(**dict(row))


# ============================================================================
# Agent Metrics
# ============================================================================

@router.get(
    "/{agent_id}/metrics",
    response_model=AgentStats,
    summary="Get agent metrics",
    description="Get performance metrics for an agent over a time period.",
)
async def get_agent_metrics(
    agent_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    period: str = Query("7d", regex="^(1h|24h|7d|30d)$", description="Time period"),
    include_hourly: bool = Query(False, description="Include hourly time series"),
):
    """
    Get detailed performance metrics for an agent.
    """
    # Check agent exists
    agent = await database.fetch_one(
        "SELECT id FROM agents WHERE agent_id = $1 AND org_id = $2",
        agent_id,
        current_user.org_id,
    )
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    
    # Calculate time range
    period_map = {
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    from_time = datetime.utcnow() - period_map[period]
    
    # Get aggregated stats
    stats_row = await database.fetch_one(
        """
        SELECT
            COUNT(*) as total_executions,
            COUNT(*) FILTER (WHERE status = 'success') as successful,
            COUNT(*) FILTER (WHERE status = 'failed') as failed,
            COUNT(*) FILTER (WHERE status = 'loop_detected') as loops_detected,
            COUNT(*) FILTER (WHERE status = 'timeout') as timeouts,
            AVG(quality_score) as avg_quality_score,
            AVG(duration_ms) as avg_duration_ms,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
            SUM(total_cost_usd) as total_cost_usd,
            SUM(total_tokens) as total_tokens
        FROM agent_executions
        WHERE agent_id = $1 AND org_id = $2 AND started_at >= $3
        """,
        agent_id,
        current_user.org_id,
        from_time,
    )
    
    total = stats_row["total_executions"] or 0
    successful = stats_row["successful"] or 0
    
    exec_stats = ExecutionStats(
        total_executions=total,
        successful=successful,
        failed=stats_row["failed"] or 0,
        loops_detected=stats_row["loops_detected"] or 0,
        timeouts=stats_row["timeouts"] or 0,
        success_rate=successful / total if total > 0 else 0,
        avg_quality_score=float(stats_row["avg_quality_score"]) if stats_row["avg_quality_score"] else None,
        avg_duration_ms=float(stats_row["avg_duration_ms"]) if stats_row["avg_duration_ms"] else None,
        p95_duration_ms=float(stats_row["p95_duration_ms"]) if stats_row["p95_duration_ms"] else None,
        total_cost_usd=stats_row["total_cost_usd"] or Decimal(0),
        total_tokens=stats_row["total_tokens"] or 0,
        avg_cost_per_execution=stats_row["total_cost_usd"] / total if total > 0 and stats_row["total_cost_usd"] else None,
    )
    
    # Get hourly data if requested
    hourly_executions = None
    hourly_costs = None
    hourly_quality = None
    
    if include_hourly:
        hourly_rows = await database.fetch_all(
            """
            SELECT
                date_trunc('hour', started_at) as hour,
                COUNT(*) as count,
                SUM(total_cost_usd) as cost,
                AVG(quality_score) as quality
            FROM agent_executions
            WHERE agent_id = $1 AND org_id = $2 AND started_at >= $3
            GROUP BY 1
            ORDER BY 1
            """,
            agent_id,
            current_user.org_id,
            from_time,
        )
        
        hourly_executions = [
            {"hour": r["hour"].isoformat(), "count": r["count"]}
            for r in hourly_rows
        ]
        hourly_costs = [
            {"hour": r["hour"].isoformat(), "cost": float(r["cost"] or 0)}
            for r in hourly_rows
        ]
        hourly_quality = [
            {"hour": r["hour"].isoformat(), "quality": float(r["quality"]) if r["quality"] else None}
            for r in hourly_rows
        ]
    
    return AgentStats(
        agent_id=agent_id,
        period=period,
        executions=exec_stats,
        hourly_executions=hourly_executions,
        hourly_costs=hourly_costs,
        hourly_quality=hourly_quality,
    )


# ============================================================================
# Compare Agent Versions
# ============================================================================

@router.get(
    "/{agent_id}/compare",
    response_model=AgentComparison,
    summary="Compare agent versions",
    description="Compare performance metrics between two versions of an agent.",
)
async def compare_agent_versions(
    agent_id: str,
    v1: str = Query(..., description="First version to compare"),
    v2: str = Query(..., description="Second version to compare"),
    period: str = Query("7d", regex="^(24h|7d|30d)$", description="Time period"),
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Compare performance metrics between two versions of an agent.
    
    Useful for A/B testing and version regression detection.
    """
    period_map = {
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    from_time = datetime.utcnow() - period_map[period]
    
    async def get_version_stats(version: str) -> ExecutionStats:
        row = await database.fetch_one(
            """
            SELECT
                COUNT(*) as total_executions,
                COUNT(*) FILTER (WHERE status = 'success') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE status = 'loop_detected') as loops_detected,
                COUNT(*) FILTER (WHERE status = 'timeout') as timeouts,
                AVG(quality_score) as avg_quality_score,
                AVG(duration_ms) as avg_duration_ms,
                PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
                SUM(total_cost_usd) as total_cost_usd,
                SUM(total_tokens) as total_tokens
            FROM agent_executions
            WHERE agent_id = $1 AND org_id = $2 AND version = $3 AND started_at >= $4
            """,
            agent_id,
            current_user.org_id,
            version,
            from_time,
        )
        
        total = row["total_executions"] or 0
        successful = row["successful"] or 0
        
        return ExecutionStats(
            total_executions=total,
            successful=successful,
            failed=row["failed"] or 0,
            loops_detected=row["loops_detected"] or 0,
            timeouts=row["timeouts"] or 0,
            success_rate=successful / total if total > 0 else 0,
            avg_quality_score=float(row["avg_quality_score"]) if row["avg_quality_score"] else None,
            avg_duration_ms=float(row["avg_duration_ms"]) if row["avg_duration_ms"] else None,
            p95_duration_ms=float(row["p95_duration_ms"]) if row["p95_duration_ms"] else None,
            total_cost_usd=row["total_cost_usd"] or Decimal(0),
            total_tokens=row["total_tokens"] or 0,
            avg_cost_per_execution=row["total_cost_usd"] / total if total > 0 and row["total_cost_usd"] else None,
        )
    
    stats_a = await get_version_stats(v1)
    stats_b = await get_version_stats(v2)
    
    # Calculate differences
    quality_diff = None
    if stats_a.avg_quality_score and stats_b.avg_quality_score:
        quality_diff = stats_b.avg_quality_score - stats_a.avg_quality_score
    
    cost_diff = None
    if stats_a.avg_cost_per_execution and stats_b.avg_cost_per_execution:
        cost_diff = stats_b.avg_cost_per_execution - stats_a.avg_cost_per_execution
    
    duration_diff = None
    if stats_a.avg_duration_ms and stats_b.avg_duration_ms:
        duration_diff = stats_b.avg_duration_ms - stats_a.avg_duration_ms
    
    success_rate_diff = stats_b.success_rate - stats_a.success_rate
    
    # Generate recommendation
    recommendation = None
    if quality_diff is not None:
        if quality_diff < -10:
            recommendation = f"Version {v2} shows significant quality regression (-{abs(quality_diff):.1f} points). Consider rollback."
        elif quality_diff > 10:
            recommendation = f"Version {v2} shows significant quality improvement (+{quality_diff:.1f} points)."
        elif success_rate_diff < -0.1:
            recommendation = f"Version {v2} has lower success rate ({success_rate_diff*100:.1f}%). Investigate failures."
    
    return AgentComparison(
        agent_id=agent_id,
        version_a=v1,
        version_b=v2,
        stats_a=stats_a,
        stats_b=stats_b,
        quality_diff=quality_diff,
        cost_diff=cost_diff,
        duration_diff=duration_diff,
        success_rate_diff=success_rate_diff,
        recommendation=recommendation,
    )
