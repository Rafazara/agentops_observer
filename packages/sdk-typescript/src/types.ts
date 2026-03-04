/**
 * AgentOps SDK Types
 * 
 * Type definitions for the AgentOps observability SDK.
 */

// ============================================================================
// Configuration
// ============================================================================

export interface AgentOpsConfig {
  /** API key for authentication (starts with agentops_sk_) */
  apiKey: string;
  
  /** API endpoint URL (default: https://api.agentops.observer) */
  endpoint?: string;
  
  /** Environment name */
  environment?: "production" | "staging" | "development" | string;
  
  /** Interval to flush events in milliseconds (default: 5000) */
  flushIntervalMs?: number;
  
  /** Maximum events to buffer before flush (default: 100) */
  maxBufferSize?: number;
  
  /** Enable automatic PII redaction (default: true) */
  piiRedaction?: boolean;
  
  /** Enable SDK (set to false to disable in tests) */
  enabled?: boolean;
  
  /** Debug mode - logs events to console */
  debug?: boolean;
  
  /** Custom tags to add to all executions */
  defaultTags?: string[];
}

// ============================================================================
// Execution
// ============================================================================

export interface ExecutionStartParams {
  /** Unique identifier for the agent */
  agentId: string;
  
  /** Project name/ID for grouping */
  project?: string;
  
  /** Agent version */
  version?: string;
  
  /** Environment */
  environment?: string;
  
  /** Input task/prompt */
  taskInput?: Record<string, unknown>;
  
  /** Custom tags */
  tags?: string[];
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ExecutionStatus {
  id: string;
  agentId: string;
  status: "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  llmCallCount: number;
  toolCallCount: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

// ============================================================================
// Events
// ============================================================================

export type EventType = 
  | "execution_start"
  | "execution_end"
  | "llm_call_start"
  | "llm_call_end"
  | "tool_call_start"
  | "tool_call_end"
  | "error"
  | "custom";

export interface BaseEvent {
  eventId?: string;
  executionId: string;
  eventType: EventType;
  sequenceNumber: number;
  occurredAt: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface LLMCallParams {
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  model: string;
  
  /** Provider name (e.g., 'openai', 'anthropic') */
  provider: string;
  
  /** Input messages */
  inputMessages: Message[];
  
  /** Output text/content */
  output: string;
  
  /** Number of input tokens */
  inputTokens: number;
  
  /** Number of output tokens */
  outputTokens: number;
  
  /** Thinking/reasoning tokens (for Claude/o1) */
  thinkingTokens?: number;
  
  /** Cost in USD (auto-calculated if not provided) */
  costUsd?: number;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Temperature setting */
  temperature?: number;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface ToolCallParams {
  /** Tool/function name */
  toolName: string;
  
  /** Input parameters */
  input: Record<string, unknown>;
  
  /** Output result */
  output: Record<string, unknown>;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Whether the call succeeded */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Observer Decorator
// ============================================================================

export interface ObserveParams {
  /** Agent ID for this function */
  agentId: string;
  
  /** Project name */
  project?: string;
  
  /** Agent version */
  version?: string;
  
  /** Custom tags */
  tags?: string[];
  
  /** Name override (defaults to function name) */
  name?: string;
}

// ============================================================================
// Integrations
// ============================================================================

export type Integration = "openai" | "anthropic" | "langchain";

export interface OpenAICallData {
  model: string;
  messages: Message[];
  response: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

// ============================================================================
// Callbacks (for LangChain)
// ============================================================================

export interface LangChainCallbackData {
  runId: string;
  parentRunId?: string;
  name: string;
  type: "llm" | "chain" | "tool" | "retriever";
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: Error;
}

// ============================================================================
// Errors
// ============================================================================

export class AgentOpsError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = "AgentOpsError";
  }
}

export class ConfigurationError extends AgentOpsError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
    this.name = "ConfigurationError";
  }
}

export class NetworkError extends AgentOpsError {
  constructor(message: string, cause?: Error) {
    super(message, "NETWORK_ERROR", cause);
    this.name = "NetworkError";
  }
}

export class ValidationError extends AgentOpsError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

// Aliases for backwards compatibility
export const AgentOpsConfigError = ConfigurationError;
export const AgentOpsNetworkError = NetworkError;
export const AgentOpsValidationError = ValidationError;
