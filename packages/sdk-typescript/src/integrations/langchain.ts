/**
 * LangChain Integration
 * 
 * Callback handler for automatic tracing of LangChain operations.
 */

import { getCurrentExecution } from "../client";
import { durationMs } from "../utils";

// Type definitions to avoid direct dependency on langchain
interface Serialized {
  lc: number;
  type: string;
  id: string[];
}

interface LLMResult {
  generations: Array<
    Array<{
      text: string;
      generationInfo?: Record<string, unknown>;
    }>
  >;
  llmOutput?: {
    tokenUsage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
}

interface ChainValues {
  [key: string]: unknown;
}

interface BaseMessage {
  content: string;
  additional_kwargs?: Record<string, unknown>;
}

interface Document {
  pageContent: string;
  metadata: Record<string, unknown>;
}

interface AgentAction {
  tool: string;
  toolInput: string | Record<string, unknown>;
  log: string;
}

interface AgentFinish {
  returnValues: Record<string, unknown>;
  log: string;
}

/**
 * LangChain callback handler for AgentOps tracing
 * 
 * @example
 * ```typescript
 * import { ChatOpenAI } from "@langchain/openai";
 * import { AgentOpsCallbackHandler } from "@agentops/sdk";
 * 
 * const handler = new AgentOpsCallbackHandler();
 * 
 * const llm = new ChatOpenAI({
 *   callbacks: [handler],
 * });
 * ```
 */
export class AgentOpsCallbackHandler {
  private runStartTimes: Map<string, Date> = new Map();
  private llmInputs: Map<string, string[]> = new Map();
  
  // =========================================================================
  // LLM Callbacks
  // =========================================================================
  
  async handleLLMStart(
    _llm: Serialized,
    prompts: string[],
    runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>
  ): Promise<void> {
    this.runStartTimes.set(runId, new Date());
    this.llmInputs.set(runId, prompts);
  }
  
  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    const startTime = this.runStartTimes.get(runId);
    const inputs = this.llmInputs.get(runId) ?? [];
    
    const tokenUsage = output.llmOutput?.tokenUsage;
    const outputText = output.generations[0]?.[0]?.text ?? "";
    
    execution.logLlmCall({
      model: "langchain-llm",
      provider: "langchain",
      inputTokens: tokenUsage?.promptTokens ?? this.estimateTokens(inputs.join(" ")),
      outputTokens: tokenUsage?.completionTokens ?? this.estimateTokens(outputText),
      durationMs: startTime ? durationMs(startTime) : 0,
      inputMessages: inputs.map((p) => ({
        role: "user" as const,
        content: p,
      })),
      output: outputText,
      metadata: {
        runId,
      },
    });
    
    // Cleanup
    this.runStartTimes.delete(runId);
    this.llmInputs.delete(runId);
  }
  
  async handleLLMError(
    error: Error,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    const inputs = this.llmInputs.get(runId) ?? [];
    
    execution.logLlmCall({
      model: "langchain-llm",
      provider: "langchain",
      inputTokens: this.estimateTokens(inputs.join(" ")),
      outputTokens: 0,
      durationMs: 0,
      inputMessages: inputs.map((p) => ({
        role: "user" as const,
        content: p,
      })),
      output: "",
      metadata: {
        runId,
        errorMessage: error.message,
      },
    });
    
    // Cleanup
    this.runStartTimes.delete(runId);
    this.llmInputs.delete(runId);
  }
  
  // =========================================================================
  // Chat Model Callbacks
  // =========================================================================
  
  async handleChatModelStart(
    _llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    this.runStartTimes.set(runId, new Date());
    
    // Flatten messages for storage
    const flatMessages = messages.flat().map((m) => m.content);
    this.llmInputs.set(runId, flatMessages);
  }
  
  // =========================================================================
  // Chain Callbacks
  // =========================================================================
  
  async handleChainStart(
    _chain: Serialized,
    _inputs: ChainValues,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    this.runStartTimes.set(runId, new Date());
  }
  
