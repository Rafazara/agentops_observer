/**
 * Decorators for automatic tracing
 */

import { getCurrentExecution, startExecution } from "./client";

/**
 * Options for the @observe decorator
 */
export interface ObserveOptions {
  /**
   * Agent ID for this function
   */
  agentId?: string;
  
  /**
   * Project name
   */
  project?: string;
  
  /**
   * Agent version
   */
  version?: string;
  
  /**
   * Environment name
   */
  environment?: string;
  
  /**
   * Custom tags
   */
  tags?: string[];
  
  /**
   * Name override (defaults to function name)
   */
  name?: string;
  
  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
  
  /**
   * If true, starts a new execution if one doesn't exist
   * @default false
   */
  autoStart?: boolean;
}

/**
 * Decorator to observe async functions and automatically log them
 * 
 * @example
 * ```typescript
 * @observe({ agentId: "my-agent" })
 * async function processRequest(input: string): Promise<string> {
 *   // This execution is automatically tracked
 *   return "result";
 * }
 * ```
 */
export function observe(options: ObserveOptions = {}) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    target: T | object,
    propertyKey?: string,
    descriptor?: PropertyDescriptor
  ): T | PropertyDescriptor | void {
    // Handle both method decorator and standalone function
    if (descriptor && propertyKey) {
      // Method decorator
      const originalMethod = descriptor.value;
      
      descriptor.value = async function (...args: unknown[]) {
        return executeWithObserve(
          () => originalMethod.apply(this, args),
          {
            ...options,
            functionName: propertyKey,
          }
        );
      };
      
      return descriptor;
    } else if (typeof target === "function") {
      // Standalone function
      const fn = target as T;
      
      return async function (...args: Parameters<T>): Promise<ReturnType<T>> {
        return executeWithObserve(
          () => fn(...args),
          {
            ...options,
            functionName: fn.name || "anonymous",
          }
        ) as ReturnType<T>;
      } as T;
    }
  };
}

/**
 * Higher-order function version of observe (for non-decorator usage)
 * 
 * @example
 * ```typescript
 * const trackedFn = withObserve(myAsyncFunction, { agentId: "my-agent" });
 * await trackedFn(input);
 * ```
 */
export function withObserve<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: ObserveOptions = {}
): T {
  return (async function (...args: Parameters<T>): Promise<ReturnType<T>> {
    return executeWithObserve(
      () => fn(...args),
      {
        ...options,
        functionName: fn.name || "anonymous",
      }
    ) as ReturnType<T>;
  }) as T;
}

/**
 * Internal helper to execute a function with observation
 */
async function executeWithObserve<T>(
  fn: () => Promise<T>,
  options: ObserveOptions & { functionName?: string }
): Promise<T> {
  let execution = getCurrentExecution();
  let shouldComplete = false;
  
  // Start new execution if needed
  if (!execution && options.autoStart && options.agentId) {
    execution = startExecution({
      agentId: options.agentId,
      project: options.project,
      version: options.version,
      environment: options.environment,
      tags: options.tags,
      metadata: {
        ...options.metadata,
        function: options.functionName,
      },
    });
    shouldComplete = true;
  }
  
  try {
    const result = await fn();
    
    // If we have an execution, log completion
    if (execution && shouldComplete) {
      execution.setOutput(result);
      execution.complete();
    }
    
    return result;
  } catch (error) {
    // If we have an execution, log failure
    if (execution && shouldComplete) {
      execution.fail(
        error instanceof Error ? error : new Error(String(error))
      );
    }
    throw error;
  }
}

/**
 * Create a traced version of an object's methods
 * 
 * @example
 * ```typescript
 * const tracedService = traceObject(myService, {
 *   agentId: "my-service",
 *   methods: ["processRequest", "handleCallback"],
 * });
 * ```
 */
export function traceObject<T extends object>(
  obj: T,
  options: {
    agentId: string;
    methods?: string[];
    exclude?: string[];
    project?: string;
    environment?: string;
  }
): T {
  const methodsToTrace = options.methods ?? Object.keys(obj);
  const excludeMethods = new Set(options.exclude ?? []);
  
  const traced = { ...obj };
  
  for (const key of methodsToTrace) {
    if (excludeMethods.has(key)) continue;
    
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value !== "function") continue;
    
    (traced as Record<string, unknown>)[key] = withObserve(
      value.bind(obj) as (...args: unknown[]) => Promise<unknown>,
      {
        agentId: options.agentId,
        project: options.project,
        environment: options.environment,
        autoStart: true,
        metadata: { method: key },
      }
    );
  }
  
  return traced;
}
