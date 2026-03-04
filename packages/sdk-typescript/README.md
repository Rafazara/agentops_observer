# @agentops/sdk

TypeScript SDK for AgentOps Observer - Unified AI Agent Observability Platform.

## Installation

```bash
npm install @agentops/sdk
# or
yarn add @agentops/sdk
# or
pnpm add @agentops/sdk
```

## Quick Start

```typescript
import AgentOps from "@agentops/sdk";

// Initialize the SDK
AgentOps.init({
  apiKey: process.env.AGENTOPS_API_KEY!,
  environment: "production",
});

// Start an execution
const execution = AgentOps.startExecution({
  agentId: "my-agent",
  project: "my-project",
  version: "1.0.0",
});

// Log an LLM call
execution.logLlmCall({
  model: "gpt-4o",
  provider: "openai",
  inputTokens: 150,
  outputTokens: 50,
  durationMs: 1500,
  inputMessages: [{ role: "user", content: "Hello!" }],
  output: "Hi there!",
});

// Log a tool call
execution.logToolCall({
  toolName: "search",
  input: { query: "weather" },
  output: { results: [...] },
  durationMs: 200,
  success: true,
});

// Set the output and complete
execution.setOutput({ response: "Task completed" });
execution.complete();
```

## Configuration

```typescript
import { init } from "@agentops/sdk";

init({
  // Required
  apiKey: "your-api-key",
  
  // Optional
  endpoint: "https://api.agentops.dev",  // Custom endpoint
  environment: "production",              // production | staging | development
  flushIntervalMs: 5000,                  // Event flush interval
  piiRedaction: true,                     // Enable PII redaction
  enabled: true,                          // Enable/disable SDK
});
```

## OpenAI Integration

Automatically instrument OpenAI SDK calls:

```typescript
import OpenAI from "openai";
import AgentOps, { instrumentOpenAI } from "@agentops/sdk";

// Initialize AgentOps
AgentOps.init({ apiKey: process.env.AGENTOPS_API_KEY! });

// Create and instrument OpenAI client
const openai = new OpenAI();
instrumentOpenAI(openai);

// Start execution
const execution = AgentOps.startExecution({ agentId: "openai-agent" });

// All OpenAI calls are now automatically traced
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});

execution.complete();
```

### Non-Mutating Wrapper

If you prefer not to modify the original client:

```typescript
import OpenAI from "openai";
import { wrapOpenAI } from "@agentops/sdk";

const openai = new OpenAI();
const tracedOpenAI = wrapOpenAI(openai);

// Use tracedOpenAI for traced calls
await tracedOpenAI.chat.completions.create({...});

// Use original openai for untraced calls
await openai.chat.completions.create({...});
```

## LangChain Integration

Use the callback handler with LangChain:

```typescript
import { ChatOpenAI } from "@langchain/openai";
import AgentOps, { AgentOpsCallbackHandler } from "@agentops/sdk";

// Initialize AgentOps
AgentOps.init({ apiKey: process.env.AGENTOPS_API_KEY! });

// Create callback handler
const handler = new AgentOpsCallbackHandler();

// Use with LangChain
const llm = new ChatOpenAI({
  callbacks: [handler],
});

// Start execution
const execution = AgentOps.startExecution({ agentId: "langchain-agent" });

// All LLM calls are now traced
const response = await llm.invoke("Hello!");

execution.complete();
```

### With Agents and Chains

```typescript
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { AgentOpsCallbackHandler } from "@agentops/sdk";

const handler = new AgentOpsCallbackHandler();

const executor = await initializeAgentExecutorWithOptions(tools, llm, {
  agentType: "openai-functions",
  callbacks: [handler],
});

const execution = AgentOps.startExecution({ agentId: "agent-executor" });
await executor.invoke({ input: "What's the weather?" });
execution.complete();
```

## Decorators

### @observe Decorator

Automatically trace async functions:

```typescript
import { observe, init } from "@agentops/sdk";

init({ apiKey: process.env.AGENTOPS_API_KEY! });

class MyAgent {
  @observe({ agentId: "my-agent", autoStart: true })
  async processRequest(input: string): Promise<string> {
    // This execution is automatically tracked
    return "result";
  }
}
```

