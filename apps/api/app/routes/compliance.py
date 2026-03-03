"""
Compliance Routes

Handles audit trail, data export, and compliance features.
"""

from datetime import datetime, timedelta
from io import StringIO
import csv
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
import structlog

from app.core.database import db, Database, get_db
from app.routes.auth import get_current_user, CurrentUser
from app.models import BaseSchema, UserRole

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# Audit Trail
# ============================================================================

class AuditLogEntry(BaseSchema):
    """Audit log entry."""
    id: UUID
    action: str
    resource_type: str
    resource_id: str | None
    actor_id: UUID
    actor_email: str | None
    ip_address: str | None
    user_agent: str | None
    changes: dict[str, Any] | None
    occurred_at: datetime


class AuditLogResponse(BaseSchema):
    """Paginated audit log response."""
    data: list[AuditLogEntry]
    total: int
    has_more: bool


@router.get(
    "/audit",
    response_model=AuditLogResponse,
    summary="Get audit trail",
    description="Get organization audit trail for compliance.",
)
async def get_audit_trail(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    action: str | None = Query(None, description="Filter by action type"),
    resource_type: str | None = Query(None, description="Filter by resource type"),
    actor_id: UUID | None = Query(None, description="Filter by actor"),
    from_date: datetime | None = Query(None, description="From date"),
    to_date: datetime | None = Query(None, description="To date"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """
    Get audit trail showing all user and system actions.
    
    Requires admin role.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for audit logs",
        )
    
    conditions = ["al.org_id = $1"]
    params: list = [current_user.org_id]
    param_idx = 2
    
    if action:
        conditions.append(f"al.action = ${param_idx}")
        params.append(action)
        param_idx += 1
    
    if resource_type:
        conditions.append(f"al.resource_type = ${param_idx}")
        params.append(resource_type)
        param_idx += 1
    
    if actor_id:
        conditions.append(f"al.actor_id = ${param_idx}")
        params.append(actor_id)
        param_idx += 1
    
    if from_date:
        conditions.append(f"al.occurred_at >= ${param_idx}")
        params.append(from_date)
        param_idx += 1
    
    if to_date:
        conditions.append(f"al.occurred_at <= ${param_idx}")
        params.append(to_date)
        param_idx += 1
    
    where_clause = " AND ".join(conditions)
    
    # Get count
    count_row = await database.fetch_one(
        f"""
        SELECT COUNT(*) as total
        FROM audit_logs al
        WHERE {where_clause}
        """,
        *params,
    )
    total = count_row["total"]
    
    # Get entries
    rows = await database.fetch_all(
        f"""
        SELECT 
            al.id,
            al.action,
            al.resource_type,
            al.resource_id,
            al.actor_id,
            u.email as actor_email,
            al.ip_address,
            al.user_agent,
            al.changes,
            al.occurred_at
        FROM audit_logs al
        LEFT JOIN users u ON al.actor_id = u.id
        WHERE {where_clause}
        ORDER BY al.occurred_at DESC
        LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """,
        *params,
        limit,
        offset,
    )
    
    entries = [AuditLogEntry(**dict(row)) for row in rows]
    
    return AuditLogResponse(
        data=entries,
        total=total,
        has_more=offset + limit < total,
    )


# ============================================================================
# Data Export
# ============================================================================

class ExportRequest(BaseSchema):
    """Data export request."""
    export_type: str  # executions, events, incidents, costs
    format: str = "csv"  # csv, json
    from_date: datetime
    to_date: datetime
    filters: dict[str, Any] | None = None


@router.post(
    "/export",
    summary="Export data",
    description="Export organization data for compliance or analysis.",
)
async def export_data(
    request: ExportRequest,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Export data in CSV or JSON format.
    
    Requires admin role. Data is streamed for large exports.
    """
    if current_user.role not in [UserRole.ADMIN, UserRole.OWNER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for data export",
        )
    
    # Validate date range (max 90 days)
    date_range = request.to_date - request.from_date
    if date_range.days > 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Export date range cannot exceed 90 days",
        )
    
    if request.export_type == "executions":
        return await _export_executions(request, current_user, database)
    elif request.export_type == "events":
        return await _export_events(request, current_user, database)
    elif request.export_type == "incidents":
        return await _export_incidents(request, current_user, database)
    elif request.export_type == "costs":
        return await _export_costs(request, current_user, database)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown export type: {request.export_type}",
        )


