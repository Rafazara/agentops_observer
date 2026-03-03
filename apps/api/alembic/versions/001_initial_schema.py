"""Initial schema - AgentOps Observer

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-03-02

This migration creates all core tables for AgentOps Observer:
- organizations, users, projects, agents
- agent_executions (time-series table)
- execution_events (time-series table)
- incidents, alert_rules, audit_logs
- Materialized views for agent hourly and project daily stats

Note: Compatible with standard PostgreSQL 15+ (Supabase free tier).
      No TimescaleDB extension required.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # =========================================================================
    # Note: No TimescaleDB extension needed - using standard PostgreSQL
    # =========================================================================
    
    # =========================================================================
    # Organizations
    # =========================================================================
    op.execute("""
        CREATE TABLE organizations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(100) NOT NULL UNIQUE,
            plan plan_type NOT NULL DEFAULT 'starter',
            settings JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX idx_organizations_slug ON organizations(slug);
    """)

    # =========================================================================
    # Users
    # =========================================================================
    op.execute("""
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255),
            role user_role NOT NULL DEFAULT 'developer',
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            last_login_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            UNIQUE(org_id, email)
        );
        
        CREATE INDEX idx_users_org_id ON users(org_id);
        CREATE INDEX idx_users_email ON users(email);
    """)

    # =========================================================================
    # API Keys
    # =========================================================================
    op.execute("""
        CREATE TABLE api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            key_prefix VARCHAR(20) NOT NULL,
            key_hash VARCHAR(255) NOT NULL,
            scopes TEXT[] NOT NULL DEFAULT '{"read", "write"}',
            last_used_at TIMESTAMPTZ,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            revoked_at TIMESTAMPTZ
        );
        
        CREATE INDEX idx_api_keys_org_id ON api_keys(org_id);
        CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
    """)

    # =========================================================================
    # Projects
    # =========================================================================
    op.execute("""
        CREATE TABLE projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            settings JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            
            UNIQUE(org_id, name)
        );
        
        CREATE INDEX idx_projects_org_id ON projects(org_id);
    """)

    # =========================================================================
    # Agents
    # =========================================================================
    op.execute("""
        CREATE TABLE agents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
            agent_id VARCHAR(255) NOT NULL,
            display_name VARCHAR(255),
            framework framework_type DEFAULT 'custom',
            current_version VARCHAR(100),
            tags TEXT[] NOT NULL DEFAULT '{}',
            metadata JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_execution_at TIMESTAMPTZ,
            
            UNIQUE(org_id, agent_id)
        );
        
        CREATE INDEX idx_agents_org_id ON agents(org_id);
        CREATE INDEX idx_agents_project_id ON agents(project_id);
        CREATE INDEX idx_agents_agent_id ON agents(agent_id);
        CREATE INDEX idx_agents_tags ON agents USING GIN(tags);
    """)

    # =========================================================================
    # Agent Executions (Time-series table with composite PK)
    # =========================================================================
    op.execute("""
        CREATE TABLE agent_executions (
            execution_id UUID NOT NULL DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL,
            agent_id VARCHAR(255) NOT NULL,
            project_id UUID,
            version VARCHAR(100),
            environment environment_type NOT NULL DEFAULT 'production',
            status execution_status NOT NULL DEFAULT 'running',
            
            -- Task data
            task_input JSONB,
            final_output JSONB,
            error_details JSONB,
            
            -- Quality scores
            quality_score DECIMAL(5,2),
            goal_completion_score DECIMAL(5,2),
            reasoning_coherence_score DECIMAL(5,2),
            tool_efficiency_score DECIMAL(5,2),
            
            -- Cost and token metrics
            total_cost_usd DECIMAL(12,8) DEFAULT 0,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            thinking_tokens INTEGER DEFAULT 0,
            total_tokens INTEGER DEFAULT 0,
            
            -- Counts
            llm_calls_count INTEGER DEFAULT 0,
            tool_calls_count INTEGER DEFAULT 0,
            
            -- Timing
            duration_ms INTEGER,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            
            -- Metadata
            metadata JSONB NOT NULL DEFAULT '{}',
            
            PRIMARY KEY (execution_id, started_at)
        );
        
        -- Create indexes
        CREATE INDEX idx_executions_org_id ON agent_executions(org_id, started_at DESC);
        CREATE INDEX idx_executions_agent_id ON agent_executions(agent_id, started_at DESC);
        CREATE INDEX idx_executions_project_id ON agent_executions(project_id, started_at DESC);
        CREATE INDEX idx_executions_status ON agent_executions(status, started_at DESC);
        CREATE INDEX idx_executions_environment ON agent_executions(environment, started_at DESC);
    """)

    # =========================================================================
    # Execution Events (Time-series table with composite PK)
    # =========================================================================
    op.execute("""
        CREATE TABLE execution_events (
            event_id UUID NOT NULL DEFAULT gen_random_uuid(),
            execution_id UUID NOT NULL,
            org_id UUID NOT NULL,
            
            -- Event classification
            event_type event_type NOT NULL,
            sequence_number INTEGER NOT NULL DEFAULT 0,
            
            -- Timing
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            duration_ms INTEGER,
            
            -- Cost and tokens
            cost_usd DECIMAL(12,8) DEFAULT 0,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            thinking_tokens INTEGER DEFAULT 0,
            
            -- LLM call data
            model_id VARCHAR(100),
            provider provider_type,
            temperature DECIMAL(3,2),
            llm_input JSONB,
            llm_output JSONB,
            
            -- Tool call data
            tool_name VARCHAR(255),
            tool_input JSONB,
            tool_output JSONB,
            
            -- Error data
            error JSONB,
            
            -- Metadata
            metadata JSONB NOT NULL DEFAULT '{}',
            
            PRIMARY KEY (event_id, occurred_at)
        );
        
        -- Create indexes
        CREATE INDEX idx_events_execution_id ON execution_events(execution_id, occurred_at);
        CREATE INDEX idx_events_org_id ON execution_events(org_id, occurred_at DESC);
        CREATE INDEX idx_events_event_type ON execution_events(event_type, occurred_at DESC);
        CREATE INDEX idx_events_model_id ON execution_events(model_id, occurred_at DESC)
            WHERE model_id IS NOT NULL;
    """)

    # =========================================================================
    # Incidents
    # =========================================================================
    op.execute("""
        CREATE TABLE incidents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            execution_id UUID,
            agent_id VARCHAR(255),
            
            incident_type VARCHAR(100) NOT NULL,
            severity incident_severity NOT NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            
            ai_analysis JSONB,
            affected_executions UUID[],
            
            detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            acknowledged_at TIMESTAMPTZ,
            acknowledged_by UUID REFERENCES users(id),
            resolved_at TIMESTAMPTZ,
            resolved_by UUID REFERENCES users(id),
            auto_resolved BOOLEAN DEFAULT FALSE,
            
            metadata JSONB NOT NULL DEFAULT '{}'
        );
        
        CREATE INDEX idx_incidents_org_id ON incidents(org_id, detected_at DESC);
        CREATE INDEX idx_incidents_agent_id ON incidents(agent_id, detected_at DESC);
        CREATE INDEX idx_incidents_severity ON incidents(severity, detected_at DESC);
        CREATE INDEX idx_incidents_resolved ON incidents(resolved_at) WHERE resolved_at IS NULL;
    """)

    # =========================================================================
    # Alert Rules
    # =========================================================================
    op.execute("""
        CREATE TABLE alert_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            
            name VARCHAR(255) NOT NULL,
            description TEXT,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            
            -- Rule definition
            condition JSONB NOT NULL,
            channels JSONB[] NOT NULL DEFAULT '{}',
            
            -- Throttling
            cooldown_minutes INTEGER NOT NULL DEFAULT 5,
            last_triggered_at TIMESTAMPTZ,
            trigger_count INTEGER DEFAULT 0,
            
            -- Ownership
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX idx_alert_rules_org_id ON alert_rules(org_id);
        CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled) WHERE enabled = TRUE;
    """)

    # =========================================================================
    # Audit Logs
    # =========================================================================
    op.execute("""
        CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id UUID NOT NULL,
            user_id UUID,
            
            action VARCHAR(100) NOT NULL,
            resource_type VARCHAR(100) NOT NULL,
            resource_id VARCHAR(255),
            
            changes JSONB,
            ip_address INET,
            user_agent TEXT,
            
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        -- Partition by month for efficient queries and retention
        CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id, occurred_at DESC);
        CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id, occurred_at DESC);
        CREATE INDEX idx_audit_logs_action ON audit_logs(action, occurred_at DESC);
        CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id, occurred_at DESC);
    """)

    # =========================================================================
    # Refresh Tokens
    # =========================================================================
    op.execute("""
        CREATE TABLE refresh_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(255) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            revoked_at TIMESTAMPTZ
        );
        
        CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
        CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
    """)

    # =========================================================================
    # Model Pricing (for cost calculation)
    # =========================================================================
    op.execute("""
        CREATE TABLE model_pricing (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider provider_type NOT NULL,
            model_id VARCHAR(100) NOT NULL,
            display_name VARCHAR(255),
            
            input_cost_per_million DECIMAL(12,6) NOT NULL,
            output_cost_per_million DECIMAL(12,6) NOT NULL,
            thinking_cost_per_million DECIMAL(12,6) DEFAULT 0,
            
            context_window INTEGER,
            max_output_tokens INTEGER,
            
            effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            effective_until TIMESTAMPTZ,
            
            UNIQUE(provider, model_id, effective_from)
        );
        
        CREATE INDEX idx_model_pricing_lookup ON model_pricing(provider, model_id, effective_from DESC);
    """)

    # =========================================================================
    # Materialized View: Agent Hourly Stats
    # =========================================================================
    op.execute("""
        CREATE MATERIALIZED VIEW agent_hourly_stats AS
        SELECT 
            agent_id,
            org_id,
            project_id,
            date_trunc('hour', started_at) AS hour,
            COUNT(*) AS total_executions,
            COUNT(*) FILTER (WHERE status = 'success') AS successful,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed,
            COUNT(*) FILTER (WHERE status = 'loop_detected') AS loops_detected,
            COUNT(*) FILTER (WHERE status = 'timeout') AS timeouts,
            AVG(quality_score) AS avg_quality,
            AVG(goal_completion_score) AS avg_goal_completion,
            AVG(reasoning_coherence_score) AS avg_reasoning_coherence,
            SUM(total_cost_usd) AS total_cost,
            SUM(total_tokens) AS total_tokens,
            SUM(input_tokens) AS total_input_tokens,
            SUM(output_tokens) AS total_output_tokens,
            AVG(duration_ms) AS avg_duration_ms,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_duration_ms,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_duration_ms,
            AVG(llm_calls_count) AS avg_llm_calls,
            AVG(tool_calls_count) AS avg_tool_calls
        FROM agent_executions
        GROUP BY agent_id, org_id, project_id, date_trunc('hour', started_at);
        
        CREATE UNIQUE INDEX idx_agent_hourly_stats_unique 
            ON agent_hourly_stats(agent_id, org_id, hour);
        CREATE INDEX idx_agent_hourly_stats_org 
            ON agent_hourly_stats(org_id, hour DESC);
    """)

    # =========================================================================
    # Materialized View: Project Daily Stats
    # =========================================================================
    op.execute("""
        CREATE MATERIALIZED VIEW project_daily_stats AS
        SELECT 
            org_id,
            COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID) AS project_id,
            date_trunc('day', started_at) AS day,
            COUNT(DISTINCT agent_id) AS active_agents,
            COUNT(*) AS total_executions,
            COUNT(*) FILTER (WHERE status = 'success') AS successful,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed,
            SUM(total_cost_usd) AS total_cost,
            SUM(total_tokens) AS total_tokens,
            AVG(quality_score) AS avg_quality
        FROM agent_executions
        GROUP BY org_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID), 
                 date_trunc('day', started_at);
        
        CREATE UNIQUE INDEX idx_project_daily_stats_unique 
            ON project_daily_stats(org_id, project_id, day);
    """)

    # =========================================================================
    # Seed Model Pricing Data
    # =========================================================================
    op.execute("""
        INSERT INTO model_pricing (provider, model_id, display_name, input_cost_per_million, output_cost_per_million, thinking_cost_per_million, context_window, max_output_tokens) VALUES
        -- OpenAI
        ('openai', 'gpt-4o', 'GPT-4o', 2.50, 10.00, 0, 128000, 16384),
        ('openai', 'gpt-4o-mini', 'GPT-4o Mini', 0.15, 0.60, 0, 128000, 16384),
        ('openai', 'gpt-4-turbo', 'GPT-4 Turbo', 10.00, 30.00, 0, 128000, 4096),
        ('openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 0.50, 1.50, 0, 16385, 4096),
        ('openai', 'o1', 'o1', 15.00, 60.00, 0, 200000, 100000),
        ('openai', 'o1-mini', 'o1 Mini', 3.00, 12.00, 0, 128000, 65536),
        
        -- Anthropic
        ('anthropic', 'claude-3-opus-20240229', 'Claude 3 Opus', 15.00, 75.00, 0, 200000, 4096),
        ('anthropic', 'claude-3-sonnet-20240229', 'Claude 3 Sonnet', 3.00, 15.00, 0, 200000, 4096),
        ('anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 3.00, 15.00, 0, 200000, 8192),
        ('anthropic', 'claude-3-haiku-20240307', 'Claude 3 Haiku', 0.25, 1.25, 0, 200000, 4096),
        ('anthropic', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 0.80, 4.00, 0, 200000, 8192),
        
        -- Google
        ('google', 'gemini-1.5-pro', 'Gemini 1.5 Pro', 1.25, 5.00, 0, 2000000, 8192),
        ('google', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 0.075, 0.30, 0, 1000000, 8192),
        ('google', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 0.10, 0.40, 0, 1000000, 8192),
        
        -- Mistral
        ('mistral', 'mistral-large-latest', 'Mistral Large', 2.00, 6.00, 0, 128000, 8192),
        ('mistral', 'mistral-small-latest', 'Mistral Small', 0.20, 0.60, 0, 32000, 8192),
        
        -- Groq
        ('groq', 'llama-3.1-70b-versatile', 'Llama 3.1 70B', 0.59, 0.79, 0, 131072, 8192),
        ('groq', 'llama-3.1-8b-instant', 'Llama 3.1 8B', 0.05, 0.08, 0, 131072, 8192),
        ('groq', 'mixtral-8x7b-32768', 'Mixtral 8x7B', 0.24, 0.24, 0, 32768, 8192);
    """)


def downgrade() -> None:
    # Drop materialized views first
    op.execute("DROP MATERIALIZED VIEW IF EXISTS project_daily_stats;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS agent_hourly_stats;")
    
    # Drop tables in reverse order of dependencies
    op.execute("DROP TABLE IF EXISTS model_pricing;")
    op.execute("DROP TABLE IF EXISTS refresh_tokens;")
    op.execute("DROP TABLE IF EXISTS audit_logs;")
    op.execute("DROP TABLE IF EXISTS alert_rules;")
    op.execute("DROP TABLE IF EXISTS incidents;")
    op.execute("DROP TABLE IF EXISTS execution_events;")
    op.execute("DROP TABLE IF EXISTS agent_executions;")
    op.execute("DROP TABLE IF EXISTS agents;")
    op.execute("DROP TABLE IF EXISTS projects;")
    op.execute("DROP TABLE IF EXISTS api_keys;")
    op.execute("DROP TABLE IF EXISTS users;")
    op.execute("DROP TABLE IF EXISTS organizations;")