  async handleChainEnd(
    _outputs: ChainValues,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    // Chain ends are typically handled at the tool level
    this.runStartTimes.delete(runId);
  }
  
  async handleChainError(
    _error: Error,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    this.runStartTimes.delete(runId);
  }
  
  // =========================================================================
  // Tool Callbacks
  // =========================================================================
  
  async handleToolStart(
    _tool: Serialized,
    input: string,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    this.runStartTimes.set(runId, new Date());
    this.llmInputs.set(runId, [input]);
  }
  
  async handleToolEnd(
    output: string,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    const startTime = this.runStartTimes.get(runId);
    const inputs = this.llmInputs.get(runId);
    
    execution.logToolCall({
      toolName: "langchain-tool",
      input: { query: inputs?.[0] ?? "" },
      output: { result: output },
      durationMs: startTime ? durationMs(startTime) : 0,
      success: true,
      metadata: {
        runId,
      },
    });
    
    // Cleanup
    this.runStartTimes.delete(runId);
    this.llmInputs.delete(runId);
  }
  
  async handleToolError(
    error: Error,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    const startTime = this.runStartTimes.get(runId);
    const inputs = this.llmInputs.get(runId);
    
    execution.logToolCall({
      toolName: "langchain-tool",
      input: { query: inputs?.[0] ?? "" },
      output: { error: error.message },
      durationMs: startTime ? durationMs(startTime) : 0,
      success: false,
      error: error.message,
      metadata: {
        runId,
      },
    });
    
    // Cleanup
    this.runStartTimes.delete(runId);
    this.llmInputs.delete(runId);
  }
  
  // =========================================================================
  // Agent Callbacks
  // =========================================================================
  
  async handleAgentAction(
    action: AgentAction,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    const inputValue = typeof action.toolInput === "string"
      ? { query: action.toolInput }
      : action.toolInput;
    
    execution.logToolCall({
      toolName: action.tool,
      input: inputValue,
      output: { log: action.log },
      durationMs: 0,
      success: true,
      metadata: {
        runId,
        type: "agent_action",
      },
    });
  }
  
  async handleAgentEnd(
    finish: AgentFinish,
    _runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    execution.setOutput(finish.returnValues);
  }
  
  // =========================================================================
  // Retriever Callbacks
  // =========================================================================
  
  async handleRetrieverStart(
    _retriever: Serialized,
    query: string,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    this.runStartTimes.set(runId, new Date());
    this.llmInputs.set(runId, [query]);
  }
  
  async handleRetrieverEnd(
    documents: Document[],
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    const startTime = this.runStartTimes.get(runId);
    const inputs = this.llmInputs.get(runId);
    
    execution.logToolCall({
      toolName: "retriever",
      input: { query: inputs?.[0] ?? "" },
      output: {
        documents: documents.map((d) => ({
          content: d.pageContent.slice(0, 200),
          metadata: d.metadata,
        })),
      },
      durationMs: startTime ? durationMs(startTime) : 0,
      success: true,
      metadata: {
        runId,
        documentsRetrieved: documents.length,
      },
    });
    
    // Cleanup
    this.runStartTimes.delete(runId);
    this.llmInputs.delete(runId);
  }
  
  async handleRetrieverError(
    error: Error,
    runId: string,
    _parentRunId?: string
  ): Promise<void> {
    const execution = getCurrentExecution();
    if (!execution) return;
    
    const inputs = this.llmInputs.get(runId);
    
    execution.logToolCall({
      toolName: "retriever",
      input: { query: inputs?.[0] ?? "" },
      output: { error: error.message },
      durationMs: 0,
      success: false,
      error: error.message,
      metadata: {
        runId,
      },
    });
    
    // Cleanup
    this.runStartTimes.delete(runId);
    this.llmInputs.delete(runId);
  }
  
  // =========================================================================
  // Private Helpers
  // =========================================================================
  
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Create a new callback handler instance
 */
export function createLangChainHandler(): AgentOpsCallbackHandler {
  return new AgentOpsCallbackHandler();
}
