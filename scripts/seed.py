#!/usr/bin/env python3
"""
Seed script for AgentOps Observer demo data.

This script populates the database with realistic demo data
for testing and demonstration purposes.

Usage:
    python scripts/seed.py
    
    # With custom database URL
    DATABASE_URL=postgresql://... python scripts/seed.py
"""

import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import asyncpg

# Configuration
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/agentops"
)

# Demo data configuration
NUM_ORGANIZATIONS = 2
NUM_USERS_PER_ORG = 3
NUM_AGENTS_PER_ORG = 5
NUM_EXECUTIONS_PER_AGENT = 50
NUM_EVENTS_PER_EXECUTION = (3, 15)
NUM_INCIDENTS = 10
NUM_ALERT_RULES = 5


# Sample data
AGENT_TEMPLATES = [
    {
        "name": "Customer Support Bot",
        "description": "Handles customer inquiries and support tickets via chat",
        "config": {"model": "gpt-4o", "max_tokens": 1024, "temperature": 0.7},
    },
    {
        "name": "Data Analysis Agent",
        "description": "Analyzes datasets and generates insights and reports",
        "config": {"model": "gpt-4o", "max_tokens": 4096, "temperature": 0.3},
    },
    {
        "name": "Code Review Bot",
        "description": "Reviews pull requests and suggests code improvements",
        "config": {"model": "claude-3-opus", "max_tokens": 2048, "temperature": 0.2},
    },
    {
        "name": "Email Assistant",
        "description": "Drafts and manages email responses",
        "config": {"model": "gpt-4o-mini", "max_tokens": 512, "temperature": 0.5},
    },
    {
        "name": "Research Agent",
        "description": "Researches topics and compiles comprehensive reports",
        "config": {"model": "claude-3-opus", "max_tokens": 8192, "temperature": 0.4},
    },
    {
        "name": "Sales Assistant",
        "description": "Assists with sales outreach and lead qualification",
        "config": {"model": "gpt-4o", "max_tokens": 1024, "temperature": 0.6},
    },
    {
        "name": "Document Processor",
        "description": "Extracts and processes information from documents",
        "config": {"model": "gpt-4o-mini", "max_tokens": 2048, "temperature": 0.1},
    },
]

MODELS = [
    ("gpt-4o", "openai", 0.005, 0.015),
    ("gpt-4o-mini", "openai", 0.00015, 0.0006),
    ("gpt-3.5-turbo", "openai", 0.0005, 0.0015),
    ("claude-3-opus", "anthropic", 0.015, 0.075),
    ("claude-3-sonnet", "anthropic", 0.003, 0.015),
    ("claude-3-haiku", "anthropic", 0.00025, 0.00125),
]

TRIGGERS = ["api", "schedule", "webhook", "manual"]
STATUSES = ["pending", "running", "completed", "failed"]
INCIDENT_SEVERITIES = ["critical", "high", "medium", "low"]
INCIDENT_TITLES = [
    "High error rate detected",
    "Latency spike on {agent}",
    "Cost threshold exceeded",
    "Authentication failures",
    "Rate limit reached",
    "Loop detected in {agent}",
    "Timeout errors increasing",
    "Memory usage anomaly",
    "API response errors",
    "Token quota warning",
]


async def create_pool() -> asyncpg.Pool:
    """Create database connection pool."""
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    
    # Extract host for safe logging (hide credentials)
    try:
        db_host = DATABASE_URL.split("@")[1].split("/")[0]
        print(f"Connecting to: {db_host}")
    except Exception:
        print("Connecting to database...")
    
    return await asyncpg.create_pool(
        DATABASE_URL,
        ssl=True,
        min_size=2,
        max_size=10,
    )


async def seed_organizations(conn: asyncpg.Connection) -> list[uuid.UUID]:
    """Seed organizations."""
    print("Seeding organizations...")
    org_ids = []
    
    for i in range(NUM_ORGANIZATIONS):
        org_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO organizations (id, name, plan, settings, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            org_id,
            f"Demo Organization {i + 1}",
            "enterprise" if i == 0 else "pro",
            {"timezone": "UTC", "notifications_enabled": True},
        )
        org_ids.append(org_id)
    
    print(f"  Created {len(org_ids)} organizations")
    return org_ids


async def seed_users(conn: asyncpg.Connection, org_ids: list[uuid.UUID]) -> list[uuid.UUID]:
    """Seed users."""
    print("Seeding users...")
    user_ids = []
    
    # Password hash for "password123"
    password_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYx6SUxPLEqKAk9kFzPQk4EI11K2.Z3K"
    
    for i, org_id in enumerate(org_ids):
        for j in range(NUM_USERS_PER_ORG):
            user_id = uuid.uuid4()
            role = "admin" if j == 0 else "member"
            
            await conn.execute(
                """
                INSERT INTO users (id, organization_id, email, password_hash, name, role, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (email) DO NOTHING
                """,
                user_id,
                org_id,
                f"user{i * NUM_USERS_PER_ORG + j + 1}@demo.agentops.ai",
                password_hash,
                f"Demo User {i * NUM_USERS_PER_ORG + j + 1}",
                role,
            )
            user_ids.append(user_id)
    
    print(f"  Created {len(user_ids)} users")
    return user_ids


