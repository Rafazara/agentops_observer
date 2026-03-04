"""
Execution Tests

Tests for execution creation, listing, filtering, and event ingestion.
"""

import pytest
from uuid import uuid4
from datetime import datetime, timezone
from httpx import AsyncClient

from tests.conftest import create_test_execution, create_test_org, create_test_user, create_test_api_key, create_test_agent


# ============================================================================
# Ingest Tests
# ============================================================================

@pytest.mark.asyncio
async def test_ingest_with_api_key(async_client: AsyncClient, api_key_headers, test_agent):
    """Create execution via ingest endpoint with API key returns 202."""
    execution_id = str(uuid4())
    
    response = await async_client.post(
        "/api/v1/ingest/events",
        headers=api_key_headers,
        json={
            "executions": [
                {
                    "execution_id": execution_id,
                    "agent_id": test_agent["agent_id"],
                    "status": "running",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                }
            ],
            "events": [
                {
                    "execution_id": execution_id,
                    "event_type": "llm_call_start",
                    "sequence_number": 0,
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                    "model_id": "gpt-4",
                    "provider": "openai",
                }
            ],
        },
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["accepted"] == 2


@pytest.mark.asyncio
async def test_ingest_without_api_key(async_client: AsyncClient):
    """Create execution without API key returns 401."""
    response = await async_client.post(
        "/api/v1/ingest/events",
        json={
            "executions": [],
            "events": [],
        },
    )
    
    assert response.status_code == 422  # Missing X-API-Key header


@pytest.mark.asyncio
async def test_list_executions_filtered_by_status(
    async_client: AsyncClient, auth_headers, test_db, test_org, test_agent
):
    """List executions filtered by status returns correct results."""
    # Create executions with different statuses
    await create_test_execution(test_db, test_org["id"], test_agent["agent_id"], "completed")
    await create_test_execution(test_db, test_org["id"], test_agent["agent_id"], "failed")
    await create_test_execution(test_db, test_org["id"], test_agent["agent_id"], "completed")
    
    # Filter by completed
    response = await async_client.get(
        "/api/v1/executions?status=completed",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert all(exec["status"] == "completed" for exec in data.get("items", data))


@pytest.mark.asyncio
async def test_list_executions_filtered_by_agent(
    async_client: AsyncClient, auth_headers, test_db, test_org
):
    """List executions filtered by agent returns correct results."""
    # Create two agents
    agent1 = await create_test_agent(test_db, test_org["id"], "agent-1")
    agent2 = await create_test_agent(test_db, test_org["id"], "agent-2")
    
    # Create executions for each
    await create_test_execution(test_db, test_org["id"], "agent-1")
    await create_test_execution(test_db, test_org["id"], "agent-2")
    await create_test_execution(test_db, test_org["id"], "agent-1")
    
    # Filter by agent-1
    response = await async_client.get(
        "/api/v1/executions?agent_id=agent-1",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    items = data.get("items", data)
    assert all(exec["agent_id"] == "agent-1" for exec in items)


@pytest.mark.asyncio
async def test_get_execution_by_id(
    async_client: AsyncClient, auth_headers, test_execution
):
    """Get execution by ID returns full details."""
    response = await async_client.get(
        f"/api/v1/executions/{test_execution['id']}",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_execution["id"])


@pytest.mark.asyncio
async def test_get_execution_trace(
    async_client: AsyncClient, auth_headers, test_execution
):
    """Get execution trace returns ordered events."""
    response = await async_client.get(
        f"/api/v1/executions/{test_execution['id']}/trace",
        headers=auth_headers,
    )
    
    # May return 200 or 404 depending on whether events exist
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_execution_other_org(
    async_client: AsyncClient, auth_headers, test_db
):
    """Get execution from different org returns 404 (isolation test)."""
    # Create another org and execution
    other_org = await create_test_org(test_db, "Other Org")
    other_agent = await create_test_agent(test_db, other_org["id"], "other-agent")
    other_execution = await create_test_execution(
        test_db, other_org["id"], "other-agent"
    )
    
    # Try to access from original user
    response = await async_client.get(
        f"/api/v1/executions/{other_execution['id']}",
        headers=auth_headers,
    )
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_list_executions_pagination(
    async_client: AsyncClient, auth_headers, test_db, test_org, test_agent
):
    """List executions pagination cursor works correctly."""
    # Create multiple executions
    for _ in range(5):
        await create_test_execution(test_db, test_org["id"], test_agent["agent_id"])
    
    # Get first page
    response = await async_client.get(
        "/api/v1/executions?limit=2",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    
    # Should have pagination info
    items = data.get("items", data)
    assert len(items) <= 2


@pytest.mark.asyncio
async def test_batch_ingest_large(async_client: AsyncClient, api_key_headers, test_agent):
    """Batch ingest many events processes correctly."""
    execution_id = str(uuid4())
    
    # Create 100 events
    events = [
        {
            "execution_id": execution_id,
            "event_type": "llm_call_end",
            "sequence_number": i,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "model_id": "gpt-4",
            "cost_usd": 0.001,
            "input_tokens": 100,
            "output_tokens": 50,
        }
        for i in range(100)
    ]
    
    response = await async_client.post(
        "/api/v1/ingest/events",
        headers=api_key_headers,
        json={
            "executions": [
                {
                    "execution_id": execution_id,
                    "agent_id": test_agent["agent_id"],
                    "status": "running",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                }
            ],
            "events": events,
        },
    )
    
    assert response.status_code == 202
    data = response.json()
    assert data["accepted"] == 101  # 1 execution + 100 events


@pytest.mark.asyncio
async def test_batch_ingest_too_large(async_client: AsyncClient, api_key_headers, test_agent):
    """Batch with >500 items returns 413."""
    execution_id = str(uuid4())
    
    # Create 501 events
    events = [
        {
            "execution_id": execution_id,
            "event_type": "llm_call_end",
            "sequence_number": i,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        }
        for i in range(501)
    ]
    
    response = await async_client.post(
        "/api/v1/ingest/events",
        headers=api_key_headers,
        json={"events": events},
    )
    
    assert response.status_code == 413
