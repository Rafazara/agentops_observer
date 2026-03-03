"""
WebSocket Routes

Real-time updates for executions and incidents.
"""

import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
import structlog

from app.core.database import db, Database, get_db
from app.core.cache import cache
from app.core.security import decode_access_token

logger = structlog.get_logger(__name__)
router = APIRouter()


# ============================================================================
# Connection Manager
# ============================================================================

class ConnectionManager:
    """Manages WebSocket connections per organization."""
    
    def __init__(self):
        # org_id -> set of connections
        self.active_connections: dict[UUID, set[WebSocket]] = {}
        # connection -> subscribed channels
        self.subscriptions: dict[WebSocket, set[str]] = {}
    
    async def connect(self, websocket: WebSocket, org_id: UUID):
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        
        if org_id not in self.active_connections:
            self.active_connections[org_id] = set()
        
        self.active_connections[org_id].add(websocket)
        self.subscriptions[websocket] = set()
        
        logger.info(
            "WebSocket connected",
            org_id=str(org_id),
            total_connections=len(self.active_connections.get(org_id, [])),
        )
    
    def disconnect(self, websocket: WebSocket, org_id: UUID):
        """Remove a WebSocket connection."""
        if org_id in self.active_connections:
            self.active_connections[org_id].discard(websocket)
            
            if not self.active_connections[org_id]:
                del self.active_connections[org_id]
        
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        
        logger.info("WebSocket disconnected", org_id=str(org_id))
    
    def subscribe(self, websocket: WebSocket, channel: str):
        """Subscribe a connection to a channel."""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(channel)
    
    def unsubscribe(self, websocket: WebSocket, channel: str):
        """Unsubscribe a connection from a channel."""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(channel)
    
    async def broadcast_to_org(self, org_id: UUID, message: dict[str, Any]):
        """Broadcast a message to all connections for an organization."""
        if org_id not in self.active_connections:
            return
        
        disconnected = []
        
        for connection in self.active_connections[org_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        # Clean up disconnected
        for conn in disconnected:
            self.disconnect(conn, org_id)
    
    async def broadcast_to_channel(self, org_id: UUID, channel: str, message: dict[str, Any]):
        """Broadcast a message to connections subscribed to a channel."""
        if org_id not in self.active_connections:
            return
        
        disconnected = []
        
        for connection in self.active_connections[org_id]:
            if channel in self.subscriptions.get(connection, set()):
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)
        
        # Clean up disconnected
        for conn in disconnected:
            self.disconnect(conn, org_id)
    
    def get_connection_count(self, org_id: UUID) -> int:
        """Get the number of active connections for an organization."""
        return len(self.active_connections.get(org_id, []))


# Global connection manager
manager = ConnectionManager()


# ============================================================================
# WebSocket Authentication
# ============================================================================

async def authenticate_websocket(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
) -> tuple[UUID, UUID]:
    """
    Authenticate WebSocket connection using JWT token.
    
    Returns (user_id, org_id) if valid, raises exception otherwise.
    """
    try:
        payload = decode_access_token(token)
        return UUID(payload["sub"]), UUID(payload["org_id"])
    except Exception as e:
        logger.warning("WebSocket authentication failed", error=str(e))
        await websocket.close(code=4001, reason="Authentication failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """
    WebSocket endpoint for real-time updates.
    
    ## Authentication
    Pass the JWT access token as a query parameter: `/ws?token=<jwt>`
    
    ## Message Types
    
    ### Subscribe to channels:
    ```json
    {"type": "subscribe", "channels": ["executions", "incidents"]}
    ```
    
    ### Unsubscribe:
    ```json
    {"type": "unsubscribe", "channels": ["executions"]}
    ```
    
    ### Ping (keep-alive):
    ```json
    {"type": "ping"}
    ```
    
    ## Server Messages
    
    ### Execution started:
    ```json
    {
        "type": "execution_started",
        "data": {"execution_id": "...", "agent_id": "...", "started_at": "..."}
    }
    ```
    
    ### Execution completed:
    ```json
    {
        "type": "execution_completed",
        "data": {"execution_id": "...", "status": "success", "duration_ms": 1234}
    }
    ```
    
    ### Incident created:
    ```json
    {
        "type": "incident_created",
        "data": {"id": "...", "severity": "high", "title": "..."}
    }
    ```
    """
    # Authenticate
    try:
        payload = decode_access_token(token)
        user_id = UUID(payload["sub"])
        org_id = UUID(payload["org_id"])
    except Exception as e:
        logger.warning("WebSocket authentication failed", error=str(e))
        await websocket.close(code=4001, reason="Authentication failed")
        return
    
    # Connect
    await manager.connect(websocket, org_id)
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "data": {
                "user_id": str(user_id),
                "org_id": str(org_id),
                "connected_at": datetime.utcnow().isoformat(),
            },
        })
        
        # Message loop
        while True:
            try:
                message = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=60.0,  # 60 second timeout
                )
                
                await handle_message(websocket, org_id, message)
                
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error("WebSocket message error", error=str(e))
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": str(e)},
                })
                
    finally:
        manager.disconnect(websocket, org_id)


async def handle_message(websocket: WebSocket, org_id: UUID, message: dict[str, Any]):
    """Handle incoming WebSocket message."""
    msg_type = message.get("type")
    
    if msg_type == "ping":
        await websocket.send_json({"type": "pong"})
    
    elif msg_type == "subscribe":
        channels = message.get("channels", [])
        for channel in channels:
            if channel in ["executions", "incidents", "costs", "agents"]:
                manager.subscribe(websocket, channel)
        
        await websocket.send_json({
            "type": "subscribed",
            "data": {"channels": channels},
        })
    
    elif msg_type == "unsubscribe":
        channels = message.get("channels", [])
        for channel in channels:
            manager.unsubscribe(websocket, channel)
        
        await websocket.send_json({
            "type": "unsubscribed",
            "data": {"channels": channels},
        })
    
    else:
        await websocket.send_json({
            "type": "error",
            "data": {"message": f"Unknown message type: {msg_type}"},
        })


# ============================================================================
# Helper Functions for Broadcasting
# ============================================================================

async def broadcast_execution_started(org_id: UUID, execution_data: dict[str, Any]):
    """Broadcast execution started event."""
    await manager.broadcast_to_channel(
        org_id,
        "executions",
        {
            "type": "execution_started",
            "data": execution_data,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def broadcast_execution_completed(org_id: UUID, execution_data: dict[str, Any]):
    """Broadcast execution completed event."""
    await manager.broadcast_to_channel(
        org_id,
        "executions",
        {
            "type": "execution_completed",
            "data": execution_data,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def broadcast_incident_created(org_id: UUID, incident_data: dict[str, Any]):
    """Broadcast incident created event."""
    await manager.broadcast_to_channel(
        org_id,
        "incidents",
        {
            "type": "incident_created",
            "data": incident_data,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def broadcast_incident_updated(org_id: UUID, incident_data: dict[str, Any]):
    """Broadcast incident updated event."""
    await manager.broadcast_to_channel(
        org_id,
        "incidents",
        {
            "type": "incident_updated",
            "data": incident_data,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def broadcast_cost_alert(org_id: UUID, alert_data: dict[str, Any]):
    """Broadcast cost alert event."""
    await manager.broadcast_to_channel(
        org_id,
        "costs",
        {
            "type": "cost_alert",
            "data": alert_data,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )
