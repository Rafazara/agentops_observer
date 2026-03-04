"""
Pytest Configuration and Fixtures

Provides test fixtures for database, client, authentication, and factories.
"""

import asyncio
import os
from datetime import datetime, timezone
from typing import AsyncGenerator, Generator
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# Set test environment before importing app
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://test:test@localhost:5432/agentops_test"
)
os.environ["REDIS_URL"] = os.getenv("REDIS_URL", "redis://localhost:6379/0")
os.environ["SECRET_KEY"] = "test-secret-key-32-chars-minimum!!"

from app.main import app
from app.core.database import db, Database
from app.core.cache import cache
from app.core.security import hash_password, create_access_token, generate_api_key


# ============================================================================
# Event Loop Configuration
# ============================================================================

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ============================================================================
# Database Fixtures
# ============================================================================

@pytest_asyncio.fixture(scope="session")
async def test_db() -> AsyncGenerator[Database, None]:
    """Create test database connection."""
    await db.connect()
    yield db
    await db.disconnect()


@pytest_asyncio.fixture(autouse=True)
async def cleanup_db(test_db: Database):
    """Clean up database after each test."""
    yield
    # Clean up in reverse dependency order
    await test_db.execute("DELETE FROM events")
    await test_db.execute("DELETE FROM executions")
    await test_db.execute("DELETE FROM refresh_tokens")
    await test_db.execute("DELETE FROM api_keys")
    await test_db.execute("DELETE FROM incidents")
    await test_db.execute("DELETE FROM alerts")
    await test_db.execute("DELETE FROM users")
    await test_db.execute("DELETE FROM organizations")


@pytest_asyncio.fixture(scope="session")
async def test_cache():
    """Create test cache connection."""
    await cache.connect()
    yield cache
    await cache.disconnect()


# ============================================================================
# Client Fixtures
# ============================================================================

@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create sync test client."""
    with TestClient(app) as c:
        yield c


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create async test client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ============================================================================
# Factory Functions
# ============================================================================

async def create_test_org(database: Database, name: str = "Test Org") -> dict:
    """Create a test organization."""
    slug = f"test-{uuid4().hex[:8]}"
    org = await database.fetch_one(
        """
        INSERT INTO organizations (name, slug, plan)
        VALUES ($1, $2, 'starter')
        RETURNING id, name, slug, plan, created_at
        """,
        name,
        slug,
    )
    return dict(org)


async def create_test_user(
    database: Database,
    org_id: UUID,
    email: str = None,
    password: str = "TestPassword123",
    role: str = "owner",
) -> dict:
    """Create a test user."""
    if email is None:
        email = f"test-{uuid4().hex[:8]}@test.com"
    
    password_hash = hash_password(password)
    user = await database.fetch_one(
        """
        INSERT INTO users (org_id, email, name, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, email, name, role, is_active, created_at
        """,
        org_id,
        email,
        "Test User",
        password_hash,
        role,
    )
    result = dict(user)
    result["password"] = password
    return result


async def create_test_api_key(
    database: Database,
    org_id: UUID,
    user_id: UUID,
    scopes: list[str] = None,
) -> dict:
    """Create a test API key."""
    if scopes is None:
        scopes = ["read", "write"]
    
    full_key, prefix, key_hash = generate_api_key()
    
    key = await database.fetch_one(
        """
        INSERT INTO api_keys (org_id, user_id, name, key_prefix, key_hash, scopes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, org_id, user_id, name, key_prefix, scopes, created_at
        """,
        org_id,
        user_id,
        "Test Key",
        prefix,
        key_hash,
        scopes,
    )
    result = dict(key)
    result["key"] = full_key
    return result


async def create_test_agent(
    database: Database,
    org_id: UUID,
    agent_id: str = None,
) -> dict:
    """Create a test agent."""
    if agent_id is None:
        agent_id = f"test-agent-{uuid4().hex[:8]}"
    
    agent = await database.fetch_one(
        """
        INSERT INTO agents (org_id, agent_id, name, version, description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (org_id, agent_id) DO UPDATE SET updated_at = NOW()
        RETURNING id, org_id, agent_id, name, version, created_at
        """,
        org_id,
        agent_id,
        agent_id,
        "1.0.0",
        "Test agent",
    )
    return dict(agent)


async def create_test_execution(
    database: Database,
    org_id: UUID,
    agent_id: str,
    status: str = "completed",
    cost_usd: float = 0.05,
) -> dict:
    """Create a test execution."""
    execution = await database.fetch_one(
        """
        INSERT INTO executions (
            org_id, agent_id, status, started_at, completed_at,
            total_cost_usd, total_input_tokens, total_output_tokens,
            llm_call_count, tool_call_count
        )
        VALUES ($1, $2, $3, NOW() - INTERVAL '5 minutes', NOW(), $4, 1000, 500, 3, 2)
        RETURNING *
        """,
        org_id,
        agent_id,
        status,
        cost_usd,
    )
    return dict(execution)


async def create_test_incident(
    database: Database,
    org_id: UUID,
    execution_id: UUID = None,
    severity: str = "high",
) -> dict:
    """Create a test incident."""
    incident = await database.fetch_one(
        """
        INSERT INTO incidents (org_id, execution_id, severity, type, title, description)
        VALUES ($1, $2, $3, 'anomaly', 'Test Incident', 'Test description')
        RETURNING *
        """,
        org_id,
        execution_id,
        severity,
    )
    return dict(incident)


# ============================================================================
# Authentication Fixtures
# ============================================================================

@pytest_asyncio.fixture
async def test_org(test_db: Database) -> dict:
    """Create a test organization."""
    return await create_test_org(test_db)


@pytest_asyncio.fixture
async def test_user(test_db: Database, test_org: dict) -> dict:
    """Create a test user with organization."""
    user = await create_test_user(test_db, test_org["id"])
    user["org"] = test_org
    return user


@pytest_asyncio.fixture
async def test_api_key(test_db: Database, test_user: dict) -> dict:
    """Create a test API key."""
    return await create_test_api_key(
        test_db, 
        test_user["org_id"], 
        test_user["id"]
    )


@pytest_asyncio.fixture
def auth_headers(test_user: dict) -> dict:
    """Create authentication headers with valid JWT."""
    token = create_access_token({"sub": str(test_user["id"])})
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
def api_key_headers(test_api_key: dict) -> dict:
    """Create authentication headers with API key."""
    return {"X-API-Key": test_api_key["key"]}


# ============================================================================
# Test Data Fixtures
# ============================================================================

@pytest_asyncio.fixture
async def test_agent(test_db: Database, test_org: dict) -> dict:
    """Create a test agent."""
    return await create_test_agent(test_db, test_org["id"])


@pytest_asyncio.fixture
async def test_execution(test_db: Database, test_org: dict, test_agent: dict) -> dict:
    """Create a test execution."""
    return await create_test_execution(
        test_db, 
        test_org["id"], 
        test_agent["agent_id"]
    )


@pytest_asyncio.fixture
async def test_incident(test_db: Database, test_org: dict, test_execution: dict) -> dict:
    """Create a test incident."""
    return await create_test_incident(
        test_db,
        test_org["id"],
        test_execution["id"],
    )
