"""
Incidents Routes

Handles incident management, auto-detection, and lifecycle tracking.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
import structlog

from app.core.database import db, Database, get_db
from app.routes.auth import get_current_user, CurrentUser
from app.models.incidents import (
    Incident,
    IncidentCreate,
    IncidentUpdate,
    IncidentTimeline,
    IncidentSummary,
    IncidentStats,
)
from app.models import IncidentSeverity, IncidentStatus, BaseSchema, PaginatedResponse

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# List Incidents
# ============================================================================

@router.get(
    "",
    response_model=list[Incident],
    summary="List incidents",
    description="List incidents with optional filtering.",
)
async def list_incidents(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    status_filter: list[IncidentStatus] | None = Query(None, alias="status", description="Filter by status"),
    severity: list[IncidentSeverity] | None = Query(None, description="Filter by severity"),
    agent_id: str | None = Query(None, description="Filter by agent"),
    from_date: datetime | None = Query(None, description="From date"),
    to_date: datetime | None = Query(None, description="To date"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """
    List incidents for the organization.
    """
    conditions = ["org_id = $1"]
    params: list = [current_user.org_id]
    param_idx = 2
    
    if status_filter:
        conditions.append(f"status = ANY(${param_idx})")
        params.append([s.value for s in status_filter])
        param_idx += 1
    
    if severity:
        conditions.append(f"severity = ANY(${param_idx})")
        params.append([s.value for s in severity])
        param_idx += 1
    
    if agent_id:
        conditions.append(f"agent_id = ${param_idx}")
        params.append(agent_id)
        param_idx += 1
    
    if from_date:
        conditions.append(f"detected_at >= ${param_idx}")
        params.append(from_date)
        param_idx += 1
    
    if to_date:
        conditions.append(f"detected_at <= ${param_idx}")
        params.append(to_date)
        param_idx += 1
    
    where_clause = " AND ".join(conditions)
    
    rows = await database.fetch_all(
        f"""
        SELECT *
        FROM incidents
        WHERE {where_clause}
        ORDER BY 
            CASE WHEN status = 'open' THEN 0 ELSE 1 END,
            CASE severity 
                WHEN 'critical' THEN 0
                WHEN 'high' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'low' THEN 3
            END,
            detected_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params,
        limit,
        offset,
    )
    
    return [Incident(**dict(row)) for row in rows]


# ============================================================================
# Get Incident
# ============================================================================