async def _export_executions(
    request: ExportRequest,
    current_user: CurrentUser,
    database: Database,
) -> StreamingResponse:
    """Export executions data."""
    rows = await database.fetch_all(
        """
        SELECT 
            execution_id,
            agent_id,
            version,
            environment,
            status,
            duration_ms,
            total_cost_usd,
            total_tokens,
            input_tokens,
            output_tokens,
            llm_calls_count,
            tool_calls_count,
            quality_score,
            started_at,
            completed_at
        FROM agent_executions
        WHERE org_id = $1 AND started_at >= $2 AND started_at <= $3
        ORDER BY started_at
        """,
        current_user.org_id,
        request.from_date,
        request.to_date,
    )
    
    if request.format == "csv":
        return _create_csv_response(
            rows,
            filename=f"executions_{request.from_date.date()}_{request.to_date.date()}.csv",
        )
    else:
        return _create_json_response(
            [dict(r) for r in rows],
            filename=f"executions_{request.from_date.date()}_{request.to_date.date()}.json",
        )


async def _export_events(
    request: ExportRequest,
    current_user: CurrentUser,
    database: Database,
) -> StreamingResponse:
    """Export events data."""
    rows = await database.fetch_all(
        """
        SELECT 
            event_id,
            execution_id,
            event_type,
            sequence_number,
            occurred_at,
            duration_ms,
            cost_usd,
            input_tokens,
            output_tokens,
            model_id,
            provider,
            tool_name
        FROM execution_events
        WHERE org_id = $1 AND occurred_at >= $2 AND occurred_at <= $3
        ORDER BY occurred_at
        """,
        current_user.org_id,
        request.from_date,
        request.to_date,
    )
    
    if request.format == "csv":
        return _create_csv_response(
            rows,
            filename=f"events_{request.from_date.date()}_{request.to_date.date()}.csv",
        )
    else:
        return _create_json_response(
            [dict(r) for r in rows],
            filename=f"events_{request.from_date.date()}_{request.to_date.date()}.json",
        )


async def _export_incidents(
    request: ExportRequest,
    current_user: CurrentUser,
    database: Database,
) -> StreamingResponse:
    """Export incidents data."""
    rows = await database.fetch_all(
        """
        SELECT 
            id,
            incident_type,
            severity,
            status,
            title,
            description,
            agent_id,
            detected_at,
            acknowledged_at,
            resolved_at,
            resolution_notes
        FROM incidents
        WHERE org_id = $1 AND detected_at >= $2 AND detected_at <= $3
        ORDER BY detected_at
        """,
        current_user.org_id,
        request.from_date,
        request.to_date,
    )
    
    if request.format == "csv":
        return _create_csv_response(
            rows,
            filename=f"incidents_{request.from_date.date()}_{request.to_date.date()}.csv",
        )
    else:
        return _create_json_response(
            [dict(r) for r in rows],
            filename=f"incidents_{request.from_date.date()}_{request.to_date.date()}.json",
        )


async def _export_costs(
    request: ExportRequest,
    current_user: CurrentUser,
    database: Database,
) -> StreamingResponse:
    """Export cost summary data."""
    rows = await database.fetch_all(
        """
        SELECT 
            DATE(started_at) as date,
            agent_id,
            SUM(total_cost_usd) as total_cost_usd,
            SUM(total_tokens) as total_tokens,
            SUM(input_tokens) as input_tokens,
            SUM(output_tokens) as output_tokens,
            COUNT(*) as execution_count
        FROM agent_executions
        WHERE org_id = $1 AND started_at >= $2 AND started_at <= $3
        GROUP BY DATE(started_at), agent_id
        ORDER BY date, agent_id
        """,
        current_user.org_id,
        request.from_date,
        request.to_date,
    )
    
    if request.format == "csv":
        return _create_csv_response(
            rows,
            filename=f"costs_{request.from_date.date()}_{request.to_date.date()}.csv",
        )
    else:
        return _create_json_response(
            [dict(r) for r in rows],
            filename=f"costs_{request.from_date.date()}_{request.to_date.date()}.json",
        )


