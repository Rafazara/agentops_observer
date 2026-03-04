/**
 * Event Buffer
 * 
 * Buffers events and flushes them periodically or when buffer is full.
 */

import type { BaseEvent } from "./types";
import { retry, sleep } from "./utils";

export interface BufferConfig {
  /**
   * Maximum number of events to buffer before flushing
   * @default 100
   */
  maxSize?: number;
  
  /**
   * Interval in milliseconds between flushes
   * @default 5000
   */
  flushIntervalMs?: number;
  
  /**
   * Maximum number of retry attempts for failed flushes
   * @default 3
   */
  maxRetries?: number;
}

export type FlushHandler = (events: BaseEvent[]) => Promise<void>;

export class EventBuffer {
  private buffer: BaseEvent[] = [];
  private flushHandler: FlushHandler;
  private config: Required<BufferConfig>;
  private flushInterval: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private isShuttingDown = false;
  
  constructor(flushHandler: FlushHandler, config: BufferConfig = {}) {
    this.flushHandler = flushHandler;
    this.config = {
      maxSize: config.maxSize ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      maxRetries: config.maxRetries ?? 3,
    };
  }
  
  /**
   * Start the periodic flush timer
   */
  start(): void {
    if (this.flushInterval) {
      return;
    }
    
    this.flushInterval = setInterval(() => {
      if (this.buffer.length > 0 && !this.isFlushing) {
        this.flush().catch((err) => {
          console.error("[AgentOps] Failed to flush events:", err);
        });
      }
    }, this.config.flushIntervalMs);
    
    // Don't keep Node.js process alive just for this timer
    if (typeof this.flushInterval.unref === "function") {
      this.flushInterval.unref();
    }
  }
  
  /**
   * Stop the periodic flush timer
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
  
  /**
   * Add an event to the buffer
   */
  push(event: BaseEvent): void {
    if (this.isShuttingDown) {
      console.warn("[AgentOps] Cannot push events during shutdown");
      return;
    }
    
    this.buffer.push(event);
    
    // Auto-flush if buffer is full
    if (this.buffer.length >= this.config.maxSize && !this.isFlushing) {
      this.flush().catch((err) => {
        console.error("[AgentOps] Failed to flush events:", err);
      });
    }
  }
  
  /**
   * Add multiple events to the buffer
   */
  pushMany(events: BaseEvent[]): void {
    for (const event of events) {
      this.push(event);
    }
  }
  
  /**
   * Flush all buffered events
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.isFlushing) {
      return;
    }
    
    this.isFlushing = true;
    
    try {
      // Take a copy and clear buffer
      const events = [...this.buffer];
      this.buffer = [];
      
      // Attempt to send with retries
      await retry(
        () => this.flushHandler(events),
        { maxAttempts: this.config.maxRetries }
      );
    } catch (error) {
      // On failure, put events back in buffer (at the front)
      console.error("[AgentOps] Failed to flush events after retries:", error);
      // Note: we don't re-add to avoid infinite growth on repeated failures
    } finally {
      this.isFlushing = false;
    }
  }
  
  /**
   * Shutdown the buffer, flushing all remaining events
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stop();
    
    // Wait for any ongoing flush to complete
    while (this.isFlushing) {
      await sleep(50);
    }
    
    // Final flush
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }
  
  /**
   * Get the current buffer size
   */
  get size(): number {
    return this.buffer.length;
  }
  
  /**
   * Check if buffer is empty
   */
  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}