@router.get(
    "/{incident_id}",
    response_model=Incident,
    summary="Get incident details",
    responses={404: {"description": "Incident not found"}},
)
async def get_incident(
    incident_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Get detailed information about a specific incident.
    """
    row = await database.fetch_one(
        """
        SELECT *
        FROM incidents
        WHERE id = $1 AND org_id = $2
        """,
        incident_id,
        current_user.org_id,
    )
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    
    return Incident(**dict(row))


# ============================================================================
# Get Incident Timeline
# ============================================================================

@router.get(
    "/{incident_id}/timeline",
    response_model=IncidentTimeline,
    summary="Get incident timeline",
    description="Get incident with associated executions and events.",
)
async def get_incident_timeline(
    incident_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Get incident timeline showing the execution flow that led to the incident.
    """
    incident_row = await database.fetch_one(
        """
        SELECT *
        FROM incidents
        WHERE id = $1 AND org_id = $2
        """,
        incident_id,
        current_user.org_id,
    )
    
    if not incident_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    
    incident = Incident(**dict(incident_row))
    
    # Get related executions
    execution_rows = await database.fetch_all(
        """
        SELECT *
        FROM agent_executions
        WHERE execution_id = ANY($1)
        ORDER BY started_at
        """,
        incident.execution_ids or [],
    )
    
    # Get events for those executions
    event_rows = []
    if execution_rows:
        execution_ids = [r["execution_id"] for r in execution_rows]
        event_rows = await database.fetch_all(
            """
            SELECT *
            FROM execution_events
            WHERE execution_id = ANY($1)
            ORDER BY occurred_at
            """,
            execution_ids,
        )
    
    return IncidentTimeline(
        incident=incident,
        executions=[dict(r) for r in execution_rows],
        events=[dict(r) for r in event_rows],
    )


# ============================================================================
# Update Incident Status
# ============================================================================

@router.patch(
    "/{incident_id}",
    response_model=Incident,
    summary="Update incident",
    responses={404: {"description": "Incident not found"}},
)
async def update_incident(
    incident_id: UUID,
    request: IncidentUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Update incident status, assignment, or resolution.
    """
    # Build update query
    updates = []
    params = []
    param_idx = 1
    
    if request.status is not None:
        updates.append(f"status = ${param_idx}")
        params.append(request.status.value)
        param_idx += 1
        
        # Track timestamps
        if request.status == IncidentStatus.ACKNOWLEDGED:
            updates.append(f"acknowledged_at = NOW()")
            updates.append(f"acknowledged_by = ${param_idx}")
            params.append(current_user.id)
            param_idx += 1
        elif request.status == IncidentStatus.RESOLVED:
            updates.append(f"resolved_at = NOW()")
            updates.append(f"resolved_by = ${param_idx}")
            params.append(current_user.id)
            param_idx += 1
    
    if request.severity is not None:
        updates.append(f"severity = ${param_idx}")
        params.append(request.severity.value)
        param_idx += 1
    
    if request.resolution_notes is not None:
        updates.append(f"resolution_notes = ${param_idx}")
        params.append(request.resolution_notes)
        param_idx += 1
    
    if request.assigned_to is not None:
        updates.append(f"assigned_to = ${param_idx}")
        params.append(request.assigned_to)
        param_idx += 1
    
    if not updates:
        return await get_incident(incident_id, current_user, database)
    
    updates.append("updated_at = NOW()")
    params.extend([incident_id, current_user.org_id])
    
    row = await database.fetch_one(
        f"""
        UPDATE incidents
        SET {", ".join(updates)}
        WHERE id = ${param_idx} AND org_id = ${param_idx + 1}
        RETURNING *
        """,
        *params,
    )
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    
    logger.info(
        "Incident updated",
        incident_id=str(incident_id),
        updates={k: v for k, v in request.model_dump(exclude_unset=True).items()},
        by_user=str(current_user.id),
    )
    
    return Incident(**dict(row))


# ============================================================================
# Create Manual Incident
# ============================================================================

@router.post(
    "",
    response_model=Incident,
    status_code=status.HTTP_201_CREATED,
    summary="Create incident",
    description="Manually create an incident.",
)
async def create_incident(
    request: IncidentCreate,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Manually create an incident for tracking.
    """
    incident_id = uuid4()
    
    row = await database.fetch_one(
        """
        INSERT INTO incidents (
            id, org_id, incident_type, severity, title, description,
            agent_id, execution_ids, detected_at, status
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, NOW(), 'open'
        )
        RETURNING *
        """,
        incident_id,
        current_user.org_id,
        request.incident_type,
        request.severity.value,
        request.title,
        request.description,
        request.agent_id,
        request.execution_ids,
    )
    
    logger.info(
        "Incident created",
        incident_id=str(incident_id),
        type=request.incident_type,
        severity=request.severity.value,
    )
    
    return Incident(**dict(row))


# ============================================================================
# Incident Statistics
# ============================================================================

@router.get(
    "/stats/summary",
    response_model=IncidentStats,
    summary="Get incident statistics",
    description="Get aggregated incident statistics.",
)
async def get_incident_stats(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    period: str = Query("30d", regex="^(7d|30d|90d)$", description="Time period"),
):
    """
    Get incident statistics for the period.
    """
    period_map = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
    }
    from_time = datetime.utcnow() - period_map[period]
    
    # Overall stats
    stats = await database.fetch_one(
        """
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'open') as open_count,
            COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_count,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical_count,
            COUNT(*) FILTER (WHERE severity = 'high') as high_count,
            COUNT(*) FILTER (WHERE severity = 'medium') as medium_count,
            COUNT(*) FILTER (WHERE severity = 'low') as low_count,
            AVG(EXTRACT(EPOCH FROM (acknowledged_at - detected_at))) FILTER (WHERE acknowledged_at IS NOT NULL) as avg_acknowledge_seconds,
            AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at))) FILTER (WHERE resolved_at IS NOT NULL) as avg_resolve_seconds
        FROM incidents
        WHERE org_id = $1 AND detected_at >= $2
        """,
        current_user.org_id,
        from_time,
    )
    
    # Incidents by type
    by_type = await database.fetch_all(
        """
        SELECT incident_type, COUNT(*) as count
        FROM incidents
        WHERE org_id = $1 AND detected_at >= $2
        GROUP BY incident_type
        ORDER BY count DESC
        """,
        current_user.org_id,
        from_time,
    )
    
    # Daily counts
    daily = await database.fetch_all(
        """
        SELECT 
            DATE(detected_at) as date,
            COUNT(*) as count
        FROM incidents
        WHERE org_id = $1 AND detected_at >= $2
        GROUP BY DATE(detected_at)
        ORDER BY date
        """,
        current_user.org_id,
        from_time,
    )
    
    # MTTR in hours
    mttr_hours = None
    if stats["avg_resolve_seconds"]:
        mttr_hours = stats["avg_resolve_seconds"] / 3600
    
    mtta_hours = None
    if stats["avg_acknowledge_seconds"]:
        mtta_hours = stats["avg_acknowledge_seconds"] / 3600
    
    return IncidentStats(
        period=period,
        total_incidents=stats["total"],
        open_count=stats["open_count"],
        acknowledged_count=stats["acknowledged_count"],
        resolved_count=stats["resolved_count"],
        by_severity={
            "critical": stats["critical_count"],
            "high": stats["high_count"],
            "medium": stats["medium_count"],
            "low": stats["low_count"],
        },
        by_type={r["incident_type"]: r["count"] for r in by_type},
        mtta_hours=round(mtta_hours, 2) if mtta_hours else None,
        mttr_hours=round(mttr_hours, 2) if mttr_hours else None,
        daily_counts=[
            {"date": r["date"].isoformat(), "count": r["count"]}
            for r in daily
        ],
    )
