/**
 * AgentOps Client
 * 
 * Main entry point for the AgentOps SDK.
 */

import type {
  AgentOpsConfig,
  ExecutionStartParams,
  BaseEvent,
} from "./types";
import { AgentOpsConfigError, AgentOpsNetworkError } from "./types";
import { ExecutionContext } from "./context";
import { EventBuffer } from "./buffer";
import { PiiRedactor, RedactionConfig } from "./redact";
import { v4 as uuidv4 } from "./utils";

export class AgentOpsClient {
  private config: Required<AgentOpsConfig>;
  private buffer: EventBuffer;
  private redactor: PiiRedactor;
  private currentExecution: ExecutionContext | null = null;
  private isInitialized = false;
  
  // Singleton instance
  private static instance: AgentOpsClient | null = null;
  
  private constructor(config: AgentOpsConfig) {
    if (!config.apiKey) {
      throw new AgentOpsConfigError("API key is required");
    }
    
    this.config = {
      apiKey: config.apiKey,
      endpoint: config.endpoint ?? "https://api.agentops.dev",
      environment: config.environment ?? "production",
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      maxBufferSize: config.maxBufferSize ?? 100,
      piiRedaction: config.piiRedaction ?? false,
      enabled: config.enabled ?? true,
      debug: config.debug ?? false,
      defaultTags: config.defaultTags ?? [],
    };
    
    this.redactor = new PiiRedactor({
      enabled: this.config.piiRedaction,
    });
    
    this.buffer = new EventBuffer(
      (events) => this.sendEvents(events),
      {
        maxSize: this.config.maxBufferSize,
        flushIntervalMs: this.config.flushIntervalMs,
        maxRetries: 3,
      }
    );
  }
  
  /**
   * Initialize the AgentOps client
   */
  static init(config: AgentOpsConfig): AgentOpsClient {
    if (AgentOpsClient.instance) {
      console.warn("[AgentOps] Client already initialized. Use AgentOps.getInstance() to get the existing instance.");
      return AgentOpsClient.instance;
    }
    
    AgentOpsClient.instance = new AgentOpsClient(config);
    AgentOpsClient.instance.start();
    return AgentOpsClient.instance;
  }
  
  /**
   * Get the singleton instance
   */
  static getInstance(): AgentOpsClient | null {
    return AgentOpsClient.instance;
  }
  
  /**
   * Reset the singleton (for testing)
   */
  static reset(): void {
    if (AgentOpsClient.instance) {
      AgentOpsClient.instance.shutdown();
      AgentOpsClient.instance = null;
    }
  }
  
  /**
   * Start the client (begin buffering and flushing)
   */
  private start(): void {
    if (this.isInitialized || !this.config.enabled) {
      return;
    }
    
    this.buffer.start();
    this.isInitialized = true;
    
    // Handle process exit
    if (typeof process !== "undefined") {
      process.on("beforeExit", () => {
        this.shutdown();
      });
      
      process.on("SIGINT", () => {
        this.shutdown();
        process.exit(0);
      });
      
      process.on("SIGTERM", () => {
        this.shutdown();
        process.exit(0);
      });
    }
  }
  
  /**
   * Shutdown the client gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }
    
    // End current execution if running
    if (this.currentExecution) {
      const status = this.currentExecution.getStatus();
      if (status.status === "running") {
        this.currentExecution.complete();
      }
    }
    
    // Flush remaining events
    await this.buffer.shutdown();
    this.isInitialized = false;
  }
  
  /**
   * Start a new execution
   */
  startExecution(params: ExecutionStartParams): ExecutionContext {
    if (!this.config.enabled) {
      // Return a no-op context
      return new ExecutionContext(
        uuidv4(),
        params.agentId,
        params,
        async () => {}
      );
    }
    
    const executionId = uuidv4();
    
    this.currentExecution = new ExecutionContext(
      executionId,
      params.agentId,
      params,
      async (events) => {
        const redactedEvents = events.map((e) => this.redactor.redact(e));
        this.buffer.pushMany(redactedEvents);
      }
    );
    
    return this.currentExecution;
  }
  
  /**
   * Get the current execution context
   */
  getCurrentExecution(): ExecutionContext | null {
    return this.currentExecution;
  }
  
  /**
   * Configure PII redaction
   */
  configureRedaction(config: RedactionConfig): void {
    this.redactor = new PiiRedactor(config);
  }
  
  /**
   * Check if client is enabled
   */
  get enabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Get the API endpoint
   */
  get endpoint(): string {
    return this.config.endpoint;
  }
  
  // =========================================================================
  // Private Methods
  // =========================================================================
  
  private async sendEvents(events: BaseEvent[]): Promise<void> {
    if (!this.config.enabled || events.length === 0) {
      return;
    }
    
    const url = `${this.config.endpoint}/v1/ingest`;
    
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
          "X-Environment": this.config.environment,
        },
        body: JSON.stringify({ events }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new AgentOpsNetworkError(
          `Failed to send events: ${response.status} ${errorText}`
        );
      }
    } catch (error) {
      if (error instanceof AgentOpsNetworkError) {
        throw error;
      }
      throw new AgentOpsNetworkError(
        `Network error sending events: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// =========================================================================
// Convenience exports
// =========================================================================

/**
 * Initialize the AgentOps client
 */
export function init(config: AgentOpsConfig): AgentOpsClient {
  return AgentOpsClient.init(config);
}

/**
 * Start a new execution
 */
export function startExecution(params: ExecutionStartParams): ExecutionContext {
  const client = AgentOpsClient.getInstance();
  if (!client) {
    throw new AgentOpsConfigError(
      "AgentOps not initialized. Call init() first."
    );
  }
  return client.startExecution(params);
}

/**
 * Get the current execution
 */
export function getCurrentExecution(): ExecutionContext | null {
  const client = AgentOpsClient.getInstance();
  return client?.getCurrentExecution() ?? null;
}

/**
 * Shutdown the client
 */
export async function shutdown(): Promise<void> {
  const client = AgentOpsClient.getInstance();
  if (client) {
    await client.shutdown();
    AgentOpsClient.reset();
  }
}
