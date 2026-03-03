"""
Alert rule evaluation and notification.
"""

import asyncio
import json
from datetime import datetime, timezone, timedelta
from typing import Any
from uuid import UUID

import structlog
import httpx

from collector.config import get_settings
from collector.database import get_connection

logger = structlog.get_logger()


async def check_alert_rules(events: list[dict[str, Any]]) -> None:
    """
    Check alert rules against incoming events.
    
    This performs real-time alerting on events as they arrive.
    """
    settings = get_settings()
    
    if not settings.alerting_enabled:
        return
    
    try:
        async with get_connection() as conn:
            # Fetch active alert rules
            rules = await conn.fetch(
                """
                SELECT id, organization_id, name, conditions, actions, cooldown_minutes
                FROM alert_rules
                WHERE is_enabled = true
                """
            )
            
            for rule in rules:
                try:
                    await _evaluate_rule(conn, rule, events)
                except Exception as e:
                    logger.error(
                        "Failed to evaluate alert rule",
                        rule_id=str(rule["id"]),
                        error=str(e),
                    )
                    
    except Exception as e:
        logger.error("Failed to check alert rules", error=str(e))


async def _evaluate_rule(
    conn,
    rule: dict,
    events: list[dict[str, Any]],
) -> None:
    """Evaluate a single alert rule against events."""
    conditions = rule["conditions"]
    
    if not conditions:
        return
    
    # Parse conditions
    metric = conditions.get("metric")
    operator = conditions.get("operator", ">=")
    threshold = conditions.get("threshold")
    window_minutes = conditions.get("window_minutes", 5)
    
    if not all([metric, threshold]):
        return
    
    # Check cooldown
    cooldown_minutes = rule.get("cooldown_minutes", 5)
    last_alert = await conn.fetchval(
        """
        SELECT MAX(created_at)
        FROM alert_history
        WHERE rule_id = $1
        """,
        rule["id"],
    )
    
    if last_alert:
        cooldown_end = last_alert + timedelta(minutes=cooldown_minutes)
        if datetime.now(timezone.utc) < cooldown_end:
            return
    
    # Calculate metric value
    metric_value = await _calculate_metric(conn, metric, window_minutes, events)
    
    # Evaluate condition
    triggered = _evaluate_condition(metric_value, operator, threshold)
    
    if triggered:
        logger.info(
            "Alert triggered",
            rule_id=str(rule["id"]),
            rule_name=rule["name"],
            metric=metric,
            value=metric_value,
            threshold=threshold,
        )
        
        # Record alert
        await conn.execute(
            """
            INSERT INTO alert_history (rule_id, triggered_value, threshold_value)
            VALUES ($1, $2, $3)
            """,
            rule["id"],
            metric_value,
            threshold,
        )
        
        # Execute actions
        actions = rule.get("actions", {})
        await _execute_actions(rule, metric_value, actions)


async def _calculate_metric(
    conn,
    metric: str,
    window_minutes: int,
    recent_events: list[dict[str, Any]],
) -> float:
    """Calculate a metric value from the database and recent events."""
    window_start = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    
    if metric == "error_rate":
        # Calculate error rate as percentage
        result = await conn.fetchrow(
            """
            SELECT 
                COUNT(*) FILTER (WHERE status = 'failed') as failures,
                COUNT(*) as total
            FROM executions
            WHERE started_at >= $1
            """,
            window_start,
        )
        
        if result and result["total"] > 0:
            return (result["failures"] / result["total"]) * 100
        return 0.0
        
    elif metric == "latency_p99":
        # Calculate 99th percentile latency
        result = await conn.fetchval(
            """
            SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000
            )
            FROM executions
            WHERE started_at >= $1 AND ended_at IS NOT NULL
            """,
            window_start,
        )
        return float(result) if result else 0.0
        
    elif metric == "latency_p95":
        result = await conn.fetchval(
            """
            SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000
            )
            FROM executions
            WHERE started_at >= $1 AND ended_at IS NOT NULL
            """,
            window_start,
        )
        return float(result) if result else 0.0
        
    elif metric == "cost_per_hour":
        # Calculate cost rate
        result = await conn.fetchval(
            """
            SELECT COALESCE(SUM(total_cost_usd), 0)
            FROM executions
            WHERE started_at >= $1
            """,
            window_start,
        )
        # Normalize to per-hour rate
        return float(result or 0) * (60 / window_minutes)
        
    elif metric == "execution_count":
        result = await conn.fetchval(
            """
            SELECT COUNT(*)
            FROM executions
            WHERE started_at >= $1
            """,
            window_start,
        )
        return float(result) if result else 0.0
        
    elif metric == "token_usage":
        result = await conn.fetchval(
            """
            SELECT COALESCE(SUM(total_tokens), 0)
            FROM executions
            WHERE started_at >= $1
            """,
            window_start,
        )
        return float(result) if result else 0.0
        
    elif metric == "loop_detections":
        # Count loop detection events
        count = sum(
            1 for e in recent_events
            if e.get("event_type") == "loop_detected" or e.get("data", {}).get("loop_detected")
        )
        return float(count)
    
    return 0.0


