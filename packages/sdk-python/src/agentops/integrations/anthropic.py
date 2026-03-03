"""
Anthropic auto-patching integration.
"""

from __future__ import annotations

import asyncio
import functools
import time
from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from agentops.client import AgentOps


# Track if already patched
_patched = False


def patch(client: AgentOps) -> None:
    """
    Patch Anthropic client to auto-record LLM calls.
    
    Args:
        client: AgentOps client instance.
    """
    global _patched
    
    if _patched:
        return
    
    try:
        import anthropic
        from anthropic import Anthropic, AsyncAnthropic
    except ImportError:
        raise ImportError(
            "Anthropic package not installed. Install with: pip install anthropic"
        )
    
    # Patch sync client
    original_create = Anthropic.messages.create
    
    @functools.wraps(original_create)
    def patched_create(self, *args, **kwargs):
        return _wrap_message(client, original_create, self, args, kwargs, is_async=False)
    
    Anthropic.messages.create = patched_create
    
    # Patch async client
    original_async_create = AsyncAnthropic.messages.create
    
    @functools.wraps(original_async_create)
    async def patched_async_create(self, *args, **kwargs):
        return await _wrap_message(client, original_async_create, self, args, kwargs, is_async=True)
    
    AsyncAnthropic.messages.create = patched_async_create
    
    _patched = True


def _wrap_message(
    client: AgentOps,
    original_fn: Callable,
    self: Any,
    args: tuple,
    kwargs: dict[str, Any],
    is_async: bool,
) -> Any:
    """Wrap a message call to record it."""
    from agentops.context import get_current_trace
    
    ctx = get_current_trace()
    
    if ctx is None or client.is_disabled:
        if is_async:
            return original_fn(self, *args, **kwargs)
        else:
            return original_fn(self, *args, **kwargs)
    
    # Extract parameters
    model = kwargs.get("model", "unknown")
    messages = kwargs.get("messages", [])
    system = kwargs.get("system")
    temperature = kwargs.get("temperature")
    max_tokens = kwargs.get("max_tokens", 1024)
    
    start_time = time.perf_counter()
    
    if is_async:
        async def async_call():
            try:
                response = await original_fn(self, *args, **kwargs)
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                await _record_call(
                    ctx, model, messages, system, response, temperature, duration_ms
                )
                
                return response
            except Exception as e:
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                await ctx.record_error(
                    error_type=type(e).__name__,
                    error_message=str(e),
                )
                raise
        
        return async_call()
    else:
        try:
            response = original_fn(self, *args, **kwargs)
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            
            # Record synchronously using asyncio
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                _record_call(ctx, model, messages, system, response, temperature, duration_ms)
            )
            loop.close()
            
            return response
        except Exception as e:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                ctx.record_error(error_type=type(e).__name__, error_message=str(e))
            )
            loop.close()
            raise


async def _record_call(
    ctx,
    model: str,
    messages: list,
    system: str | None,
    response: Any,
    temperature: float | None,
    duration_ms: int,
) -> None:
    """Record an Anthropic call."""
    # Extract usage info
    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "input_tokens", None) if usage else None
    output_tokens = getattr(usage, "output_tokens", None) if usage else None
    
    # Extract response content
    output_content = None
    if hasattr(response, "content") and response.content:
        content_blocks = []
        for block in response.content:
            if hasattr(block, "text"):
                content_blocks.append({"type": "text", "text": block.text})
            elif hasattr(block, "type"):
                content_blocks.append({"type": block.type})
        output_content = {"content": content_blocks}
    
    # Calculate approximate cost
    cost_usd = _estimate_anthropic_cost(model, input_tokens, output_tokens)
    
    await ctx.record_llm_call(
        model=model,
        provider="anthropic",
        input={"messages": messages, "system": system},
        output=output_content,
        temperature=temperature,
        duration_ms=duration_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )


def _estimate_anthropic_cost(
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
) -> float | None:
    """Estimate cost for Anthropic models."""
    if input_tokens is None or output_tokens is None:
        return None
    
    # Cost per 1M tokens (as of 2024)
    PRICING = {
        "claude-3-5-sonnet": (3.00, 15.00),
        "claude-3-opus": (15.00, 75.00),
        "claude-3-sonnet": (3.00, 15.00),
        "claude-3-haiku": (0.25, 1.25),
        "claude-2.1": (8.00, 24.00),
        "claude-2": (8.00, 24.00),
        "claude-instant": (0.80, 2.40),
    }
    
    # Find matching model
    for model_name, (input_price, output_price) in PRICING.items():
        if model.startswith(model_name):
            cost = (input_tokens * input_price / 1_000_000) + (output_tokens * output_price / 1_000_000)
            return round(cost, 6)
    
    # Default estimate for unknown models
    return round((input_tokens * 3 / 1_000_000) + (output_tokens * 15 / 1_000_000), 6)