### withObserve HOF

For functions that can't use decorators:

```typescript
import { withObserve } from "@agentops/sdk";

const trackedFn = withObserve(
  async (input: string) => {
    // Function logic
    return "result";
  },
  { agentId: "my-agent", autoStart: true }
);

await trackedFn("input");
```

### traceObject

Trace all methods of an object:

```typescript
import { traceObject } from "@agentops/sdk";

const myService = {
  async processA() { ... },
  async processB() { ... },
};

const tracedService = traceObject(myService, {
  agentId: "my-service",
  methods: ["processA", "processB"],
});
```

## PII Redaction

Enable automatic PII redaction:

```typescript
import { init, configureRedactor } from "@agentops/sdk";

// Enable during init
init({
  apiKey: process.env.AGENTOPS_API_KEY!,
  piiRedaction: true,
});

// Or configure later
configureRedactor({
  enabled: true,
  customPatterns: [
    {
      name: "internal_id",
      pattern: /INT-\d{6}/g,
      replacement: "[INTERNAL_ID]",
    },
  ],
  sensitiveKeys: ["user_id", "customer_name"],
});
```

### Default Redacted Patterns

- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers
- IP addresses
- API keys
- JWTs

### Default Sensitive Keys

- password, secret, token
- api_key, authorization
- private_key, access_token
- ssn, credit_card, cvv, pin

## Manual Event Logging

### LLM Calls

```typescript
execution.logLlmCall({
  model: "gpt-4o",
  provider: "openai",
  inputTokens: 150,
  outputTokens: 50,
  thinkingTokens: 0,            // Optional: for reasoning models
  costUsd: 0.0025,              // Optional: auto-calculated if omitted
  durationMs: 1500,
  temperature: 0.7,
  inputMessages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello!" },
  ],
  output: "Hi there!",
  metadata: {
    responseId: "chatcmpl-123",
  },
});
```

### Tool Calls

```typescript
execution.logToolCall({
  toolName: "web_search",
  input: { query: "latest news" },
  output: { results: [...] },
  durationMs: 500,
  success: true,
  metadata: {
    source: "google",
  },
});

// Failed tool call
execution.logToolCall({
  toolName: "database_query",
  input: { sql: "SELECT * FROM users" },
  output: null,
  durationMs: 100,
  success: false,
  error: "Connection timeout",
});
```

## Error Handling

```typescript
const execution = AgentOps.startExecution({ agentId: "my-agent" });

try {
  // Agent logic
  const result = await runAgent();
  execution.setOutput(result);
  execution.complete();
} catch (error) {
  // Mark execution as failed
  execution.fail(error instanceof Error ? error : new Error(String(error)));
}
```

## Graceful Shutdown

```typescript
import AgentOps, { shutdown } from "@agentops/sdk";

// On process exit
process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

// Or explicitly
await AgentOps.shutdown();
```

## API Reference

### AgentOpsClient

| Method | Description |
|--------|-------------|
| `init(config)` | Initialize the SDK (singleton) |
| `startExecution(params)` | Start a new execution |
| `getCurrentExecution()` | Get the current execution context |
| `shutdown()` | Gracefully shutdown the client |

### ExecutionContext

| Method | Description |
|--------|-------------|
| `logLlmCall(params)` | Log an LLM call |
| `logToolCall(params)` | Log a tool call |
| `setOutput(output)` | Set the execution output |
| `setQualityScore(score)` | Set quality score (0-1) |
| `complete()` | Mark execution as completed |
| `fail(error)` | Mark execution as failed |
| `getStatus()` | Get current execution status |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | required | Your AgentOps API key |
| `endpoint` | string | `https://api.agentops.dev` | API endpoint |
| `environment` | string | `production` | Environment name |
| `flushIntervalMs` | number | `5000` | Event flush interval in ms |
| `piiRedaction` | boolean | `false` | Enable PII redaction |
| `enabled` | boolean | `true` | Enable/disable SDK |

## License

MIT
