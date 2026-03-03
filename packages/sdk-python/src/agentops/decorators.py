"""
Decorators for tracing agent functions.
"""

from __future__ import annotations

import asyncio
import functools
import time
import traceback
from typing import Any, Callable, TypeVar, ParamSpec

from agentops.context import TraceContext, get_current_trace
from agentops.models import ExecutionStatus

P = ParamSpec("P")
T = TypeVar("T")


def trace(
    agent_id: str | None = None,
    *,
    version: str | None = None,
    environment: str | None = None,
    project_id: str | None = None,
    capture_input: bool = True,
    capture_output: bool = True,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator for tracing async functions as agent executions.
    
    Args:
        agent_id: Agent identifier. If None, uses the function name.
        version: Agent version string.
        environment: Environment name.
        project_id: Project UUID string.
        capture_input: Whether to capture function arguments as task_input.
        capture_output: Whether to capture return value as final_output.
    
    Example:
        >>> @agentops.trace(agent_id="my-agent")
        ... async def run_agent(task: str):
        ...     return await process(task)
        
        >>> @agentops.trace()  # Uses function name as agent_id
        ... async def process_data(data: dict):
        ...     return transform(data)
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        # Determine agent_id
        _agent_id = agent_id or func.__name__
        
        @functools.wraps(func)
        async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            import agentops
            
            client = agentops.get_client()
            
            # Check sampling
            if not client.should_sample():
                return await func(*args, **kwargs)
            
            # Prepare task input
            task_input = None
            if capture_input:
                task_input = _capture_args(func, args, kwargs)
            
            # Create trace
            ctx = client.create_trace(
                agent_id=_agent_id,
                version=version,
                environment=environment,
                project_id=project_id,
                task_input=task_input,
            )
            
            async with ctx:
                try:
                    result = await func(*args, **kwargs)
                    
                    # Capture output
                    if capture_output:
                        output = _serialize_output(result)
                        ctx.set_output(output)
                    
                    return result
                    
                except Exception as e:
                    # Record error
                    await ctx.record_error(
                        error_type=type(e).__name__,
                        error_message=str(e),
                        traceback=traceback.format_exc(),
                    )
                    raise
        
        @functools.wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            # For sync functions, run in event loop
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))
        
        # Return appropriate wrapper
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def _capture_args(
    func: Callable,
    args: tuple,
    kwargs: dict[str, Any],
) -> dict[str, Any]:
    """Capture function arguments as a dictionary."""
    import inspect
    
    sig = inspect.signature(func)
    bound = sig.bind(*args, **kwargs)
    bound.apply_defaults()
    
    result = {}
    for param_name, value in bound.arguments.items():
        # Skip self/cls
        if param_name in ("self", "cls"):
            continue
        
        # Serialize the value
        result[param_name] = _serialize_value(value)
    
    return result


def _serialize_value(value: Any) -> Any:
    """Serialize a value for JSON."""
    if value is None:
        return None
    
    if isinstance(value, (str, int, float, bool)):
        return value
    
    if isinstance(value, (list, tuple)):
        return [_serialize_value(v) for v in value]
    
    if isinstance(value, dict):
        return {str(k): _serialize_value(v) for k, v in value.items()}
    
    # For other types, try to convert to dict or string
    if hasattr(value, "model_dump"):
        return value.model_dump()
    
    if hasattr(value, "__dict__"):
        return {k: _serialize_value(v) for k, v in value.__dict__.items() if not k.startswith("_")}
    
    return str(value)


def _serialize_output(value: Any) -> dict[str, Any]:
    """Serialize function output."""
    if value is None:
        return {"result": None}
    
    if isinstance(value, dict):
        return value
    
    serialized = _serialize_value(value)
    
    if isinstance(serialized, dict):
        return serialized
    
    return {"result": serialized}


def trace_tool(
    tool_name: str | None = None,
    *,
    capture_input: bool = True,
    capture_output: bool = True,
) -> Callable[[Callable[P, T]], Callable[P, T]]:
    """
    Decorator for tracing tool functions within an agent execution.
    
    Args:
        tool_name: Tool name. If None, uses the function name.
        capture_input: Whether to capture function arguments.
        capture_output: Whether to capture return value.
    
    Example:
        >>> @agentops.trace_tool(tool_name="web_search")
        ... async def search(query: str) -> list[str]:
        ...     return await web_search_api(query)
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        _tool_name = tool_name or func.__name__
        
        @functools.wraps(func)
        async def async_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            ctx = get_current_trace()
            
            if ctx is None:
                # No active trace, just call the function
                return await func(*args, **kwargs)
            
            # Capture input
            tool_input = {}
            if capture_input:
                tool_input = _capture_args(func, args, kwargs)
            
            start_time = time.perf_counter()
            error = None
            result = None
            
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                error = str(e)
                raise
            finally:
                duration_ms = int((time.perf_counter() - start_time) * 1000)
                
                # Capture output
                tool_output = None
                if capture_output and result is not None:
                    tool_output = _serialize_output(result)
                
                # Record tool call
                await ctx.record_tool_call(
                    tool_name=_tool_name,
                    input=tool_input,
                    output=tool_output,
                    error=error,
                    duration_ms=duration_ms,
                )
        
        @functools.wraps(func)
        def sync_wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            loop = asyncio.get_event_loop()
            return loop.run_until_complete(async_wrapper(*args, **kwargs))
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator
