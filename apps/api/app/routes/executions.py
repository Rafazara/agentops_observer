"""
Executions Routes

Handles agent execution queries, traces, and statistics.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
import structlog

from app.core.database import db, Database, get_db
from app.core.cache import cache, RedisCache, get_cache
from app.routes.auth import get_current_user, CurrentUser
from app.models import PaginatedResponse, ExecutionStatus, EnvironmentType
from app.models.executions import (
    Execution,
    ExecutionSummary,
    ExecutionWithTrace,
    ExecutionEvent,
    ExecutionStats,
    SemanticAnalysis,
)

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# List Executions
# ============================================================================

@router.get(
    "",
    response_model=PaginatedResponse[ExecutionSummary],
    summary="List executions",
    description="Query agent executions with filters and cursor-based pagination.",
)
async def list_executions(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    # Filters
    agent_id: str | None = Query(None, description="Filter by agent ID"),
    project_id: UUID | None = Query(None, description="Filter by project ID"),
    status: ExecutionStatus | None = Query(None, description="Filter by status"),
    environment: EnvironmentType | None = Query(None, description="Filter by environment"),
    version: str | None = Query(None, description="Filter by version"),
    # Date range
    from_date: datetime | None = Query(None, alias="from", description="Start date (inclusive)"),
    to_date: datetime | None = Query(None, alias="to", description="End date (exclusive)"),
    # Cost filters
    cost_min: Decimal | None = Query(None, ge=0, description="Minimum cost (USD)"),
    cost_max: Decimal | None = Query(None, description="Maximum cost (USD)"),
    # Quality filters
    quality_min: float | None = Query(None, ge=0, le=100, description="Minimum quality score"),
    quality_max: float | None = Query(None, ge=0, le=100, description="Maximum quality score"),
    # Pagination
    cursor: str | None = Query(None, description="Cursor for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
):
    """
    Query agent executions with various filters.
    
    Supports cursor-based pagination for efficient paging through large datasets.
    All date/time values are in UTC.
    """
    # Build query
    conditions = ["org_id = $1"]
    params: list = [current_user.org_id]
    param_idx = 2
    
    if agent_id:
        conditions.append(f"agent_id = ${param_idx}")
        params.append(agent_id)
        param_idx += 1
    
    if project_id:
        conditions.append(f"project_id = ${param_idx}")
        params.append(project_id)
        param_idx += 1
    
    if status:
        conditions.append(f"status = ${param_idx}")
        params.append(status.value)
        param_idx += 1
    
    if environment:
        conditions.append(f"environment = ${param_idx}")
        params.append(environment.value)
        param_idx += 1
    
    if version:
        conditions.append(f"version = ${param_idx}")
        params.append(version)
        param_idx += 1
    
    if from_date:
        conditions.append(f"started_at >= ${param_idx}")
        params.append(from_date)
        param_idx += 1
    
    if to_date:
        conditions.append(f"started_at < ${param_idx}")
        params.append(to_date)
        param_idx += 1
    
    if cost_min is not None:
        conditions.append(f"total_cost_usd >= ${param_idx}")
        params.append(cost_min)
        param_idx += 1
    
    if cost_max is not None:
        conditions.append(f"total_cost_usd <= ${param_idx}")
        params.append(cost_max)
        param_idx += 1
    
    if quality_min is not None:
        conditions.append(f"quality_score >= ${param_idx}")
        params.append(quality_min)
        param_idx += 1
    
    if quality_max is not None:
        conditions.append(f"quality_score <= ${param_idx}")
        params.append(quality_max)
        param_idx += 1
    
    # Handle cursor
    if cursor:
        # Cursor is started_at::execution_id encoded
        try:
            cursor_time, cursor_id = cursor.split("::")
            conditions.append(f"(started_at, execution_id) < (${param_idx}, ${param_idx + 1})")
            params.append(datetime.fromisoformat(cursor_time))
            params.append(UUID(cursor_id))
            param_idx += 2
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid cursor format",
            )
    
    where_clause = " AND ".join(conditions)
    
    # Execute query
    rows = await database.fetch_all(
        f"""
        SELECT 
            execution_id, agent_id, project_id, version, environment, status,
            quality_score, total_cost_usd, total_tokens, duration_ms,
            started_at, completed_at, llm_calls_count, tool_calls_count
        FROM agent_executions
        WHERE {where_clause}
        ORDER BY started_at DESC, execution_id DESC
        LIMIT {limit + 1}
        """,
        *params,
    )
    
    # Check for more results
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    
    # Build response
    executions = [ExecutionSummary(**dict(row)) for row in rows]
    
    # Generate next cursor
    next_cursor = None
    if has_more and rows:
        last = rows[-1]
        next_cursor = f"{last['started_at'].isoformat()}::{last['execution_id']}"
    
    return PaginatedResponse(
        data=executions,
        next_cursor=next_cursor,
        has_more=has_more,
    )


# ============================================================================
# Get Execution
# ============================================================================

@router.get(
    "/{execution_id}",
    response_model=Execution,
    summary="Get execution details",
    responses={
        404: {"description": "Execution not found"},
    },
)
async def get_execution(
    execution_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Get detailed information about a specific execution.
    """
    row = await database.fetch_one(
        """
        SELECT *
        FROM agent_executions
        WHERE execution_id = $1 AND org_id = $2
        """,
        execution_id,
        current_user.org_id,
    )
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )
    
    return Execution(**dict(row))


