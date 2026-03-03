"""
LangChain auto-patching integration.
"""

from __future__ import annotations

import asyncio
import functools
import time
from typing import TYPE_CHECKING, Any, Callable
import logging

if TYPE_CHECKING:
    from agentops.client import AgentOps

logger = logging.getLogger("agentops")

# Track if already patched
_patched = False


def patch(client: AgentOps) -> None:
    """
    Patch LangChain to auto-record LLM calls and tool invocations.
    
    This patches:
    - BaseChatModel._generate
    - BaseLLM._generate
    - Tool.run / Tool.arun
    
    Args:
        client: AgentOps client instance.
    """
    global _patched
    
    if _patched:
        return
    
    try:
        _patch_chat_models(client)
        _patch_llms(client)
        _patch_tools(client)
        
        _patched = True
        logger.info("LangChain auto-instrumentation enabled")
        
    except ImportError as e:
        logger.warning(f"Could not patch LangChain: {e}")


def _patch_chat_models(client: AgentOps) -> None:
    """Patch LangChain chat models."""
    try:
        from langchain_core.language_models.chat_models import BaseChatModel
    except ImportError:
        return
    
    original_generate = BaseChatModel._generate
    original_agenerate = BaseChatModel._agenerate
    
    @functools.wraps(original_generate)
    def patched_generate(self, messages, stop=None, run_manager=None, **kwargs):
        return _wrap_chat_generate(
            client, original_generate, self, messages, stop, run_manager, kwargs, is_async=False
        )
    
    @functools.wraps(original_agenerate)
    async def patched_agenerate(self, messages, stop=None, run_manager=None, **kwargs):
        return await _wrap_chat_generate(
            client, original_agenerate, self, messages, stop, run_manager, kwargs, is_async=True
        )
    
    BaseChatModel._generate = patched_generate
    BaseChatModel._agenerate = patched_agenerate


def _patch_llms(client: AgentOps) -> None:
    """Patch LangChain LLMs."""
    try:
        from langchain_core.language_models.llms import BaseLLM
    except ImportError:
        return
    
    original_generate = BaseLLM._generate
    original_agenerate = BaseLLM._agenerate
    
    @functools.wraps(original_generate)
    def patched_generate(self, prompts, stop=None, run_manager=None, **kwargs):
        return _wrap_llm_generate(
            client, original_generate, self, prompts, stop, run_manager, kwargs, is_async=False
        )
    
    @functools.wraps(original_agenerate)
    async def patched_agenerate(self, prompts, stop=None, run_manager=None, **kwargs):
        return await _wrap_llm_generate(
            client, original_agenerate, self, prompts, stop, run_manager, kwargs, is_async=True
        )
    
    BaseLLM._generate = patched_generate
    BaseLLM._agenerate = patched_agenerate


def _patch_tools(client: AgentOps) -> None:
    """Patch LangChain tools."""
    try:
        from langchain_core.tools import BaseTool
    except ImportError:
        return
    
    original_run = BaseTool.run
    original_arun = BaseTool.arun
    
    @functools.wraps(original_run)
    def patched_run(self, tool_input, verbose=None, start_color=None, color=None, callbacks=None, **kwargs):
        return _wrap_tool_run(
            client, original_run, self, tool_input, verbose, callbacks, kwargs, is_async=False
        )
    
    @functools.wraps(original_arun)
    async def patched_arun(self, tool_input, verbose=None, start_color=None, color=None, callbacks=None, **kwargs):
        return await _wrap_tool_run(
            client, original_arun, self, tool_input, verbose, callbacks, kwargs, is_async=True
        )
    
    BaseTool.run = patched_run
    BaseTool.arun = patched_arun


def _wrap_chat_generate(
    client: AgentOps,
    original_fn: Callable,
    self: Any,
    messages: list,
    stop: Any,
    run_manager: Any,
    kwargs: dict[str, Any],
    is_async: bool,
) -> Any:
    """Wrap a chat model generate call."""
    from agentops.context import get_current_trace
    
    ctx = get_current_trace()
    
    if ctx is None or client.is_disabled:
        if is_async:
            return original_fn(self, messages, stop, run_manager, **kwargs)
        else:
            return original_fn(self, messages, stop, run_manager, **kwargs)
    
    # Extract model info
    model = getattr(self, "model_name", getattr(self, "model", "unknown"))
    temperature = getattr(self, "temperature", None)
    
    # Try to determine provider from class name
    provider = _infer_provider(self.__class__.__name__)
    
    start_time = time.perf_counter()
    
    if is_async:
        async def async_call():
            try:
                result = await original_fn(self, messages, stop, run_manager, **kwargs)
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                await _record_chat_call(ctx, model, provider, messages, result, temperature, duration_ms)
                
                return result
            except Exception as e:
                await ctx.record_error(
                    error_type=type(e).__name__,
                    error_message=str(e),
                )
                raise
        
        return async_call()
    else:
        try:
            result = original_fn(self, messages, stop, run_manager, **kwargs)
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                _record_chat_call(ctx, model, provider, messages, result, temperature, duration_ms)
            )
            loop.close()
            
            return result
        except Exception as e:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                ctx.record_error(error_type=type(e).__name__, error_message=str(e))
            )
            loop.close()
            raise


