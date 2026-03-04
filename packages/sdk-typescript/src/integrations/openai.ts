/**
 * OpenAI Integration
 * 
 * Auto-instrumentation for OpenAI SDK.
 */

import { getCurrentExecution } from "../client";
import { durationMs } from "../utils";

// Type definitions for OpenAI (avoiding direct dependency)
interface OpenAIClient {
  chat: {
    completions: {
      create: (params: unknown) => Promise<unknown>;
    };
  };
}

interface ChatCompletionParams {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Instrument an OpenAI client for automatic tracing
 * 
 * @example
 * ```typescript
 * import OpenAI from "openai";
 * import { instrumentOpenAI } from "@agentops/sdk";
 * 
 * const openai = new OpenAI();
 * instrumentOpenAI(openai);
 * 
 * // All calls are now automatically traced
 * const response = await openai.chat.completions.create({...});
 * ```
 */
export function instrumentOpenAI(client: OpenAIClient): void {
  const originalCreate = client.chat.completions.create.bind(
    client.chat.completions
  );
  
  client.chat.completions.create = async function (
    params: ChatCompletionParams
  ): Promise<ChatCompletionResponse> {
    const startTime = new Date();
    const execution = getCurrentExecution();
    
    try {
      const response = (await originalCreate(params)) as ChatCompletionResponse;
      
      // Log the LLM call if we have an active execution
      if (execution) {
        execution.logLlmCall({
          model: params.model,
          provider: "openai",
          inputTokens: response.usage?.prompt_tokens ?? estimateTokens(params.messages),
          outputTokens: response.usage?.completion_tokens ?? estimateTokens([response.choices[0]?.message]),
          durationMs: durationMs(startTime),
          temperature: params.temperature,
          inputMessages: params.messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })),
          output: response.choices[0]?.message.content ?? "",
          metadata: {
            responseId: response.id,
            finishReason: response.choices[0]?.finish_reason,
          },
        });
      }
      
      return response;
    } catch (error) {
      // Log error if we have an active execution
      if (execution) {
        execution.logLlmCall({
          model: params.model,
          provider: "openai",
          inputTokens: estimateTokens(params.messages),
          outputTokens: 0,
          durationMs: durationMs(startTime),
          temperature: params.temperature,
          inputMessages: params.messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          })),
          output: "",
          metadata: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
      
      throw error;
    }
  } as typeof originalCreate;
}

/**
 * Create a wrapped OpenAI client without modifying the original
 * 
 * @example
 * ```typescript
 * import OpenAI from "openai";
 * import { wrapOpenAI } from "@agentops/sdk";
 * 
 * const openai = new OpenAI();
 * const tracedOpenAI = wrapOpenAI(openai);
 * 
 * // Use tracedOpenAI for traced calls, original openai for untraced
 * ```
 */
export function wrapOpenAI<T extends OpenAIClient>(client: T): T {
  const wrapped = Object.create(client);
  
  wrapped.chat = {
    completions: {
      create: async (params: ChatCompletionParams) => {
        const startTime = new Date();
        const execution = getCurrentExecution();
        
        const response = (await client.chat.completions.create(
          params
        )) as ChatCompletionResponse;
        
        if (execution) {
          execution.logLlmCall({
            model: params.model,
            provider: "openai",
            inputTokens: response.usage?.prompt_tokens ?? estimateTokens(params.messages),
            outputTokens: response.usage?.completion_tokens ?? 0,
            durationMs: durationMs(startTime),
            temperature: params.temperature,
            inputMessages: params.messages.map((m) => ({
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
            })),
            output: response.choices[0]?.message.content ?? "",
          });
        }
        
        return response;
      },
    },
  };
  
  return wrapped;
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(
  messages: Array<{ role?: string; content?: string }> | undefined
): number {
  if (!messages) return 0;
  
  let totalChars = 0;
  for (const msg of messages) {
    if (msg.content) {
      totalChars += msg.content.length;
    }
    if (msg.role) {
      totalChars += msg.role.length;
    }
  }
  
  return Math.ceil(totalChars / 4);
}