async def seed_api_keys(conn: asyncpg.Connection, org_ids: list[uuid.UUID]) -> None:
    """Seed API keys."""
    print("Seeding API keys...")
    
    for org_id in org_ids:
        await conn.execute(
            """
            INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, scopes, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (id) DO NOTHING
            """,
            uuid.uuid4(),
            org_id,
            "Demo API Key",
            "demo_key_hash_" + str(org_id)[:8],
            "agops_" + str(org_id)[:8],
            ["read", "write", "admin"],
        )


async def seed_agents(conn: asyncpg.Connection, org_ids: list[uuid.UUID]) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """Seed agents."""
    print("Seeding agents...")
    agents = []
    
    for org_id in org_ids:
        selected_templates = random.sample(
            AGENT_TEMPLATES,
            min(NUM_AGENTS_PER_ORG, len(AGENT_TEMPLATES))
        )
        
        for template in selected_templates:
            agent_id = uuid.uuid4()
            version = f"{random.randint(1, 3)}.{random.randint(0, 9)}.{random.randint(0, 9)}"
            
            await conn.execute(
                """
                INSERT INTO agents (id, organization_id, name, description, version, config, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                agent_id,
                org_id,
                template["name"],
                template["description"],
                version,
                template["config"],
                random.random() > 0.1,  # 90% active
            )
            agents.append((agent_id, org_id))
    
    print(f"  Created {len(agents)} agents")
    return agents


async def seed_executions_and_events(
    conn: asyncpg.Connection,
    agents: list[tuple[uuid.UUID, uuid.UUID]],
) -> None:
    """Seed executions and events."""
    print("Seeding executions and events...")
    
    total_executions = 0
    total_events = 0
    now = datetime.now(timezone.utc)
    
    for agent_id, org_id in agents:
        for _ in range(NUM_EXECUTIONS_PER_AGENT):
            # Random start time in the last 7 days
            started_at = now - timedelta(
                days=random.uniform(0, 7),
                hours=random.uniform(0, 24),
            )
            
            # Determine status and duration
            status = random.choices(
                STATUSES,
                weights=[0.02, 0.03, 0.85, 0.10],  # mostly completed
            )[0]
            
            duration_ms = random.randint(500, 120000)
            ended_at = started_at + timedelta(milliseconds=duration_ms) if status in ["completed", "failed"] else None
            
            execution_id = uuid.uuid4()
            
            # Track totals
            llm_calls = 0
            tool_calls = 0
            total_tokens = 0
            total_cost = 0.0
            
            # Generate events
            num_events = random.randint(*NUM_EVENTS_PER_EXECUTION)
            event_time = started_at
            
            for event_idx in range(num_events):
                event_id = uuid.uuid4()
                event_time += timedelta(milliseconds=random.randint(100, 5000))
                
                # Select event type
                event_type = random.choices(
                    ["llm_call", "tool_call", "custom"],
                    weights=[0.6, 0.3, 0.1],
                )[0]
                
                model = None
                provider = None
                input_tokens = None
                output_tokens = None
                event_duration = random.randint(50, 5000)
                cost_usd = None
                
                if event_type == "llm_call":
                    llm_calls += 1
                    model_info = random.choice(MODELS)
                    model = model_info[0]
                    provider = model_info[1]
                    input_tokens = random.randint(100, 2000)
                    output_tokens = random.randint(50, 1000)
                    cost_usd = (input_tokens * model_info[2] / 1000) + (output_tokens * model_info[3] / 1000)
                    total_tokens += input_tokens + output_tokens
                    total_cost += cost_usd
                elif event_type == "tool_call":
                    tool_calls += 1
                
                await conn.execute(
                    """
                    INSERT INTO events (
                        id, execution_id, event_type, timestamp, data,
                        model, provider, input_tokens, output_tokens, duration_ms, cost_usd
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    event_id,
                    execution_id,
                    event_type,
                    event_time,
                    {"event_index": event_idx},
                    model,
                    provider,
                    input_tokens,
                    output_tokens,
                    event_duration,
                    cost_usd,
                )
                total_events += 1
            
            # Add error event for failed executions
            error = None
            if status == "failed":
                error = random.choice([
                    "Rate limit exceeded",
                    "Timeout waiting for response",
                    "Invalid API response",
                    "Authentication failed",
                    "Context length exceeded",
                ])
            
            # Insert execution
            await conn.execute(
                """
                INSERT INTO executions (
                    id, agent_id, organization_id, status, trigger,
                    input, output, error, started_at, ended_at,
                    llm_calls, tool_calls, total_tokens, total_cost_usd
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (id) DO NOTHING
                """,
                execution_id,
                agent_id,
                org_id,
                status,
                random.choice(TRIGGERS),
                {"prompt": "Demo input"},
                {"response": "Demo output"} if status == "completed" else None,
                error,
                started_at,
                ended_at,
                llm_calls,
                tool_calls,
                total_tokens,
                total_cost,
            )
            total_executions += 1
    
    print(f"  Created {total_executions} executions")
    print(f"  Created {total_events} events")


async def seed_incidents(
    conn: asyncpg.Connection,
    agents: list[tuple[uuid.UUID, uuid.UUID]],
) -> None:
    """Seed incidents."""
    print("Seeding incidents...")
    
    now = datetime.now(timezone.utc)
    org_agents = {}
    for agent_id, org_id in agents:
        org_agents.setdefault(org_id, []).append(agent_id)
    
    for i in range(NUM_INCIDENTS):
        org_id = random.choice(list(org_agents.keys()))
        affected = random.sample(org_agents[org_id], min(2, len(org_agents[org_id])))
        
        created_at = now - timedelta(days=random.uniform(0, 30))
        severity = random.choice(INCIDENT_SEVERITIES)
        
        # Determine status and times
        status = random.choices(
            ["open", "acknowledged", "resolved"],
            weights=[0.1, 0.1, 0.8],
        )[0]
        
        acknowledged_at = None
        resolved_at = None
        
        if status in ["acknowledged", "resolved"]:
            acknowledged_at = created_at + timedelta(minutes=random.uniform(1, 30))
        if status == "resolved":
            resolved_at = acknowledged_at + timedelta(minutes=random.uniform(10, 120))
        
        title = random.choice(INCIDENT_TITLES).replace("{agent}", "Agent")
        
        await conn.execute(
            """
            INSERT INTO incidents (
                id, organization_id, title, description, severity, status,
                affected_agents, root_cause, resolution,
                created_at, acknowledged_at, resolved_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING
            """,
            uuid.uuid4(),
            org_id,
            title,
            f"Automated incident detected: {title}",
            severity,
            status,
            [str(a) for a in affected],
            "Identified via automated monitoring" if status != "open" else None,
            "Applied mitigation and monitoring" if status == "resolved" else None,
            created_at,
            acknowledged_at,
            resolved_at,
        )
    
    print(f"  Created {NUM_INCIDENTS} incidents")


async def seed_alert_rules(
    conn: asyncpg.Connection,
    org_ids: list[uuid.UUID],
) -> None:
    """Seed alert rules."""
    print("Seeding alert rules...")
    
    rules = [
        {
            "name": "High Error Rate",
            "conditions": {"metric": "error_rate", "operator": ">=", "threshold": 10, "window_minutes": 5},
        },
        {
            "name": "Latency Spike",
            "conditions": {"metric": "latency_p99", "operator": ">=", "threshold": 30000, "window_minutes": 10},
        },
        {
            "name": "Cost Budget Alert",
            "conditions": {"metric": "cost_per_hour", "operator": ">=", "threshold": 50, "window_minutes": 60},
        },
        {
            "name": "Low Success Rate",
            "conditions": {"metric": "success_rate", "operator": "<", "threshold": 90, "window_minutes": 15},
        },
        {
            "name": "High Token Usage",
            "conditions": {"metric": "token_usage", "operator": ">=", "threshold": 100000, "window_minutes": 60},
        },
    ]
    
    for org_id in org_ids:
        for rule in rules[:NUM_ALERT_RULES]:
            await conn.execute(
                """
                INSERT INTO alert_rules (
                    id, organization_id, name, conditions, actions,
                    is_enabled, cooldown_minutes, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                uuid.uuid4(),
                org_id,
                rule["name"],
                rule["conditions"],
                {"slack_webhook": True, "email": True},
                True,
                5,
            )
    
    print(f"  Created {NUM_ALERT_RULES * len(org_ids)} alert rules")


async def main():
    """Main seed function."""
    print("=" * 60)
    print("AgentOps Observer - Seed Script")
    print("=" * 60)
    print(f"Database: {DATABASE_URL}")
    print()
    
    pool = await create_pool()
    
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Seed in order
            org_ids = await seed_organizations(conn)
            await seed_users(conn, org_ids)
            await seed_api_keys(conn, org_ids)
            agents = await seed_agents(conn, org_ids)
            await seed_executions_and_events(conn, agents)
            await seed_incidents(conn, agents)
            await seed_alert_rules(conn, org_ids)
    
    await pool.close()
    
    print()
    print("=" * 60)
    print("Seed completed successfully!")
    print("=" * 60)
    print()
    print("Demo login credentials:")
    print("  Email: user1@demo.agentops.ai")
    print("  Password: password123")
    print()


if __name__ == "__main__":
    asyncio.run(main())
