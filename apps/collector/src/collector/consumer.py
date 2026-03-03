"""
Kafka consumer for processing events.
"""

import asyncio
import json
from typing import Any
from datetime import datetime, timezone
from uuid import UUID

import structlog
from aiokafka import AIOKafkaConsumer, ConsumerRecord

from collector.config import get_settings
from collector.database import get_connection
from collector.aggregator import update_aggregates
from collector.alerting import check_alert_rules

logger = structlog.get_logger()


class EventConsumer:
    """Kafka consumer for AgentOps events."""
    
    def __init__(self):
        self.settings = get_settings()
        self.consumer: AIOKafkaConsumer | None = None
        self._running = False
        self._task: asyncio.Task | None = None
    
    async def start(self) -> None:
        """Start the Kafka consumer."""
        logger.info("Starting Kafka consumer", topic=self.settings.kafka_events_topic)
        
        self.consumer = AIOKafkaConsumer(
            self.settings.kafka_events_topic,
            bootstrap_servers=self.settings.kafka_bootstrap_servers,
            group_id=self.settings.kafka_consumer_group,
            auto_offset_reset=self.settings.kafka_auto_offset_reset,
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        )
        
        await self.consumer.start()
        self._running = True
        self._task = asyncio.create_task(self._consume_loop())
        
        logger.info("Kafka consumer started")
    
    async def stop(self) -> None:
        """Stop the Kafka consumer."""
        logger.info("Stopping Kafka consumer")
        
        self._running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        if self.consumer:
            await self.consumer.stop()
        
        logger.info("Kafka consumer stopped")
    
    async def _consume_loop(self) -> None:
        """Main consume loop."""
        batch: list[dict[str, Any]] = []
        last_process_time = asyncio.get_event_loop().time()
        
        while self._running:
            try:
                # Fetch messages with timeout
                messages = await self.consumer.getmany(
                    timeout_ms=self.settings.kafka_batch_timeout_ms,
                    max_records=self.settings.kafka_batch_size,
                )
                
                for tp, records in messages.items():
                    for record in records:
                        event = self._parse_record(record)
                        if event:
                            batch.append(event)
                
                # Process batch if we have enough events or timeout
                current_time = asyncio.get_event_loop().time()
                should_process = (
                    len(batch) >= self.settings.kafka_batch_size
                    or (batch and current_time - last_process_time > self.settings.kafka_batch_timeout_ms / 1000)
                )
                
                if should_process and batch:
                    await self._process_batch(batch)
                    batch = []
                    last_process_time = current_time
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in consume loop", error=str(e))
                await asyncio.sleep(1)
        
        # Process remaining batch
        if batch:
            await self._process_batch(batch)
    
    def _parse_record(self, record: ConsumerRecord) -> dict[str, Any] | None:
        """Parse a Kafka record into an event dict."""
        try:
            return record.value
        except Exception as e:
            logger.error("Failed to parse record", error=str(e))
            return None
    
    async def _process_batch(self, events: list[dict[str, Any]]) -> None:
        """Process a batch of events."""
        logger.info("Processing event batch", count=len(events))
        
        try:
            async with get_connection() as conn:
                async with conn.transaction():
                    # Insert events
                    await self._insert_events(conn, events)
                    
                    # Update aggregates
                    await update_aggregates(conn, events)
            
            # Check alert rules (outside transaction)
            if self.settings.alerting_enabled:
                await check_alert_rules(events)
            
            logger.info("Batch processed successfully", count=len(events))
            
        except Exception as e:
            logger.error("Failed to process batch", error=str(e))
    
    async def _insert_events(
        self, 
        conn, 
        events: list[dict[str, Any]],
    ) -> None:
        """Insert events into the database."""
        for event in events:
            try:
                event_id = event.get("id") or event.get("event_id")
                execution_id = event.get("execution_id")
                event_type = event.get("event_type") or event.get("type")
                
                if not all([event_id, execution_id, event_type]):
                    logger.warning("Skipping malformed event", event=event)
                    continue
                
                await conn.execute(
                    """
                    INSERT INTO events (
                        id, execution_id, event_type, timestamp, data,
                        model, provider, input_tokens, output_tokens, 
                        duration_ms, cost_usd
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    UUID(event_id) if isinstance(event_id, str) else event_id,
                    UUID(execution_id) if isinstance(execution_id, str) else execution_id,
                    event_type,
                    event.get("timestamp", datetime.now(timezone.utc)),
                    json.dumps(event.get("data", {})),
                    event.get("model"),
                    event.get("provider"),
                    event.get("input_tokens"),
                    event.get("output_tokens"),
                    event.get("duration_ms"),
                    event.get("cost_usd"),
                )
                
            except Exception as e:
                logger.error("Failed to insert event", event_id=event.get("id"), error=str(e))


# Global consumer instance
_consumer: EventConsumer | None = None


def get_consumer() -> EventConsumer:
    """Get the global consumer instance."""
    global _consumer
    if _consumer is None:
        _consumer = EventConsumer()
    return _consumer
