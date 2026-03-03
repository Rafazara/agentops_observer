-- AgentOps Observer - Database Initialization
-- This script runs on first database startup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create custom types
DO $$ BEGIN
    CREATE TYPE environment_type AS ENUM ('production', 'staging', 'development');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE execution_status AS ENUM (
        'running', 
        'success', 
        'failed', 
        'loop_detected', 
        'timeout', 
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_type AS ENUM (
        'llm_call',
        'tool_call', 
        'memory_read', 
        'memory_write',
        'planning_step', 
        'subagent_call', 
        'error', 
        'checkpoint',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_severity AS ENUM (
        'critical', 
        'high', 
        'warning', 
        'info'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'owner', 
        'admin', 
        'developer', 
        'viewer'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE plan_type AS ENUM (
        'starter',
        'growth', 
        'professional', 
        'enterprise'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE framework_type AS ENUM (
        'langchain',
        'autogen',
        'crewai',
        'semantic_kernel',
        'openai_assistants',
        'anthropic_tools',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE provider_type AS ENUM (
        'openai',
        'anthropic',
        'google',
        'azure_openai',
        'aws_bedrock',
        'cohere',
        'mistral',
        'together',
        'groq',
        'local',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Grant privileges to application user
GRANT ALL PRIVILEGES ON DATABASE agentops TO agentops;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO agentops;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO agentops;
GRANT USAGE ON SCHEMA public TO agentops;

-- Log initialization complete
DO $$
BEGIN
    RAISE NOTICE 'AgentOps Observer database initialized successfully';
END $$;
