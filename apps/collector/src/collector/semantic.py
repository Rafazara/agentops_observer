"""
Semantic analysis using Anthropic Claude.
"""

import asyncio
import json
from typing import Any
from datetime import datetime, timezone

import structlog
from anthropic import AsyncAnthropic

from collector.config import get_settings
from collector.database import get_connection

logger = structlog.get_logger()


class SemanticAnalyzer:
    """Analyzes agent behavior using Claude for semantic insights."""
    
    def __init__(self):
        self.settings = get_settings()
        self._client: AsyncAnthropic | None = None
        self._running = False
        self._task: asyncio.Task | None = None
    
    async def start(self) -> None:
        """Start the semantic analyzer."""
        if not self.settings.semantic_analysis_enabled:
            logger.info("Semantic analysis disabled")
            return
            
        if not self.settings.anthropic_api_key:
            logger.warning("Anthropic API key not configured, semantic analysis disabled")
            return
        
        logger.info("Starting semantic analyzer")
        
        self._client = AsyncAnthropic(api_key=self.settings.anthropic_api_key)
        self._running = True
        self._task = asyncio.create_task(self._run_loop())
    
    async def stop(self) -> None:
        """Stop the semantic analyzer."""
        logger.info("Stopping semantic analyzer")
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
    
    async def _run_loop(self) -> None:
        """Main analysis loop."""
        while self._running:
            try:
                await self._analyze_recent_executions()
                await asyncio.sleep(60)  # Run every minute
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Semantic analysis error", error=str(e))
                await asyncio.sleep(30)
    
    async def _analyze_recent_executions(self) -> None:
        """Analyze recent executions for patterns and anomalies."""
        if not self._client:
            return
        
        async with get_connection() as conn:
            # Find executions needing analysis
            executions = await conn.fetch(
                """
                SELECT e.id, e.agent_id, e.status, e.trigger,
                       e.started_at, e.ended_at, e.total_tokens, e.total_cost_usd
                FROM executions e
                LEFT JOIN execution_analysis ea ON e.id = ea.execution_id
                WHERE ea.id IS NULL
                    AND e.ended_at IS NOT NULL
                    AND e.ended_at >= NOW() - INTERVAL '5 minutes'
                LIMIT 10
                """
            )
            
            for execution in executions:
                try:
                    await self._analyze_execution(conn, execution)
                except Exception as e:
                    logger.error(
                        "Failed to analyze execution",
                        execution_id=str(execution["id"]),
                        error=str(e),
                    )
    
    async def _analyze_execution(
        self,
        conn,
        execution: dict,
    ) -> None:
        """Analyze a single execution."""
        # Fetch events for this execution
        events = await conn.fetch(
            """
            SELECT event_type, timestamp, data, model, provider,
                   input_tokens, output_tokens, duration_ms
            FROM events
            WHERE execution_id = $1
            ORDER BY timestamp
            """,
            execution["id"],
        )
        
        if not events:
            return
        
        # Build context for analysis
        context = self._build_analysis_context(execution, events)
        
        # Call Claude for analysis
        analysis = await self._call_claude(context)
        
        if analysis:
            # Store analysis results
            await conn.execute(
                """
                INSERT INTO execution_analysis (
                    execution_id, summary, detected_patterns,
                    anomalies, recommendations, analyzed_at
                )
                VALUES ($1, $2, $3, $4, $5, NOW())
                """,
                execution["id"],
                analysis.get("summary", ""),
                json.dumps(analysis.get("patterns", [])),
                json.dumps(analysis.get("anomalies", [])),
                json.dumps(analysis.get("recommendations", [])),
            )
            
            logger.info(
                "Execution analyzed",
                execution_id=str(execution["id"]),
                anomaly_count=len(analysis.get("anomalies", [])),
            )
    
    def _build_analysis_context(
        self,
        execution: dict,
        events: list,
    ) -> str:
        """Build context string for Claude analysis."""
        lines = [
            "Analyze this AI agent execution for patterns and anomalies.",
            "",
            f"Execution ID: {execution['id']}",
            f"Agent: {execution['agent_id']}",
            f"Status: {execution['status']}",
            f"Duration: {self._calc_duration(execution)}ms",
            f"Total tokens: {execution.get('total_tokens', 0)}",
            f"Total cost: ${execution.get('total_cost_usd', 0):.4f}",
            "",
            "Events:",
        ]
        
        for event in events[:50]:  # Limit events for context window
            event_line = f"  - {event['event_type']}"
            if event.get("model"):
                event_line += f" (model: {event['model']})"
            if event.get("duration_ms"):
                event_line += f" [{event['duration_ms']}ms]"
            lines.append(event_line)
        
        if len(events) > 50:
            lines.append(f"  ... and {len(events) - 50} more events")
        
        return "\n".join(lines)
    
    def _calc_duration(self, execution: dict) -> int:
        """Calculate execution duration in milliseconds."""
        if execution.get("started_at") and execution.get("ended_at"):
            delta = execution["ended_at"] - execution["started_at"]
            return int(delta.total_seconds() * 1000)
        return 0
    
    async def _call_claude(self, context: str) -> dict[str, Any] | None:
        """Call Claude for semantic analysis."""
        if not self._client:
            return None
        
        try:
            response = await self._client.messages.create(
                model=self.settings.anthropic_model,
                max_tokens=1024,
                messages=[
                    {
                        "role": "user",
                        "content": f"""{context}

Please analyze this execution and provide:
1. A brief summary (1-2 sentences)
2. Detected patterns (array of pattern names)
3. Anomalies (array of objects with 'type' and 'description')
4. Recommendations (array of actionable suggestions)

Respond with valid JSON only, no other text:
{{"summary": "...", "patterns": [...], "anomalies": [...], "recommendations": [...]}}""",
                    }
                ],
            )
            
            # Extract text content
            text = response.content[0].text if response.content else ""
            
            # Parse JSON response
            return json.loads(text)
            
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse Claude response", error=str(e))
            return None
        except Exception as e:
            logger.error("Claude API error", error=str(e))
            return None


# Global analyzer instance
_analyzer: SemanticAnalyzer | None = None


def get_semantic_analyzer() -> SemanticAnalyzer:
    """Get the global semantic analyzer."""
    global _analyzer
    if _analyzer is None:
        _analyzer = SemanticAnalyzer()
    return _analyzer
