"""
Ingest Routes

High-throughput event ingestion endpoint for SDKs.
"""

from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Header, status
from fastapi.responses import ORJSONResponse
import structlog

from app.core.database import db, Database, get_db
from app.core.config import settings
from app.models import BaseSchema, EventType, ExecutionStatus, EnvironmentType

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# Request Models
# ============================================================================

class IngestEvent(BaseSchema):
    """Single event for ingestion."""
    event_id: UUID | None = None
    execution_id: UUID
    event_type: str
    sequence_number: int = 0
    occurred_at: str  # ISO format
    duration_ms: int | None = None
    
    # Cost and tokens
    cost_usd: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    thinking_tokens: int | None = None
    
    # LLM data
    model_id: str | None = None
    provider: str | None = None
    temperature: float | None = None
    llm_input: dict[str, Any] | None = None
    llm_output: dict[str, Any] | None = None
    
    # Tool data
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    tool_output: dict[str, Any] | None = None
    
    # Error data
    error: dict[str, Any] | None = None
    
    metadata: dict[str, Any] | None = None


class IngestExecution(BaseSchema):
    """Execution start/update for ingestion."""
    execution_id: UUID
    agent_id: str
    project_id: UUID | None = None
    version: str | None = None
    environment: str = "production"
    
    # Status
    status: str = "running"
    
    # Task data
    task_input: dict[str, Any] | None = None
    final_output: dict[str, Any] | None = None
    error_details: dict[str, Any] | None = None
    
    # Timestamps
    started_at: str  # ISO format
    completed_at: str | None = None
    
    metadata: dict[str, Any] | None = None


class IngestBatch(BaseSchema):
    """Batch of events and executions for ingestion."""
    executions: list[IngestExecution] | None = None
    events: list[IngestEvent] | None = None


class IngestResponse(BaseSchema):
    """Response for successful ingestion."""
    accepted: int
    errors: list[dict[str, Any]] | None = None


# ============================================================================
# Authentication
# ============================================================================

