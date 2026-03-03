# AgentOps Observer SDK

[![PyPI version](https://badge.fury.io/py/agentops-observer.svg)](https://badge.fury.io/py/agentops-observer)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Enterprise-grade observability SDK for autonomous AI agents. Instrument, trace, and monitor your agents with minimal code changes.

## Features

- 🔍 **Automatic Tracing**: Capture every LLM call, tool invocation, and decision
- 🪝 **Framework Integrations**: LangChain, OpenAI, Anthropic auto-patching
- 🔄 **Loop Detection**: Automatic detection of infinite loops and repetitive patterns
- 💰 **Cost Tracking**: Real-time cost calculation for all LLM calls
- 🔒 **PII Redaction**: Automatic detection and masking of sensitive data
- ⚡ **Async Buffer**: Non-blocking event collection with retry and circuit breaker
- 🎯 **Context Propagation**: Automatic trace context across async boundaries

## Quick Start

### Installation

```bash
pip install agentops-observer
```

### Basic Usage

```python
import agentops

# Initialize the SDK
agentops.init(api_key="your-api-key")

# Use the @trace decorator for automatic instrumentation
@agentops.trace(agent_id="my-agent")
async def run_agent(task: str):
    # Your agent logic here
    result = await agent.run(task)
    return result

# Or manually create traces
async with agentops.trace_context(agent_id="my-agent") as ctx:
    response = await llm.complete("Hello!")
    ctx.record_llm_call(model="gpt-4", input={"messages": [...]}, output=response)
```

### LangChain Integration

```python
import agentops
from langchain_openai import ChatOpenAI

agentops.init(api_key="your-api-key")
agentops.patch_langchain()  # Auto-instrument all chains

llm = ChatOpenAI()
response = llm.invoke("Hello!")  # Automatically traced
```

### OpenAI Integration

```python
import agentops
from openai import OpenAI

agentops.init(api_key="your-api-key")
agentops.patch_openai()  # Auto-instrument all calls

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)  # Automatically traced
```

## Configuration

```python
agentops.init(
    api_key="your-api-key",
    endpoint="https://api.yourcompany.com",
    
    # Buffering settings
    buffer_size=100,           # Flush after N events
    flush_interval_ms=5000,    # Flush every N ms
    
    # Retry settings
    max_retries=3,
    retry_backoff_ms=1000,
    
    # PII redaction
    redact_pii=True,
    pii_patterns=["email", "phone", "ssn", "credit_card"],
    
    # Sampling
    sample_rate=1.0,           # 1.0 = 100% of traces
    
    # Environment
    environment="production",
    version="1.2.3",
)
```

## API Reference

### Core Functions

- `agentops.init(**kwargs)` - Initialize the SDK
- `agentops.trace(agent_id, **kwargs)` - Decorator for tracing functions
- `agentops.trace_context(agent_id, **kwargs)` - Context manager for manual tracing
- `agentops.shutdown()` - Gracefully shutdown and flush remaining events

### Integration Patchers

- `agentops.patch_langchain()` - Auto-instrument LangChain
- `agentops.patch_openai()` - Auto-instrument OpenAI
- `agentops.patch_anthropic()` - Auto-instrument Anthropic

### Event Recording

```python
async with agentops.trace_context(agent_id="my-agent") as ctx:
    # Record LLM calls
    ctx.record_llm_call(
        model="gpt-4",
        provider="openai",
        input={"messages": messages},
        output=response,
        duration_ms=150,
        tokens={"input": 100, "output": 50},
        cost_usd=0.005,
    )
    
    # Record tool calls
    ctx.record_tool_call(
        tool_name="search",
        input={"query": "latest news"},
        output={"results": [...]},
        duration_ms=200,
    )
    
    # Record custom events
    ctx.record_event(
        event_type="planning_step",
        data={"plan": "First I will..."},
    )
    
    # Set execution outcome
    ctx.set_outcome(
        status="success",
        output={"result": "Task completed"},
        quality_score=0.95,
    )
```

## License

MIT