def _create_csv_response(rows: list, filename: str) -> StreamingResponse:
    """Create a streaming CSV response."""
    if not rows:
        return StreamingResponse(
            iter(["No data"]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=list(dict(rows[0]).keys()))
    writer.writeheader()
    
    for row in rows:
        # Convert datetime and other types to strings
        row_dict = {}
        for k, v in dict(row).items():
            if isinstance(v, datetime):
                row_dict[k] = v.isoformat()
            elif v is None:
                row_dict[k] = ""
            else:
                row_dict[k] = str(v)
        writer.writerow(row_dict)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _create_json_response(data: list, filename: str) -> StreamingResponse:
    """Create a streaming JSON response."""
    import json
    
    def serialize(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    json_str = json.dumps(data, default=serialize, indent=2)
    
    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ============================================================================
# Data Retention
# ============================================================================

class RetentionPolicy(BaseSchema):
    """Data retention policy."""
    execution_retention_days: int
    event_retention_days: int
    audit_log_retention_days: int
    incident_retention_days: int


@router.get(
    "/retention",
    response_model=RetentionPolicy,
    summary="Get retention policy",
    description="Get data retention policy for the organization.",
)
async def get_retention_policy(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get data retention policy.
    
    Note: This is a placeholder. Would need organization settings storage.
    """
    # Placeholder - would query organization settings
    return RetentionPolicy(
        execution_retention_days=90,
        event_retention_days=30,
        audit_log_retention_days=365,
        incident_retention_days=180,
    )


# ============================================================================
# GDPR / Privacy
# ============================================================================

class DataDeletionRequest(BaseSchema):
    """Request for data deletion."""
    agent_id: str | None = None
    execution_ids: list[UUID] | None = None
    reason: str


class DataDeletionResponse(BaseSchema):
    """Response for data deletion."""
    request_id: UUID
    status: str
    records_affected: int
    estimated_completion: datetime


@router.post(
    "/data-deletion",
    response_model=DataDeletionResponse,
    summary="Request data deletion",
    description="Request deletion of specific data for GDPR compliance.",
)
async def request_data_deletion(
    request: DataDeletionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Request deletion of specific data.
    
    Requires owner role. Deletion is processed asynchronously.
    """
    if current_user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required for data deletion",
        )
    
    if not request.agent_id and not request.execution_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify agent_id or execution_ids",
        )
    
    # Count affected records
    records_affected = 0
    
    if request.execution_ids:
        count_row = await database.fetch_one(
            """
            SELECT COUNT(*) as count
            FROM agent_executions
            WHERE org_id = $1 AND execution_id = ANY($2)
            """,
            current_user.org_id,
            request.execution_ids,
        )
        records_affected = count_row["count"]
    elif request.agent_id:
        count_row = await database.fetch_one(
            """
            SELECT COUNT(*) as count
            FROM agent_executions
            WHERE org_id = $1 AND agent_id = $2
            """,
            current_user.org_id,
            request.agent_id,
        )
        records_affected = count_row["count"]
    
    # Log the deletion request
    from uuid import uuid4
    request_id = uuid4()
    
    await database.execute(
        """
        INSERT INTO audit_logs (id, org_id, action, resource_type, actor_id, changes)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        request_id,
        current_user.org_id,
        "data_deletion_request",
        "compliance",
        current_user.id,
        {
            "agent_id": request.agent_id,
            "execution_ids": [str(eid) for eid in (request.execution_ids or [])],
            "reason": request.reason,
            "records_affected": records_affected,
        },
    )
    
    logger.info(
        "Data deletion requested",
        request_id=str(request_id),
        org_id=str(current_user.org_id),
        records_affected=records_affected,
    )
    
    # In a real implementation, this would queue a background job
    return DataDeletionResponse(
        request_id=request_id,
        status="pending",
        records_affected=records_affected,
        estimated_completion=datetime.utcnow() + timedelta(hours=24),
    )
