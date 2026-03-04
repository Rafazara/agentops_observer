/**
 * @agentops/sdk
 * 
 * TypeScript SDK for AgentOps Observer - Unified AI Agent Observability Platform
 * 
 * @example
 * ```typescript
 * import AgentOps from "@agentops/sdk";
 * 
 * // Initialize the SDK
 * AgentOps.init({
 *   apiKey: process.env.AGENTOPS_API_KEY,
 *   environment: "production",
 * });
 * 
 * // Start an execution
 * const execution = AgentOps.startExecution({
 *   agentId: "my-agent",
 *   project: "my-project",
 * });
 * 
 * // Log an LLM call
 * execution.logLlmCall({
 *   model: "gpt-4o",
 *   provider: "openai",
 *   inputTokens: 150,
 *   outputTokens: 50,
 *   durationMs: 1500,
 * });
 * 
 * // Complete the execution
 * execution.complete();
 * ```
 */

// Core exports
export {
  AgentOpsClient,
  init,
  startExecution,
  getCurrentExecution,
  shutdown,
} from "./client";

export { ExecutionContext } from "./context";

export { EventBuffer } from "./buffer";
export type { BufferConfig, FlushHandler } from "./buffer";

export {
  PiiRedactor,
  getDefaultRedactor,
  configureRedactor,
} from "./redact";
export type { RedactionConfig } from "./redact";

// Decorators
export { observe, withObserve, traceObject } from "./decorators";
export type { ObserveOptions } from "./decorators";

// Types
export type {
  AgentOpsConfig,
  ExecutionStartParams,
  LLMCallParams,
  ToolCallParams,
  ObserveParams,
  BaseEvent,
  EventType,
  Message,
} from "./types";

export {
  AgentOpsError,
  AgentOpsConfigError,
  AgentOpsNetworkError,
  AgentOpsValidationError,
} from "./types";

// Integrations
export {
  instrumentOpenAI,
  wrapOpenAI,
  AgentOpsCallbackHandler,
  createLangChainHandler,
} from "./integrations";

// Utilities
export { v4 as uuid, durationMs, sleep, retry } from "./utils";

// Default export for convenience
import { AgentOpsClient, init, startExecution, getCurrentExecution, shutdown } from "./client";

export default {
  init,
  startExecution,
  getCurrentExecution,
  shutdown,
  AgentOpsClient,
};
