/**
 * API Types - matches backend Pydantic models
 */

// ============================================================================
// Common Types
// ============================================================================

export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type EnvironmentType = "development" | "staging" | "production";
export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type UserRole = "owner" | "admin" | "member" | "viewer";

export interface PaginatedResponse<T> {
  data: T[];
  next_cursor?: string | null;
  has_more: boolean;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organization_name: string;
  organization_slug: string;
}

export interface RegisterResponse {
  user_id: string;
  org_id: string;
  email: string;
  name: string;
  organization_name: string;
  organization_slug: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  org_id: string;
  organization_name: string;
  organization_slug: string;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string; // Full key - only shown once
  key_prefix: string;
  scopes: string[];
  expires_at?: string;
  created_at: string;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionSummary {
  execution_id: string;
  agent_id: string;
  project_id?: string;
  version?: string;
  environment: EnvironmentType;
  status: ExecutionStatus;
  quality_score?: number;
  total_cost_usd: number;
  total_tokens: number;
  duration_ms: number;
  started_at: string;
  completed_at?: string;
  llm_calls_count: number;
  tool_calls_count: number;
}

export interface Execution extends ExecutionSummary {
  org_id: string;
  trigger?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionEvent {
  id: string;
  execution_id: string;
  org_id: string;
  event_type: string;
  sequence_number: number;
  parent_event_id?: string;
  name?: string;
  model_id?: string;
  provider?: string;
  input_text?: string;
  output_text?: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  duration_ms?: number;
  status: string;
  error?: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurred_at: string;
  completed_at?: string;
}

export interface ExecutionWithTrace extends Execution {
  events: ExecutionEvent[];
}

export interface ExecutionStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  running_executions: number;
  success_rate: number;
  total_cost_usd: number;
  total_tokens: number;
  avg_duration_ms: number;
  avg_quality_score: number;
  p95_latency_ms: number;
  executions_by_status: Record<ExecutionStatus, number>;
  executions_by_environment: Record<EnvironmentType, number>;
  hourly_executions: Array<{ hour: string; count: number; cost: number }>;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface Agent {
  id: string;
  org_id: string;
  agent_id: string;
  name: string;
  description?: string;
  current_version?: string;
  environment: EnvironmentType;
  is_active: boolean;
  last_execution_at?: string;
  total_executions: number;
  success_rate: number;
  avg_cost_per_execution: number;
  created_at: string;
  updated_at: string;
}

export interface AgentMetrics {
  agent_id: string;
  period: string;
  execution_count: number;
  success_rate: number;
  avg_duration_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  quality_score_avg: number;
}

// ============================================================================
// Cost Types
// ============================================================================

export interface CostSummary {
  total_cost: number;
  total_tokens: number;
  execution_count: number;
  cost_change_percent: number;
  by_model: Array<{
    model_id: string;
    provider: string;
    cost: number;
    input_tokens: number;
    output_tokens: number;
    call_count: number;
  }>;
  by_agent: Array<{
    agent_id: string;
    cost: number;
    execution_count: number;
  }>;
  daily: Array<{
    date: string;
    cost: number;
    tokens: number;
    executions: number;
  }>;
}

export interface CostForecast {
  current_daily_avg: number;
  projected_monthly: number;
  trend_percent: number;
  daily_forecast: Array<{
    date: string;
    projected_cost: number;
    confidence_low: number;
    confidence_high: number;
  }>;
}

// ============================================================================
// Incident Types
// ============================================================================

export interface Incident {
  id: string;
  org_id: string;
  incident_type: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  agent_id?: string;
  execution_ids?: string[];
  detected_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  impact_summary?: string;
  created_at: string;
  updated_at: string;
}

export interface IncidentStats {
  total: number;
  open_count: number;
  acknowledged_count: number;
  resolved_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  avg_acknowledge_seconds?: number;
  avg_resolve_seconds?: number;
}

export interface IncidentTimeline {
  incident: Incident;
  executions: Execution[];
  events: ExecutionEvent[];
}

// ============================================================================
// Alert Types
// ============================================================================

export interface AlertRule {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  severity: IncidentSeverity;
  conditions: Record<string, unknown>;
  agent_filter?: string[];
  project_filter?: string[];
  channels: string[];
  enabled: boolean;
  last_triggered_at?: string;
  trigger_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AlertRuleCreate {
  name: string;
  description?: string;
  severity: IncidentSeverity;
  conditions: Record<string, unknown>;
  agent_filter?: string[];
  project_filter?: string[];
  channels: string[];
  enabled: boolean;
}

// ============================================================================
// Compliance Types
// ============================================================================

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  actor_id: string;
  actor_email?: string;
  ip_address?: string;
  user_agent?: string;
  changes?: Record<string, unknown>;
  occurred_at: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  has_more: boolean;
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WSMessage {
  type: "execution_started" | "execution_completed" | "execution_failed" | "incident_created" | "cost_update" | "ping";
  data: unknown;
  timestamp: string;
}

export interface WSExecutionEvent {
  execution_id: string;
  agent_id: string;
  status: ExecutionStatus;
  cost_usd?: number;
  duration_ms?: number;
}

export interface WSIncidentEvent {
  incident_id: string;
  severity: IncidentSeverity;
  title: string;
  agent_id?: string;
}
