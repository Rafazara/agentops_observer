"""
Costs Routes

Handles cost analytics, forecasting, and budget alerts.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
import structlog

from app.core.database import db, Database, get_db
from app.core.cache import cache
from app.routes.auth import get_current_user, CurrentUser
from app.models.costs import (
    CostSummary,
    CostBreakdown,
    CostForecast,
    CostTimeSeries,
    ModelCostComparison,
    CostAlert,
)
from app.models import BaseSchema

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# Cost Summary
# ============================================================================

@router.get(
    "/summary",
    response_model=CostSummary,
    summary="Get cost summary",
    description="Get aggregated cost summary for the organization.",
)
async def get_cost_summary(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    period: str = Query("30d", regex="^(7d|30d|90d)$", description="Time period"),
    project_id: UUID | None = Query(None, description="Filter by project"),
    agent_id: str | None = Query(None, description="Filter by agent"),
):
    """
    Get cost summary with breakdown by model, agent, and day.
    """
    period_map = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
    }
    from_time = datetime.utcnow() - period_map[period]
    prev_period_start = from_time - period_map[period]
    
    # Build filters
    conditions = ["org_id = $1", "started_at >= $2"]
    params: list = [current_user.org_id, from_time]
    param_idx = 3
    
    if project_id:
        conditions.append(f"project_id = ${param_idx}")
        params.append(project_id)
        param_idx += 1
    
    if agent_id:
        conditions.append(f"agent_id = ${param_idx}")
        params.append(agent_id)
        param_idx += 1
    
    where_clause = " AND ".join(conditions)
    
    # Total cost current period
    current_row = await database.fetch_one(
        f"""
        SELECT 
            COALESCE(SUM(total_cost_usd), 0) as total_cost,
            COALESCE(SUM(total_tokens), 0) as total_tokens,
            COUNT(*) as execution_count
        FROM agent_executions
        WHERE {where_clause}
        """,
        *params,
    )
    
    # Previous period for comparison
    prev_conditions = conditions.copy()
    prev_conditions[1] = f"started_at >= ${param_idx} AND started_at < ${param_idx + 1}"
    prev_where = " AND ".join(prev_conditions)
    
    prev_row = await database.fetch_one(
        f"""
        SELECT 
            COALESCE(SUM(total_cost_usd), 0) as total_cost
        FROM agent_executions
        WHERE {prev_where}
        """,
        *params[:-1] if len(params) > 2 else params[:1],
        prev_period_start,
        from_time,
    )
    
    # Breakdown by model
    model_rows = await database.fetch_all(
        f"""
        SELECT 
            ee.model_id,
            ee.provider,
            SUM(ee.cost_usd) as cost,
            SUM(ee.input_tokens) as input_tokens,
            SUM(ee.output_tokens) as output_tokens,
            COUNT(*) as call_count
        FROM execution_events ee
        JOIN agent_executions ae ON ee.execution_id = ae.execution_id
        WHERE ae.{where_clause}
          AND ee.event_type = 'llm_call'
          AND ee.model_id IS NOT NULL
        GROUP BY ee.model_id, ee.provider
        ORDER BY cost DESC
        LIMIT 10
        """,
        *params,
    )
    
    # Breakdown by agent
    agent_rows = await database.fetch_all(
        f"""
        SELECT 
            agent_id,
            SUM(total_cost_usd) as cost,
            COUNT(*) as execution_count
        FROM agent_executions
        WHERE {where_clause}
        GROUP BY agent_id
        ORDER BY cost DESC
        LIMIT 10
        """,
        *params,
    )
    
    # Daily time series
    daily_rows = await database.fetch_all(
        f"""
        SELECT 
            DATE(started_at) as date,
            SUM(total_cost_usd) as cost,
            COUNT(*) as executions
        FROM agent_executions
        WHERE {where_clause}
        GROUP BY DATE(started_at)
        ORDER BY date
        """,
        *params,
    )
    
    total_cost = current_row["total_cost"]
    prev_cost = prev_row["total_cost"]
    
    cost_change_pct = None
    if prev_cost and prev_cost > 0:
        cost_change_pct = float((total_cost - prev_cost) / prev_cost * 100)
    
    return CostSummary(
        period=period,
        total_cost_usd=total_cost,
        total_tokens=current_row["total_tokens"],
        execution_count=current_row["execution_count"],
        cost_change_pct=cost_change_pct,
        prev_period_cost_usd=prev_cost,
        avg_cost_per_execution=total_cost / current_row["execution_count"] if current_row["execution_count"] > 0 else None,
        breakdown_by_model=[
            {
                "model_id": r["model_id"],
                "provider": r["provider"],
                "cost_usd": float(r["cost"]),
                "input_tokens": r["input_tokens"],
                "output_tokens": r["output_tokens"],
                "call_count": r["call_count"],
            }
            for r in model_rows
        ],
        breakdown_by_agent=[
            {
                "agent_id": r["agent_id"],
                "cost_usd": float(r["cost"]),
                "execution_count": r["execution_count"],
            }
            for r in agent_rows
        ],
        daily_costs=[
            {
                "date": r["date"].isoformat(),
                "cost_usd": float(r["cost"]),
                "executions": r["executions"],
            }
            for r in daily_rows
        ],
    )


# ============================================================================
# Cost Forecast
# ============================================================================

@router.get(
    "/forecast",
    response_model=CostForecast,
    summary="Get cost forecast",
    description="Forecast costs for the next period based on current trends.",
)
async def get_cost_forecast(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    horizon: str = Query("30d", regex="^(7d|30d|90d)$", description="Forecast horizon"),
):
    """
    Forecast costs using linear regression on recent data.
    
    Uses the last 30 days of data to project future costs.
    """
    # Get last 30 days hourly data
    hourly_data = await database.fetch_all(
        """
        SELECT 
            date_trunc('hour', started_at) as hour,
            SUM(total_cost_usd) as cost
        FROM agent_executions
        WHERE org_id = $1 AND started_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY 1
        """,
        current_user.org_id,
    )
    
    if len(hourly_data) < 24:
        # Not enough data for forecast
        return CostForecast(
            horizon=horizon,
            forecast_cost_usd=None,
            confidence_low=None,
            confidence_high=None,
            trend="insufficient_data",
            daily_forecast=[],
        )
    
    # Simple linear regression
    import statistics
    
    costs = [float(r["cost"]) for r in hourly_data]
    avg_hourly_cost = statistics.mean(costs)
    
    # Calculate trend (comparing first half to second half)
    mid = len(costs) // 2
    first_half_avg = statistics.mean(costs[:mid])
    second_half_avg = statistics.mean(costs[mid:])
    
    trend = "stable"
    if second_half_avg > first_half_avg * 1.1:
        trend = "increasing"
    elif second_half_avg < first_half_avg * 0.9:
        trend = "decreasing"
    
    # Forecast hours
    horizon_hours = {
        "7d": 7 * 24,
        "30d": 30 * 24,
        "90d": 90 * 24,
    }[horizon]
    
    # Simple projection using recent average
    forecast_cost = avg_hourly_cost * horizon_hours
    
    # Confidence interval (using standard deviation)
    std_dev = statistics.stdev(costs) if len(costs) > 1 else 0
    confidence_range = std_dev * horizon_hours * 0.5  # 50% confidence
    
    # Daily forecast
    daily_forecast = []
    current_date = datetime.utcnow().date()
    for day in range(int(horizon[:-1])):  # Remove 'd' suffix
        day_date = current_date + timedelta(days=day + 1)
        # Add some variation based on day of week
        day_cost = avg_hourly_cost * 24
        if day_date.weekday() >= 5:  # Weekend
            day_cost *= 0.6
        daily_forecast.append({
            "date": day_date.isoformat(),
            "forecast_cost_usd": round(day_cost, 4),
        })
    
    return CostForecast(
        horizon=horizon,
        forecast_cost_usd=round(forecast_cost, 4),
        confidence_low=round(max(0, forecast_cost - confidence_range), 4),
        confidence_high=round(forecast_cost + confidence_range, 4),
        trend=trend,
        avg_daily_cost=round(avg_hourly_cost * 24, 4),
        daily_forecast=daily_forecast,
    )


# ============================================================================
# Model Cost Comparison
# ============================================================================

@router.get(
    "/models/compare",
    response_model=list[ModelCostComparison],
    summary="Compare model costs",
    description="Compare cost efficiency across different models.",
)
async def compare_model_costs(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
    period: str = Query("30d", regex="^(7d|30d)$", description="Time period"),
):
    """
    Compare cost efficiency and performance across LLM models.
    """
    period_map = {
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    from_time = datetime.utcnow() - period_map[period]
    
    rows = await database.fetch_all(
        """
        WITH model_stats AS (
            SELECT 
                ee.model_id,
                ee.provider,
                COUNT(*) as call_count,
                SUM(ee.cost_usd) as total_cost,
                SUM(ee.input_tokens) as input_tokens,
                SUM(ee.output_tokens) as output_tokens,
                AVG(ee.duration_ms) as avg_latency_ms,
                -- Calculate success based on whether parent execution succeeded
                COUNT(*) FILTER (WHERE ae.status = 'success') as successful_calls
            FROM execution_events ee
            JOIN agent_executions ae ON ee.execution_id = ae.execution_id
            WHERE ae.org_id = $1 
              AND ae.started_at >= $2
              AND ee.event_type = 'llm_call'
              AND ee.model_id IS NOT NULL
            GROUP BY ee.model_id, ee.provider
        )
        SELECT 
            ms.*,
            mp.input_cost_per_million,
            mp.output_cost_per_million,
            mp.context_window
        FROM model_stats ms
        LEFT JOIN model_pricing mp ON ms.model_id = mp.model_id AND ms.provider = mp.provider
        ORDER BY total_cost DESC
        """,
        current_user.org_id,
        from_time,
    )
    
    comparisons = []
    for r in rows:
        total_tokens = (r["input_tokens"] or 0) + (r["output_tokens"] or 0)
        cost_per_1k_tokens = None
        if total_tokens > 0 and r["total_cost"]:
            cost_per_1k_tokens = float(r["total_cost"]) / total_tokens * 1000
        
        comparisons.append(ModelCostComparison(
            model_id=r["model_id"],
            provider=r["provider"],
            call_count=r["call_count"],
            total_cost_usd=float(r["total_cost"] or 0),
            input_tokens=r["input_tokens"] or 0,
            output_tokens=r["output_tokens"] or 0,
            cost_per_1k_tokens=cost_per_1k_tokens,
            avg_latency_ms=float(r["avg_latency_ms"]) if r["avg_latency_ms"] else None,
            input_cost_per_million=float(r["input_cost_per_million"]) if r["input_cost_per_million"] else None,
            output_cost_per_million=float(r["output_cost_per_million"]) if r["output_cost_per_million"] else None,
            context_window=r["context_window"],
        ))
    
    return comparisons


# ============================================================================
# Budget Alerts
# ============================================================================

@router.get(
    "/alerts",
    response_model=list[CostAlert],
    summary="Get cost alerts",
    description="Get active cost and budget alerts.",
)
async def get_cost_alerts(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Get cost alerts based on configured thresholds.
    """
    # Get organization budget settings (would need to add this table)
    # For now, use some default thresholds
    
    # Current month spend
    month_spend = await database.fetch_one(
        """
        SELECT 
            COALESCE(SUM(total_cost_usd), 0) as cost
        FROM agent_executions
        WHERE org_id = $1 
          AND started_at >= DATE_TRUNC('month', NOW())
        """,
        current_user.org_id,
    )
    
    # Last 24h spend vs previous 24h
    recent_spend = await database.fetch_one(
        """
        SELECT 
            COALESCE(SUM(CASE WHEN started_at >= NOW() - INTERVAL '24 hours' 
                THEN total_cost_usd ELSE 0 END), 0) as last_24h,
            COALESCE(SUM(CASE WHEN started_at >= NOW() - INTERVAL '48 hours' 
                AND started_at < NOW() - INTERVAL '24 hours' 
                THEN total_cost_usd ELSE 0 END), 0) as prev_24h
        FROM agent_executions
        WHERE org_id = $1 
          AND started_at >= NOW() - INTERVAL '48 hours'
        """,
        current_user.org_id,
    )
    
    alerts = []
    
    # Check for spike
    last_24h = float(recent_spend["last_24h"])
    prev_24h = float(recent_spend["prev_24h"])
    
    if prev_24h > 0 and last_24h > prev_24h * 2:
        alerts.append(CostAlert(
            alert_type="spike",
            severity="warning",
            message=f"Cost spike detected: ${last_24h:.2f} in last 24h vs ${prev_24h:.2f} previous day (+{(last_24h/prev_24h - 1)*100:.0f}%)",
            current_value=last_24h,
            threshold_value=prev_24h * 2,
            detected_at=datetime.utcnow().isoformat(),
        ))
    
    # Example budget alert (would use actual budget from org settings)
    monthly_budget = 1000.0  # Placeholder
    month_cost = float(month_spend["cost"])
    budget_pct = month_cost / monthly_budget * 100 if monthly_budget > 0 else 0
    
    if budget_pct >= 90:
        alerts.append(CostAlert(
            alert_type="budget",
            severity="critical",
            message=f"Monthly budget {budget_pct:.0f}% utilized (${month_cost:.2f}/${monthly_budget:.2f})",
            current_value=month_cost,
            threshold_value=monthly_budget * 0.9,
            detected_at=datetime.utcnow().isoformat(),
        ))
    elif budget_pct >= 75:
        alerts.append(CostAlert(
            alert_type="budget",
            severity="warning",
            message=f"Monthly budget {budget_pct:.0f}% utilized (${month_cost:.2f}/${monthly_budget:.2f})",
            current_value=month_cost,
            threshold_value=monthly_budget * 0.75,
            detected_at=datetime.utcnow().isoformat(),
        ))
    
    return alerts