async def get_org_from_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    database: Database = Depends(get_db),
) -> tuple[UUID, UUID]:
    """
    Validate API key and return (org_id, user_id).
    
    This is a lightweight auth check optimized for high-throughput ingestion.
    """
    from app.core.security import verify_api_key
    
    # Extract prefix
    prefix = x_api_key[:20]
    
    # Lookup key
    key_record = await database.fetch_one(
        """
        SELECT ak.id, ak.org_id, ak.user_id, ak.key_hash, ak.scopes
        FROM api_keys ak
        WHERE ak.key_prefix = $1 
          AND ak.revoked_at IS NULL
          AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        """,
        prefix,
    )
    
    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    # Verify full key
    if not verify_api_key(x_api_key, key_record["key_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    # Check scope
    if "write" not in key_record["scopes"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API key lacks write permission",
        )
    
    return key_record["org_id"], key_record["user_id"]


# ============================================================================
# Ingest Endpoint
# ============================================================================

@router.post(
    "/events",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest events batch",
    description="High-throughput event ingestion endpoint. Accepts up to 500 events per request.",
    responses={
        202: {"description": "Events accepted for processing"},
        401: {"description": "Invalid API key"},
        413: {"description": "Batch too large"},
        429: {"description": "Rate limit exceeded"},
    },
)
async def ingest_events(
    batch: IngestBatch,
    auth: tuple[UUID, UUID] = Depends(get_org_from_api_key),
    database: Database = Depends(get_db),
):
    """
    Ingest a batch of execution events.
    
    This endpoint is optimized for high throughput:
    - Accepts up to 500 events per request
    - Returns 202 Accepted immediately
    - Events are processed asynchronously
    
    Rate limit: 10,000 requests/minute per organization.
    """
    org_id, user_id = auth
    
    # Validate batch size
    total_items = (len(batch.executions or []) + len(batch.events or []))
    if total_items > 500:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Batch too large: {total_items} items (max 500)",
        )
    
    if total_items == 0:
        return IngestResponse(accepted=0)
    
    accepted = 0
    errors = []
    
    # Process executions
    if batch.executions:
        for execution in batch.executions:
            try:
                await _upsert_execution(database, org_id, execution)
                accepted += 1
            except Exception as e:
                logger.error("Execution ingest failed", error=str(e), execution_id=str(execution.execution_id))
                errors.append({
                    "execution_id": str(execution.execution_id),
                    "error": str(e),
                })
    
    # Process events
    if batch.events:
        for event in batch.events:
            try:
                await _insert_event(database, org_id, event)
                accepted += 1
            except Exception as e:
                logger.error("Event ingest failed", error=str(e), event_id=str(event.event_id))
                errors.append({
                    "event_id": str(event.event_id) if event.event_id else None,
                    "execution_id": str(event.execution_id),
                    "error": str(e),
                })
    
    logger.info(
        "Batch ingested",
        org_id=str(org_id),
        accepted=accepted,
        errors=len(errors),
    )
    
    return IngestResponse(
        accepted=accepted,
        errors=errors if errors else None,
    )


async def _upsert_execution(database: Database, org_id: UUID, execution: IngestExecution) -> None:
    """Insert or update an execution record."""
    from datetime import datetime
    
    # Parse timestamps
    started_at = datetime.fromisoformat(execution.started_at.replace("Z", "+00:00"))
    completed_at = None
    if execution.completed_at:
        completed_at = datetime.fromisoformat(execution.completed_at.replace("Z", "+00:00"))
    
    # Calculate duration if completed
    duration_ms = None
    if completed_at:
        duration_ms = int((completed_at - started_at).total_seconds() * 1000)
    
    # Ensure agent exists
    await database.execute(
        """
        INSERT INTO agents (org_id, agent_id, current_version, last_execution_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (org_id, agent_id) DO UPDATE SET
            current_version = COALESCE(EXCLUDED.current_version, agents.current_version),
            last_execution_at = GREATEST(agents.last_execution_at, EXCLUDED.last_execution_at),
            updated_at = NOW()
        """,
        org_id,
        execution.agent_id,
        execution.version,
        started_at,
    )
    
    # Upsert execution
    await database.execute(
        """
        INSERT INTO agent_executions (
            execution_id, org_id, agent_id, project_id, version, environment,
            status, task_input, final_output, error_details,
            duration_ms, started_at, completed_at, metadata
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14
        )
        ON CONFLICT (execution_id, started_at) DO UPDATE SET
            status = EXCLUDED.status,
            final_output = COALESCE(EXCLUDED.final_output, agent_executions.final_output),
            error_details = COALESCE(EXCLUDED.error_details, agent_executions.error_details),
            duration_ms = COALESCE(EXCLUDED.duration_ms, agent_executions.duration_ms),
            completed_at = COALESCE(EXCLUDED.completed_at, agent_executions.completed_at),
            metadata = agent_executions.metadata || COALESCE(EXCLUDED.metadata, '{}'::jsonb)
        """,
        execution.execution_id,
        org_id,
        execution.agent_id,
        execution.project_id,
        execution.version,
        execution.environment,
        execution.status,
        execution.task_input,
        execution.final_output,
        execution.error_details,
        duration_ms,
        started_at,
        completed_at,
        execution.metadata or {},
    )


async def _insert_event(database: Database, org_id: UUID, event: IngestEvent) -> None:
    """Insert an execution event."""
    from datetime import datetime
    from decimal import Decimal
    
    event_id = event.event_id or uuid4()
    occurred_at = datetime.fromisoformat(event.occurred_at.replace("Z", "+00:00"))
    
    await database.execute(
        """
        INSERT INTO execution_events (
            event_id, execution_id, org_id,
            event_type, sequence_number, occurred_at, duration_ms,
            cost_usd, input_tokens, output_tokens, thinking_tokens,
            model_id, provider, temperature,
            llm_input, llm_output,
            tool_name, tool_input, tool_output,
            error, metadata
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14,
            $15, $16,
            $17, $18, $19,
            $20, $21
        )
        """,
        event_id,
        event.execution_id,
        org_id,
        event.event_type,
        event.sequence_number,
        occurred_at,
        event.duration_ms,
        Decimal(str(event.cost_usd)) if event.cost_usd else Decimal(0),
        event.input_tokens or 0,
        event.output_tokens or 0,
        event.thinking_tokens or 0,
        event.model_id,
        event.provider,
        Decimal(str(event.temperature)) if event.temperature else None,
        event.llm_input,
        event.llm_output,
        event.tool_name,
        event.tool_input,
        event.tool_output,
        event.error,
        event.metadata or {},
    )
    
    # Update execution aggregates
    if event.cost_usd or event.input_tokens or event.output_tokens:
        await database.execute(
            """
            UPDATE agent_executions
            SET 
                total_cost_usd = total_cost_usd + $2,
                input_tokens = input_tokens + $3,
                output_tokens = output_tokens + $4,
                thinking_tokens = thinking_tokens + $5,
                total_tokens = total_tokens + $3 + $4 + $5,
                llm_calls_count = llm_calls_count + CASE WHEN $6 = 'llm_call' THEN 1 ELSE 0 END,
                tool_calls_count = tool_calls_count + CASE WHEN $6 = 'tool_call' THEN 1 ELSE 0 END
            WHERE execution_id = $1
            """,
            event.execution_id,
            Decimal(str(event.cost_usd or 0)),
            event.input_tokens or 0,
            event.output_tokens or 0,
            event.thinking_tokens or 0,
            event.event_type,
        )