def _evaluate_condition(value: float, operator: str, threshold: float) -> bool:
    """Evaluate a condition."""
    if operator == ">=":
        return value >= threshold
    elif operator == ">":
        return value > threshold
    elif operator == "<=":
        return value <= threshold
    elif operator == "<":
        return value < threshold
    elif operator == "==":
        return value == threshold
    elif operator == "!=":
        return value != threshold
    return False


async def _execute_actions(
    rule: dict,
    metric_value: float,
    actions: dict[str, Any],
) -> None:
    """Execute alert actions."""
    # Webhook notification
    webhook_url = actions.get("webhook_url")
    if webhook_url:
        await _send_webhook(
            webhook_url,
            rule_name=rule["name"],
            metric_value=metric_value,
            actions=actions,
        )
    
    # Email notification (placeholder - would need email service)
    email = actions.get("email")
    if email:
        logger.info(
            "Email notification (not implemented)",
            to=email,
            rule_name=rule["name"],
        )
    
    # Slack notification
    slack_webhook = actions.get("slack_webhook")
    if slack_webhook:
        await _send_slack_notification(
            slack_webhook,
            rule_name=rule["name"],
            metric_value=metric_value,
        )


async def _send_webhook(
    url: str,
    rule_name: str,
    metric_value: float,
    actions: dict[str, Any],
) -> None:
    """Send webhook notification."""
    try:
        payload = {
            "alert": rule_name,
            "value": metric_value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": actions.get("severity", "warning"),
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            
        logger.info("Webhook notification sent", url=url)
        
    except Exception as e:
        logger.error("Failed to send webhook", url=url, error=str(e))


async def _send_slack_notification(
    webhook_url: str,
    rule_name: str,
    metric_value: float,
) -> None:
    """Send Slack notification."""
    try:
        payload = {
            "text": f"🚨 Alert: {rule_name}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Alert Triggered*\n*Rule:* {rule_name}\n*Value:* {metric_value:.2f}",
                    },
                },
            ],
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(webhook_url, json=payload)
            response.raise_for_status()
            
        logger.info("Slack notification sent")
        
    except Exception as e:
        logger.error("Failed to send Slack notification", error=str(e))


class AlertWorker:
    """Background worker for periodic alert checks."""
    
    def __init__(self):
        self.settings = get_settings()
        self._running = False
        self._task: asyncio.Task | None = None
    
    async def start(self) -> None:
        """Start the alert worker."""
        if not self.settings.alerting_enabled:
            logger.info("Alerting disabled")
            return
            
        logger.info("Starting alert worker")
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
    
    async def stop(self) -> None:
        """Stop the alert worker."""
        logger.info("Stopping alert worker")
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    async def _run_loop(self) -> None:
        """Main alert check loop."""
        while self._running:
            try:
                await check_alert_rules([])  # Periodic check without new events
                await asyncio.sleep(self.settings.alert_check_interval_seconds)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Alert check error", error=str(e))
                await asyncio.sleep(10)


# Global worker instance
_alert_worker: AlertWorker | None = None


def get_alert_worker() -> AlertWorker:
    """Get the global alert worker."""
    global _alert_worker
    if _alert_worker is None:
        _alert_worker = AlertWorker()
    return _alert_worker
