"""
Event aggregation for metrics and summaries.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any
from collections import defaultdict

import structlog
import asyncpg

from collector.config import get_settings

logger = structlog.get_logger()


async def update_aggregates(
    conn: asyncpg.Connection,
    events: list[dict[str, Any]],
) -> None:
    """
    Update aggregate tables based on new events.
    
    This updates:
    - execution_metrics (for completed executions)
    - agent_metrics (aggregated by agent)
    - cost_aggregates (for cost tracking)
    """
    settings = get_settings()
    
    # Group events by execution
    events_by_execution = defaultdict(list)
    for event in events:
        exec_id = event.get("execution_id")
        if exec_id:
            events_by_execution[exec_id].append(event)
    
    # Update execution metrics
    for execution_id, exec_events in events_by_execution.items():
        await _update_execution_metrics(conn, execution_id, exec_events)
    
    # Update cost aggregates
    await _update_cost_aggregates(conn, events)


async def _update_execution_metrics(
    conn: asyncpg.Connection,
    execution_id: str,
    events: list[dict[str, Any]],
) -> None:
    """Update metrics for an execution."""
    # Count events by type
    llm_calls = 0
    tool_calls = 0
    errors = 0
    total_tokens = 0
    total_cost = 0.0
    total_duration = 0
    
    for event in events:
        event_type = event.get("event_type") or event.get("type", "")
        
        if event_type == "llm_call":
            llm_calls += 1
            total_tokens += (event.get("input_tokens") or 0) + (event.get("output_tokens") or 0)
            total_cost += event.get("cost_usd") or 0.0
            total_duration += event.get("duration_ms") or 0
        elif event_type == "tool_call":
            tool_calls += 1
            total_duration += event.get("duration_ms") or 0
        elif event_type == "error":
            errors += 1
    
    # Update execution record
    await conn.execute(
        """
        UPDATE executions
        SET 
            llm_calls = COALESCE(llm_calls, 0) + $2,
            tool_calls = COALESCE(tool_calls, 0) + $3,
            total_tokens = COALESCE(total_tokens, 0) + $4,
            total_cost_usd = COALESCE(total_cost_usd, 0) + $5,
            updated_at = NOW()
        WHERE id = $1
        """,
        execution_id if not isinstance(execution_id, str) else execution_id,
        llm_calls,
        tool_calls,
        total_tokens,
        total_cost,
    )


async def _update_cost_aggregates(
    conn: asyncpg.Connection,
    events: list[dict[str, Any]],
) -> None:
    """Update cost aggregates."""
    # Group by hour and model
    cost_by_model: dict[tuple[str, str, datetime], float] = defaultdict(float)
    tokens_by_model: dict[tuple[str, str, datetime], tuple[int, int]] = defaultdict(lambda: (0, 0))
    
    for event in events:
        event_type = event.get("event_type") or event.get("type", "")
        
        if event_type != "llm_call":
            continue
        
        model = event.get("model") or "unknown"
        provider = event.get("provider") or "unknown"
        cost = event.get("cost_usd") or 0.0
        input_tokens = event.get("input_tokens") or 0
        output_tokens = event.get("output_tokens") or 0
        
        # Round to hour
        timestamp = event.get("timestamp")
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        elif timestamp is None:
            timestamp = datetime.now(timezone.utc)
        
        hour = timestamp.replace(minute=0, second=0, microsecond=0)
        
        key = (model, provider, hour)
        cost_by_model[key] += cost
        
        existing = tokens_by_model[key]
        tokens_by_model[key] = (existing[0] + input_tokens, existing[1] + output_tokens)
    
    # Upsert aggregates
    for (model, provider, hour), cost in cost_by_model.items():
        input_tokens, output_tokens = tokens_by_model[(model, provider, hour)]
        
        await conn.execute(
            """
            INSERT INTO cost_aggregates (
                model, provider, hour, total_cost_usd, 
                total_input_tokens, total_output_tokens, call_count
            )
            VALUES ($1, $2, $3, $4, $5, $6, 1)
            ON CONFLICT (model, provider, hour) 
            DO UPDATE SET
                total_cost_usd = cost_aggregates.total_cost_usd + $4,
                total_input_tokens = cost_aggregates.total_input_tokens + $5,
                total_output_tokens = cost_aggregates.total_output_tokens + $6,
                call_count = cost_aggregates.call_count + 1
            """,
            model,
            provider,
            hour,
            cost,
            input_tokens,
            output_tokens,
        )


class AggregationWorker:
    """Background worker for periodic aggregations."""
    
    def __init__(self):
        self.settings = get_settings()
        self._running = False
        self._task: asyncio.Task | None = None
    
    async def start(self) -> None:
        """Start the aggregation worker."""
        logger.info("Starting aggregation worker")
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
    
    async def stop(self) -> None:
        """Stop the aggregation worker."""
        logger.info("Stopping aggregation worker")
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    async def _run_loop(self) -> None:
        """Main aggregation loop."""
        while self._running:
            try:
                await self._run_aggregations()
                await asyncio.sleep(self.settings.aggregation_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Aggregation error", error=str(e))
                await asyncio.sleep(10)
    
    async def _run_aggregations(self) -> None:
        """Run periodic aggregations."""
        from collector.database import get_connection
        
        async with get_connection() as conn:
            # Update agent metrics
            await self._update_agent_metrics(conn)
            
            # Clean up old data
            await self._cleanup_old_data(conn)
    
    async def _update_agent_metrics(self, conn: asyncpg.Connection) -> None:
        """Update aggregated agent metrics."""
        # Calculate metrics for the last hour
        await conn.execute(
            """
            INSERT INTO agent_metrics (
                agent_id, hour, execution_count, success_count, 
                failure_count, total_tokens, total_cost_usd, avg_duration_ms
            )
            SELECT 
                agent_id,
                date_trunc('hour', started_at) as hour,
                COUNT(*) as execution_count,
                COUNT(*) FILTER (WHERE status = 'completed') as success_count,
                COUNT(*) FILTER (WHERE status = 'failed') as failure_count,
                COALESCE(SUM(total_tokens), 0) as total_tokens,
                COALESCE(SUM(total_cost_usd), 0) as total_cost_usd,
                COALESCE(AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000), 0) as avg_duration_ms
            FROM executions
            WHERE started_at >= NOW() - INTERVAL '2 hours'
            GROUP BY agent_id, date_trunc('hour', started_at)
            ON CONFLICT (agent_id, hour) 
            DO UPDATE SET
                execution_count = EXCLUDED.execution_count,
                success_count = EXCLUDED.success_count,
                failure_count = EXCLUDED.failure_count,
                total_tokens = EXCLUDED.total_tokens,
                total_cost_usd = EXCLUDED.total_cost_usd,
                avg_duration_ms = EXCLUDED.avg_duration_ms
            """
        )
    
    async def _cleanup_old_data(self, conn: asyncpg.Connection) -> None:
        """Clean up data older than retention period."""
        retention_cutoff = datetime.now(timezone.utc) - timedelta(days=self.settings.retention_days)
        
        # Delete old events (but keep executions longer for compliance)
        deleted = await conn.execute(
            """
            DELETE FROM events
            WHERE timestamp < $1
            """,
            retention_cutoff,
        )
        
        if deleted and "DELETE" in deleted:
            count = int(deleted.split()[-1])
            if count > 0:
                logger.info("Cleaned up old events", count=count)


# Global worker instance
_worker: AggregationWorker | None = None


def get_aggregation_worker() -> AggregationWorker:
    """Get the global aggregation worker."""
    global _worker
    if _worker is None:
        _worker = AggregationWorker()
    return _worker