def _wrap_llm_generate(
    client: AgentOps,
    original_fn: Callable,
    self: Any,
    prompts: list[str],
    stop: Any,
    run_manager: Any,
    kwargs: dict[str, Any],
    is_async: bool,
) -> Any:
    """Wrap an LLM generate call."""
    from agentops.context import get_current_trace
    
    ctx = get_current_trace()
    
    if ctx is None or client.is_disabled:
        if is_async:
            return original_fn(self, prompts, stop, run_manager, **kwargs)
        else:
            return original_fn(self, prompts, stop, run_manager, **kwargs)
    
    model = getattr(self, "model_name", getattr(self, "model", "unknown"))
    temperature = getattr(self, "temperature", None)
    provider = _infer_provider(self.__class__.__name__)
    
    start_time = time.perf_counter()
    
    if is_async:
        async def async_call():
            try:
                result = await original_fn(self, prompts, stop, run_manager, **kwargs)
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                await _record_llm_call(ctx, model, provider, prompts, result, temperature, duration_ms)
                
                return result
            except Exception as e:
                await ctx.record_error(
                    error_type=type(e).__name__,
                    error_message=str(e),
                )
                raise
        
        return async_call()
    else:
        try:
            result = original_fn(self, prompts, stop, run_manager, **kwargs)
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                _record_llm_call(ctx, model, provider, prompts, result, temperature, duration_ms)
            )
            loop.close()
            
            return result
        except Exception as e:
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                ctx.record_error(error_type=type(e).__name__, error_message=str(e))
            )
            loop.close()
            raise


def _wrap_tool_run(
    client: AgentOps,
    original_fn: Callable,
    self: Any,
    tool_input: Any,
    verbose: Any,
    callbacks: Any,
    kwargs: dict[str, Any],
    is_async: bool,
) -> Any:
    """Wrap a tool run call."""
    from agentops.context import get_current_trace
    
    ctx = get_current_trace()
    
    if ctx is None or client.is_disabled:
        if is_async:
            return original_fn(self, tool_input, verbose, None, None, callbacks, **kwargs)
        else:
            return original_fn(self, tool_input, verbose, None, None, callbacks, **kwargs)
    
    tool_name = getattr(self, "name", self.__class__.__name__)
    
    # Serialize input
    if isinstance(tool_input, dict):
        input_data = tool_input
    else:
        input_data = {"input": str(tool_input)}
    
    start_time = time.perf_counter()
    
    if is_async:
        async def async_call():
            error = None
            result = None
            try:
                result = await original_fn(self, tool_input, verbose, None, None, callbacks, **kwargs)
                return result
            except Exception as e:
                error = str(e)
                raise
            finally:
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                output = {"output": str(result)} if result else None
                
                await ctx.record_tool_call(
                    tool_name=tool_name,
                    input=input_data,
                    output=output,
                    error=error,
                    duration_ms=duration_ms,
                )
        
        return async_call()
    else:
        error = None
        result = None
        try:
            result = original_fn(self, tool_input, verbose, None, None, callbacks, **kwargs)
            return result
        except Exception as e:
            error = str(e)
            raise
        finally:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            
            output = {"output": str(result)} if result else None
            
            loop = asyncio.new_event_loop()
            loop.run_until_complete(
                ctx.record_tool_call(
                    tool_name=tool_name,
                    input=input_data,
                    output=output,
                    error=error,
                    duration_ms=duration_ms,
                )
            )
            loop.close()


async def _record_chat_call(
    ctx,
    model: str,
    provider: str | None,
    messages: list,
    result: Any,
    temperature: float | None,
    duration_ms: int,
) -> None:
    """Record a LangChain chat model call."""
    # Extract messages content
    input_messages = []
    for msg in messages:
        if hasattr(msg, "content"):
            input_messages.append({
                "role": getattr(msg, "type", "unknown"),
                "content": msg.content,
            })
    
    # Extract output
    output_content = None
    if hasattr(result, "generations") and result.generations:
        gen = result.generations[0][0] if result.generations[0] else None
        if gen and hasattr(gen, "message"):
            output_content = {
                "role": getattr(gen.message, "type", "assistant"),
                "content": gen.message.content,
            }
    
    # Extract token usage if available
    input_tokens = None
    output_tokens = None
    if hasattr(result, "llm_output") and result.llm_output:
        usage = result.llm_output.get("token_usage", {})
        input_tokens = usage.get("prompt_tokens")
        output_tokens = usage.get("completion_tokens")
    
    await ctx.record_llm_call(
        model=model,
        provider=provider,
        input={"messages": input_messages},
        output=output_content,
        temperature=temperature,
        duration_ms=duration_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


async def _record_llm_call(
    ctx,
    model: str,
    provider: str | None,
    prompts: list[str],
    result: Any,
    temperature: float | None,
    duration_ms: int,
) -> None:
    """Record a LangChain LLM call."""
    # Extract output
    output_texts = []
    if hasattr(result, "generations") and result.generations:
        for gen_list in result.generations:
            for gen in gen_list:
                if hasattr(gen, "text"):
                    output_texts.append(gen.text)
    
    await ctx.record_llm_call(
        model=model,
        provider=provider,
        input={"prompts": prompts},
        output={"outputs": output_texts},
        temperature=temperature,
        duration_ms=duration_ms,
    )


def _infer_provider(class_name: str) -> str | None:
    """Infer provider from LangChain class name."""
    class_name = class_name.lower()
    
    if "openai" in class_name:
        return "openai"
    elif "anthropic" in class_name or "claude" in class_name:
        return "anthropic"
    elif "google" in class_name or "gemini" in class_name or "palm" in class_name:
        return "google"
    elif "bedrock" in class_name:
        return "aws_bedrock"
    elif "azure" in class_name:
        return "azure_openai"
    elif "cohere" in class_name:
        return "cohere"
    elif "mistral" in class_name:
        return "mistral"
    elif "together" in class_name:
        return "together"
    elif "groq" in class_name:
        return "groq"
    
    return None
