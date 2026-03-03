"""
OpenAI auto-patching integration.
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
    Patch OpenAI client to auto-record LLM calls.
    
    Args:
        client: AgentOps client instance.
    """
    global _patched
    
    if _patched:
        return
    
    try:
        import openai
        from openai import OpenAI, AsyncOpenAI
    except ImportError:
        raise ImportError(
            "OpenAI package not installed. Install with: pip install openai"
        )
    
    # Patch sync client
    original_create = OpenAI.chat.completions.create
    
    @functools.wraps(original_create)
    def patched_create(self, *args, **kwargs):
        return _wrap_completion(client, original_create, self, args, kwargs, is_async=False)
    
    OpenAI.chat.completions.create = patched_create
    
    # Patch async client
    original_async_create = AsyncOpenAI.chat.completions.create
    
    @functools.wraps(original_async_create)
    async def patched_async_create(self, *args, **kwargs):
        return await _wrap_completion(client, original_async_create, self, args, kwargs, is_async=True)
    
    AsyncOpenAI.chat.completions.create = patched_async_create
    
    _patched = True


def _wrap_completion(
    client: AgentOps,
    original_fn: Callable,
    self: Any,
    args: tuple,
    kwargs: dict[str, Any],
    is_async: bool,
) -> Any:
    """Wrap a completion call to record it."""
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
    temperature = kwargs.get("temperature")
    
    start_time = time.perf_counter()
    
    if is_async:
        async def async_call():
            try:
                response = await original_fn(self, *args, **kwargs)
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                await _record_call(
                    ctx, model, messages, response, temperature, duration_ms
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
                _record_call(ctx, model, messages, response, temperature, duration_ms)
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
    response: Any,
    temperature: float | None,
    duration_ms: int,
) -> None:
    """Record an OpenAI call."""
    # Extract usage info
    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "prompt_tokens", None) if usage else None
    output_tokens = getattr(usage, "completion_tokens", None) if usage else None
    
    # Extract response content
    output_content = None
    if hasattr(response, "choices") and response.choices:
        choice = response.choices[0]
        if hasattr(choice, "message"):
            output_content = {
                "role": getattr(choice.message, "role", "assistant"),
                "content": getattr(choice.message, "content", ""),
            }
    
    # Calculate approximate cost
    cost_usd = _estimate_openai_cost(model, input_tokens, output_tokens)
    
    await ctx.record_llm_call(
        model=model,
        provider="openai",
        input={"messages": messages},
        output={"response": output_content},
        temperature=temperature,
        duration_ms=duration_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost_usd,
    )


def _estimate_openai_cost(
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
) -> float | None:
    """Estimate cost for OpenAI models."""
    if input_tokens is None or output_tokens is None:
        return None
    
    # Cost per 1M tokens (as of 2024)
    PRICING = {
        "gpt-4o": (2.50, 10.00),
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4-turbo": (10.00, 30.00),
        "gpt-4": (30.00, 60.00),
        "gpt-3.5-turbo": (0.50, 1.50),
        "gpt-3.5-turbo-0125": (0.50, 1.50),
    }
    
    # Find matching model
    for model_name, (input_price, output_price) in PRICING.items():
        if model.startswith(model_name):
            cost = (input_tokens * input_price / 1_000_000) + (output_tokens * output_price / 1_000_000)
            return round(cost, 6)
    
    # Default estimate for unknown models
    return round((input_tokens * 10 / 1_000_000) + (output_tokens * 30 / 1_000_000), 6)
