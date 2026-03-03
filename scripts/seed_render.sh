#!/bin/bash
# =============================================================================
# AgentOps Observer - Database Seed Script for Render/Supabase
# =============================================================================
#
# This script seeds the Supabase PostgreSQL database with:
# 1. Required ENUM types
# 2. Database schema (via Alembic migrations)
# 3. Demo data (optional)
#
# Prerequisites:
# - psql client installed
# - Supabase project created
# - Database connection string available
#
# Usage:
#   ./scripts/seed_render.sh
#
# Environment Variables (set these before running):
#   DATABASE_URL - Supabase connection string
#                  Format: postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
#
# =============================================================================

set -e  # Exit on any error

echo "========================================"
echo "AgentOps Observer - Database Setup"
echo "========================================"
echo ""

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set it to your Supabase connection string:"
    echo "  export DATABASE_URL='postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres'"
    echo ""
    echo "You can find this in Supabase Dashboard → Settings → Database → Connection string"
    exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Navigate to API directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$SCRIPT_DIR/../apps/api"

if [ ! -d "$API_DIR" ]; then
    echo "ERROR: API directory not found at $API_DIR"
    exit 1
fi

cd "$API_DIR"
echo "✓ Changed to API directory: $API_DIR"
echo ""

# Check if alembic is available
if ! command -v alembic &> /dev/null; then
    echo "Installing Python dependencies..."
    pip install -e . > /dev/null 2>&1
fi

echo "----------------------------------------"
echo "Step 1: Creating ENUM types"
echo "----------------------------------------"

# Create ENUM types (if they don't exist)
psql "$DATABASE_URL" << 'ENUMS'
DO $$ BEGIN
    CREATE TYPE plan_type AS ENUM ('starter', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE environment_type AS ENUM ('development', 'staging', 'production');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE execution_status AS ENUM ('running', 'success', 'failed', 'loop_detected', 'timeout', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE event_type AS ENUM ('llm_call', 'tool_call', 'reasoning', 'decision', 'error', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE provider_type AS ENUM ('openai', 'anthropic', 'google', 'mistral', 'cohere', 'groq', 'bedrock', 'azure', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE alert_condition_type AS ENUM ('threshold', 'anomaly', 'pattern');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'user_login', 'user_logout', 'api_key_created', 'api_key_revoked',
        'project_created', 'project_updated', 'project_deleted',
        'agent_registered', 'alert_created', 'alert_updated', 'alert_deleted',
        'settings_updated', 'member_invited', 'member_removed', 'role_changed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
ENUMS

echo "✓ ENUM types created/verified"
echo ""

echo "----------------------------------------"
echo "Step 2: Running Alembic migrations"
echo "----------------------------------------"

# Set environment for Alembic
export POSTGRES_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
export POSTGRES_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
export POSTGRES_DB=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
export POSTGRES_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
export POSTGRES_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Run migrations
alembic upgrade head

echo "✓ Migrations completed"
echo ""

echo "----------------------------------------"
echo "Step 3: Creating demo organization"
echo "----------------------------------------"

# Create demo organization and user for testing
psql "$DATABASE_URL" << 'DEMO_DATA'
-- Insert demo organization (if not exists)
INSERT INTO organizations (id, name, slug, plan)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Demo Organization',
    'demo',
    'starter'
)
ON CONFLICT (slug) DO NOTHING;

-- Insert demo user (if not exists)
-- Password: demo123 (bcrypt hashed)
INSERT INTO users (id, org_id, email, password_hash, name, role, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'demo@agentops.observer',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X0.nK5gHvJvSWq9Wy',
    'Demo User',
    'owner',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Insert demo API key (if not exists)
INSERT INTO api_keys (id, org_id, created_by, name, key_hash, key_prefix, scopes)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'Demo API Key',
    '$2b$12$demokeyhash000000000000000000000000000000000000000000',
    'ao_demo',
    ARRAY['agent:write', 'execution:write', 'read']
)
ON CONFLICT DO NOTHING;

-- Insert demo project (if not exists)
INSERT INTO projects (id, org_id, name, slug, description)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Demo Project',
    'demo-project',
    'A sample project for testing AgentOps Observer'
)
ON CONFLICT (org_id, slug) DO NOTHING;
DEMO_DATA

echo "✓ Demo data created"
echo ""

echo "========================================"
echo "Database setup complete!"
echo "========================================"
echo ""
echo "Demo credentials:"
echo "  Email:    demo@agentops.observer"
echo "  Password: demo123"
echo ""
echo "Next steps:"
echo "  1. Deploy your API to Render.com"
echo "  2. Set environment variables in Render Dashboard"
echo "  3. Test login at your frontend URL"
echo ""