# ============================================================================
# Get Execution Trace
# ============================================================================

@router.get(
    "/{execution_id}/trace",
    response_model=ExecutionWithTrace,
    summary="Get execution with full trace",
    description="Returns execution details with all events (LLM calls, tool calls, etc.)",
    responses={
        404: {"description": "Execution not found"},
    },
)
async def get_execution_trace(
    execution_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Get an execution with its complete event trace.
    
    The trace includes all LLM calls, tool invocations, memory operations,
    and other events that occurred during the execution.
    """
    # Get execution
    execution = await database.fetch_one(
        """
        SELECT *
        FROM agent_executions
        WHERE execution_id = $1 AND org_id = $2
        """,
        execution_id,
        current_user.org_id,
    )
    
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )
    
    # Get events
    events = await database.fetch_all(
        """
        SELECT *
        FROM execution_events
        WHERE execution_id = $1 AND org_id = $2
        ORDER BY occurred_at ASC, sequence_number ASC
        """,
        execution_id,
        current_user.org_id,
    )
    
    return ExecutionWithTrace(
        **dict(execution),
        events=[ExecutionEvent(**dict(e)) for e in events],
    )


# ============================================================================
# Get AI Analysis
# ============================================================================

@router.get(
    "/{execution_id}/analysis",
    response_model=SemanticAnalysis,
    summary="Get AI analysis of execution",
    description="Returns AI-powered analysis of the execution (cached for 24h)",
    responses={
        404: {"description": "Execution not found"},
        503: {"description": "Analysis service unavailable"},
    },
)
async def get_execution_analysis(
    execution_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    redis: RedisCache = Depends(get_cache),
):
    """
    Get AI-powered semantic analysis of an execution.
    
    Analysis includes:
    - Root cause identification for failures
    - Goal completion assessment (0-100)
    - Reasoning quality score (0-100)
    - Recommended fixes
    
    Results are cached for 24 hours.
    """
    from app.core.config import settings
    
    # Check cache
    cache_key = f"analysis:{execution_id}"
    cached = await redis.get_json(cache_key)
    if cached:
        return SemanticAnalysis(**cached)
    
    # Get execution
    execution = await database.fetch_one(
        """
        SELECT *
        FROM agent_executions
        WHERE execution_id = $1 AND org_id = $2
        """,
        execution_id,
        current_user.org_id,
    )
    
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Execution not found",
        )
    
    # Get events for context
    events = await database.fetch_all(
        """
        SELECT event_type, tool_name, model_id, error, duration_ms
        FROM execution_events
        WHERE execution_id = $1
        ORDER BY occurred_at ASC
        LIMIT 50
        """,
        execution_id,
    )
    
    # Check if Anthropic is configured
    if not settings.anthropic_api_key:
        # Return rule-based analysis
        analysis = _rule_based_analysis(execution, events)
    else:
        # Use Claude for analysis
        analysis = await _claude_analysis(execution, events)
    
    # Cache result
    await redis.set_json(cache_key, analysis.model_dump(), ttl_seconds=86400)
    
    return analysis


def _rule_based_analysis(execution: dict, events: list) -> SemanticAnalysis:
    """Fallback rule-based analysis when AI is unavailable."""
    from datetime import datetime, timezone
    
    status = execution["status"]
    error_details = execution.get("error_details") or {}
    
    # Determine root cause
    root_cause = None
    failure_category = None
    
    if status == "loop_detected":
        root_cause = "Agent entered an infinite or quasi-infinite loop"
        failure_category = "loop"
    elif status == "timeout":
        root_cause = "Execution exceeded maximum allowed time"
        failure_category = "timeout"
    elif status == "failed":
        if error_details.get("type"):
            root_cause = f"Error: {error_details.get('type')}: {error_details.get('message', 'Unknown')}"
        failure_category = "error"
    
    # Calculate scores
    goal_completion = 100 if status == "success" else 0
    reasoning_quality = int(execution.get("reasoning_coherence_score") or 50)
    
    # Recommended fix
    recommended_fix = None
    if failure_category == "loop":
        recommended_fix = "Add loop detection logic or reduce max_iterations parameter"
    elif failure_category == "timeout":
        recommended_fix = "Optimize agent logic or increase timeout threshold"
    
    return SemanticAnalysis(
        execution_id=execution["execution_id"],
        root_cause=root_cause,
        failure_category=failure_category,
        goal_completion=goal_completion,
        reasoning_quality=reasoning_quality,
        recommended_fix=recommended_fix,
        confidence=0.6,  # Lower confidence for rule-based
        analyzed_at=datetime.now(timezone.utc),
    )


async def _claude_analysis(execution: dict, events: list) -> SemanticAnalysis:
    """AI-powered analysis using Claude."""
    from datetime import datetime, timezone
    import anthropic
    from app.core.config import settings
    
    # Build trace summary
    trace_summary = []
    for e in events:
        if e["event_type"] == "llm_call":
            trace_summary.append(f"LLM call to {e['model_id']}")
        elif e["event_type"] == "tool_call":
            trace_summary.append(f"Tool call: {e['tool_name']}")
        elif e["event_type"] == "error":
            trace_summary.append(f"Error: {e.get('error', {}).get('message', 'Unknown')}")
    
    # Build prompt
    prompt = f"""Analyze this AI agent execution and provide structured feedback.

Execution Status: {execution['status']}
Duration: {execution.get('duration_ms', 'N/A')}ms
LLM Calls: {execution.get('llm_calls_count', 0)}
Tool Calls: {execution.get('tool_calls_count', 0)}

Task Input: {execution.get('task_input', 'N/A')}
Final Output: {execution.get('final_output', 'N/A')}
Error Details: {execution.get('error_details', 'N/A')}

Trace Summary:
{chr(10).join(trace_summary[:20])}

Provide your analysis in this exact format:
ROOT_CAUSE: [brief description or "None" if successful]
FAILURE_CATEGORY: [loop|timeout|error|tool_failure|hallucination|None]
GOAL_COMPLETION: [0-100]
REASONING_QUALITY: [0-100]
RECOMMENDED_FIX: [brief recommendation or "None"]
CONFIDENCE: [0.0-1.0]
"""
    
    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        
        # Parse response
        text = response.content[0].text
        lines = {
            line.split(":")[0].strip(): ":".join(line.split(":")[1:]).strip()
            for line in text.strip().split("\n")
            if ":" in line
        }
        
        return SemanticAnalysis(
            execution_id=execution["execution_id"],
            root_cause=lines.get("ROOT_CAUSE") if lines.get("ROOT_CAUSE") != "None" else None,
            failure_category=lines.get("FAILURE_CATEGORY") if lines.get("FAILURE_CATEGORY") != "None" else None,
            goal_completion=int(lines.get("GOAL_COMPLETION", 50)),
            reasoning_quality=int(lines.get("REASONING_QUALITY", 50)),
            recommended_fix=lines.get("RECOMMENDED_FIX") if lines.get("RECOMMENDED_FIX") != "None" else None,
            confidence=float(lines.get("CONFIDENCE", 0.8)),
            analyzed_at=datetime.now(timezone.utc),
        )
    except Exception as e:
        logger.error("Claude analysis failed", error=str(e))
        return _rule_based_analysis(execution, events)


# ============================================================================
# Execution Stats
# ============================================================================

@router.get(
    "/stats/summary",
    response_model=ExecutionStats,
    summary="Get execution statistics summary",
)
async def get_execution_stats(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    # Filters
    agent_id: str | None = Query(None, description="Filter by agent ID"),
    project_id: UUID | None = Query(None, description="Filter by project ID"),
    environment: EnvironmentType | None = Query(None, description="Filter by environment"),
    # Period
    period: str = Query("24h", regex="^(1h|24h|7d|30d)$", description="Time period"),
):
    """
    Get aggregated execution statistics for a time period.
    """
    # Calculate time range
    period_map = {
        "1h": timedelta(hours=1),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    from_time = datetime.utcnow() - period_map[period]
    
    # Build query
    conditions = ["org_id = $1", "started_at >= $2"]
    params: list = [current_user.org_id, from_time]
    param_idx = 3
    
    if agent_id:
        conditions.append(f"agent_id = ${param_idx}")
        params.append(agent_id)
        param_idx += 1
    
    if project_id:
        conditions.append(f"project_id = ${param_idx}")
        params.append(project_id)
        param_idx += 1
    
    if environment:
        conditions.append(f"environment = ${param_idx}")
        params.append(environment.value)
    
    where_clause = " AND ".join(conditions)
    
    row = await database.fetch_one(
        f"""
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
        WHERE {where_clause}
        """,
        *params,
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
