/**
 * Execution Context
 * 
 * Represents a running agent execution and provides methods for logging events.
 */

import { v4 as uuidv4 } from "./utils";
import type { LLMCallParams, ToolCallParams, BaseEvent, EventType } from "./types";

export class ExecutionContext {
  readonly id: string;
  readonly agentId: string;
  readonly startedAt: Date;
  
  private events: BaseEvent[] = [];
  private sequenceNumber = 0;
  private _status: "running" | "completed" | "failed" = "running";
  private _output: unknown = null;
  private _qualityScore: number | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _lastError: Error | null = null;
  
  private llmCallCount = 0;
  private toolCallCount = 0;
  private totalCostUsd = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  
  private flushCallback?: (events: BaseEvent[]) => Promise<void>;
  
  // Config properties extracted for use
  readonly project?: string;
  readonly version?: string;
  readonly environment?: string;
  readonly tags?: string[];
  readonly metadata?: Record<string, unknown>;
  
  constructor(
    id: string,
    agentId: string,
    config: {
      project?: string;
      version?: string;
      environment?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    },
    flushCallback?: (events: BaseEvent[]) => Promise<void>
  ) {
    this.id = id;
    this.agentId = agentId;
    this.startedAt = new Date();
    this.flushCallback = flushCallback;
    
    // Store config values
    this.project = config.project;
    this.version = config.version;
    this.environment = config.environment;
    this.tags = config.tags;
    this.metadata = config.metadata;
    
    // Log execution start
    this.addEvent("execution_start", {
      agentId,
      project: this.project,
      version: this.version,
      environment: this.environment,
      tags: this.tags,
      metadata: this.metadata,
    });
  }
  
  /**
   * Log an LLM call (chat completion, etc.)
   */
  logLlmCall(params: LLMCallParams): void {
    this.llmCallCount++;
    this.totalInputTokens += params.inputTokens;
    this.totalOutputTokens += params.outputTokens;
    
    if (params.costUsd) {
      this.totalCostUsd += params.costUsd;
    } else {
      // Auto-calculate cost based on model
      this.totalCostUsd += this.estimateCost(
        params.model,
        params.inputTokens,
        params.outputTokens
      );
    }
    
    this.addEvent("llm_call_end", {
      model: params.model,
      provider: params.provider,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      thinkingTokens: params.thinkingTokens,
      costUsd: params.costUsd ?? this.estimateCost(params.model, params.inputTokens, params.outputTokens),
      durationMs: params.durationMs,
      temperature: params.temperature,
      inputMessages: params.inputMessages,
      output: params.output,
      metadata: params.metadata,
    });
  }
  
  /**
   * Log a tool/function call
   */
  logToolCall(params: ToolCallParams): void {
    this.toolCallCount++;
    
    this.addEvent("tool_call_end", {
      toolName: params.toolName,
      input: params.input,
      output: params.output,
      durationMs: params.durationMs,
      success: params.success,
      error: params.error,
      metadata: params.metadata,
    });
  }
  
  /**
   * Set the final output of the execution
   */
  setOutput(output: unknown): void {
    this._output = output;
  }
  
  /**
   * Set a quality score (0-1)
   */
  setQualityScore(score: number): void {
    if (score < 0 || score > 1) {
      console.warn("[AgentOps] Quality score should be between 0 and 1");
    }
    this._qualityScore = Math.max(0, Math.min(1, score));
  }
  
  /**
   * Mark the execution as failed
   */
  fail(error: Error): void {
    this._status = "failed";
    this._lastError = error;
    
    this.addEvent("error", {
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    
    this.addEvent("execution_end", {
      status: "failed",
      error: {
        type: error.name,
        message: error.message,
      },
      llmCallCount: this.llmCallCount,
      toolCallCount: this.toolCallCount,
      totalCostUsd: this.totalCostUsd,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
    });
    
    this.flush();
  }
  
  /**
   * Mark the execution as completed successfully
   */
  complete(): void {
    this._status = "completed";
    
    this.addEvent("execution_end", {
      status: "completed",
      output: this._output,
      qualityScore: this._qualityScore,
      llmCallCount: this.llmCallCount,
      toolCallCount: this.toolCallCount,
      totalCostUsd: this.totalCostUsd,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
    });
    
    this.flush();
  }
  
  /**
   * Get current execution status
   */
  getStatus(): {
    id: string;
    status: "running" | "completed" | "failed";
    llmCallCount: number;
    toolCallCount: number;
    totalCostUsd: number;
    lastError: Error | null;
  } {
    return {
      id: this.id,
      status: this._status,
      llmCallCount: this.llmCallCount,
      toolCallCount: this.toolCallCount,
      totalCostUsd: this.totalCostUsd,
      lastError: this._lastError,
    };
  }
  
  // =========================================================================
  // Private Methods
  // =========================================================================
  
  private addEvent(type: EventType, data: Record<string, unknown>): void {
    const event: BaseEvent = {
      eventId: uuidv4(),
      executionId: this.id,
      eventType: type,
      sequenceNumber: this.sequenceNumber++,
      occurredAt: new Date().toISOString(),
      ...data,
    };
    
    this.events.push(event);
  }
  
  private async flush(): Promise<void> {
    if (this.flushCallback && this.events.length > 0) {
      const eventsToFlush = [...this.events];
      this.events = [];
      await this.flushCallback(eventsToFlush);
    }
  }
  
  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Cost per 1M tokens
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4-turbo": { input: 10.0, output: 30.0 },
      "gpt-4o": { input: 2.5, output: 10.0 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "gpt-4": { input: 30.0, output: 60.0 },
      "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
      "claude-3-opus": { input: 15.0, output: 75.0 },
      "claude-3-sonnet": { input: 3.0, output: 15.0 },
      "claude-3-haiku": { input: 0.25, output: 1.25 },
      "claude-3.5-sonnet": { input: 3.0, output: 15.0 },
    };
    
    // Find matching pricing (partial match)
    let rates = { input: 1.0, output: 2.0 }; // Default
    for (const [key, value] of Object.entries(pricing)) {
      if (model.toLowerCase().includes(key.toLowerCase())) {
        rates = value;
        break;
      }
    }
    
    return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  }
}
