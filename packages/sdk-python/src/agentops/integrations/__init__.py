"""
Framework integrations for auto-instrumentation.
"""

from agentops.integrations.langchain import patch as patch_langchain
from agentops.integrations.openai import patch as patch_openai
from agentops.integrations.anthropic import patch as patch_anthropic

__all__ = [
    "patch_langchain",
    "patch_openai",
    "patch_anthropic",
]
