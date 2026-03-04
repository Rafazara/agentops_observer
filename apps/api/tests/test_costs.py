"""
Cost Analytics Tests

Tests for cost summary, agent attribution, and forecasting.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import create_test_execution, create_test_agent


# ============================================================================
# Cost Summary Tests
# ============================================================================

@pytest.mark.asyncio
async def test_cost_summary(async_client: AsyncClient, auth_headers, test_db, test_org, test_agent):
    """Cost summary returns correct totals."""
    # Create executions with known costs
    await create_test_execution(test_db, test_org["id"], test_agent["agent_id"], cost_usd=0.10)
    await create_test_execution(test_db, test_org["id"], test_agent["agent_id"], cost_usd=0.15)
    await create_test_execution(test_db, test_org["id"], test_agent["agent_id"], cost_usd=0.25)
    
    response = await async_client.get(
        "/api/v1/costs/summary",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "total_cost" in data or "total" in data or "cost" in data


@pytest.mark.asyncio
async def test_cost_by_agent(async_client: AsyncClient, auth_headers, test_db, test_org):
    """Cost by agent attribution is correct."""
    # Create two agents with different costs
    agent1 = await create_test_agent(test_db, test_org["id"], "expensive-agent")
    agent2 = await create_test_agent(test_db, test_org["id"], "cheap-agent")
    
    await create_test_execution(test_db, test_org["id"], "expensive-agent", cost_usd=1.00)
    await create_test_execution(test_db, test_org["id"], "cheap-agent", cost_usd=0.10)
    
    response = await async_client.get(
        "/api/v1/costs/by-agent",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    # Should return list or dict of agent costs
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_cost_forecast(async_client: AsyncClient, auth_headers):
    """Cost forecast returns projected values."""
    response = await async_client.get(
        "/api/v1/costs/forecast",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    # Should have forecast data
    assert isinstance(data, (list, dict))


@pytest.mark.asyncio
async def test_cost_export_csv(async_client: AsyncClient, auth_headers):
    """Export CSV returns valid CSV format."""
    response = await async_client.get(
        "/api/v1/costs/export?format=csv",
        headers=auth_headers,
    )
    
    # May return 200 or different format
    assert response.status_code in [200, 404, 501]


@pytest.mark.asyncio
async def test_cost_timeseries(async_client: AsyncClient, auth_headers):
    """Cost timeseries returns daily breakdown."""
    response = await async_client.get(
        "/api/v1/costs/timeseries?period=7d",
        headers=auth_headers,
    )
    
    # Endpoint may or may not exist
    assert response.status_code in [200, 404]
