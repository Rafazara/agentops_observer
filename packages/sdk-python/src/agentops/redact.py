"""
PII redaction utilities.
"""

import re
from typing import Any


# PII detection patterns
PII_PATTERNS = {
    "email": re.compile(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
    ),
    "phone": re.compile(
        r"\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b"
    ),
    "ssn": re.compile(
        r"\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b"
    ),
    "credit_card": re.compile(
        r"\b(?:\d{4}[-\s]?){3}\d{4}\b"
    ),
    "api_key": re.compile(
        r"\b(?:sk-|pk-|api[_-]?key[=:]\s*)[\w-]{20,}\b",
        re.IGNORECASE,
    ),
    "bearer_token": re.compile(
        r"\b[Bb]earer\s+[\w.-]+\b"
    ),
    "ip_address": re.compile(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
    ),
}

REDACTED = "[REDACTED]"


def redact_pii(text: str, patterns: list[str] | None = None) -> str:
    """
    Redact PII from text.
    
    Args:
        text: Text to redact.
        patterns: List of pattern names to use. If None, uses all patterns.
    
    Returns:
        Text with PII redacted.
    """
    if not text or not isinstance(text, str):
        return text
    
    active_patterns = patterns or list(PII_PATTERNS.keys())
    
    for pattern_name in active_patterns:
        if pattern_name in PII_PATTERNS:
            text = PII_PATTERNS[pattern_name].sub(REDACTED, text)
    
    return text


def redact_dict(data: dict[str, Any], patterns: list[str] | None = None) -> dict[str, Any]:
    """
    Recursively redact PII from a dictionary.
    
    Args:
        data: Dictionary to redact.
        patterns: List of pattern names to use.
    
    Returns:
        Dictionary with PII redacted.
    """
    if not isinstance(data, dict):
        return data
    
    result = {}
    
    for key, value in data.items():
        # Check for sensitive key names
        sensitive_keys = {"password", "secret", "token", "api_key", "apikey", "authorization"}
        if key.lower() in sensitive_keys:
            result[key] = REDACTED
        elif isinstance(value, str):
            result[key] = redact_pii(value, patterns)
        elif isinstance(value, dict):
            result[key] = redact_dict(value, patterns)
        elif isinstance(value, list):
            result[key] = redact_list(value, patterns)
        else:
            result[key] = value
    
    return result


def redact_list(data: list[Any], patterns: list[str] | None = None) -> list[Any]:
    """
    Recursively redact PII from a list.
    
    Args:
        data: List to redact.
        patterns: List of pattern names to use.
    
    Returns:
        List with PII redacted.
    """
    if not isinstance(data, list):
        return data
    
    result = []
    
    for item in data:
        if isinstance(item, str):
            result.append(redact_pii(item, patterns))
        elif isinstance(item, dict):
            result.append(redact_dict(item, patterns))
        elif isinstance(item, list):
            result.append(redact_list(item, patterns))
        else:
            result.append(item)
    
    return result
