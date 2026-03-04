"""
Input Validation Utilities

Strict validators for all user input to prevent injection attacks.
"""

import re
import html
from typing import Annotated, Any

from pydantic import BeforeValidator, AfterValidator, field_validator
from pydantic.functional_validators import PlainValidator


# ============================================================================
# Constants
# ============================================================================

EMAIL_MAX_LENGTH = 255
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128
AGENT_ID_MAX_LENGTH = 100
TASK_INPUT_MAX_LENGTH = 50000
BATCH_MAX_SIZE = 500

# Regex patterns
AGENT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
ALPHANUMERIC_PATTERN = re.compile(r"^[a-zA-Z0-9]+$")
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

# HTML tag stripper
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")


# ============================================================================
# Sanitization Functions
# ============================================================================

def strip_html_tags(value: str) -> str:
    """Remove all HTML tags from a string."""
    if not isinstance(value, str):
        return value
    # First unescape HTML entities, then remove tags
    cleaned = HTML_TAG_PATTERN.sub("", value)
    # Escape any remaining special characters
    return html.escape(cleaned)


def sanitize_string(value: str) -> str:
    """
    Sanitize a string input.
    
    - Strips leading/trailing whitespace
    - Removes HTML tags
    - Normalizes whitespace
    """
    if not isinstance(value, str):
        return value
    
    # Strip whitespace
    value = value.strip()
    
    # Remove HTML tags
    value = strip_html_tags(value)
    
    # Normalize internal whitespace (collapse multiple spaces)
    value = re.sub(r"\s+", " ", value)
    
    return value


def sanitize_dict(data: dict[str, Any]) -> dict[str, Any]:
    """Recursively sanitize all string values in a dictionary."""
    if not isinstance(data, dict):
        return data
    
    result = {}
    for key, value in data.items():
        if isinstance(value, str):
            result[key] = sanitize_string(value)
        elif isinstance(value, dict):
            result[key] = sanitize_dict(value)
        elif isinstance(value, list):
            result[key] = [
                sanitize_dict(item) if isinstance(item, dict)
                else sanitize_string(item) if isinstance(item, str)
                else item
                for item in value
            ]
        else:
            result[key] = value
    return result


# ============================================================================
# Validation Functions
# ============================================================================

def validate_email(value: str) -> str:
    """Validate email format and length."""
    value = value.strip().lower()
    
    if len(value) > EMAIL_MAX_LENGTH:
        raise ValueError(f"Email must be at most {EMAIL_MAX_LENGTH} characters")
    
    # Basic email format check (Pydantic's EmailStr does detailed validation)
    if "@" not in value or "." not in value.split("@")[-1]:
        raise ValueError("Invalid email format")
    
    return value


def validate_password(value: str) -> str:
    """
    Validate password strength.
    
    Requirements:
    - Minimum 8 characters
    - Maximum 128 characters
    - At least 1 uppercase letter
    - At least 1 number
    """
    if len(value) < PASSWORD_MIN_LENGTH:
        raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters")
    
    if len(value) > PASSWORD_MAX_LENGTH:
        raise ValueError(f"Password must be at most {PASSWORD_MAX_LENGTH} characters")
    
    if not re.search(r"[A-Z]", value):
        raise ValueError("Password must contain at least one uppercase letter")
    
    if not re.search(r"[0-9]", value):
        raise ValueError("Password must contain at least one number")
    
    return value


def validate_agent_id(value: str) -> str:
    """
    Validate agent ID format.
    
    Requirements:
    - Alphanumeric with hyphens and underscores
    - Maximum 100 characters
    - Must start with alphanumeric
    """
    value = value.strip()
    
    if len(value) > AGENT_ID_MAX_LENGTH:
        raise ValueError(f"Agent ID must be at most {AGENT_ID_MAX_LENGTH} characters")
    
    if not AGENT_ID_PATTERN.match(value):
        raise ValueError("Agent ID must be alphanumeric with hyphens/underscores, starting with a letter or number")
    
    return value


def validate_positive_decimal(value: float) -> float:
    """Validate that a decimal value is positive."""
    if value < 0:
        raise ValueError("Value must be positive")
    return value


def validate_task_input(value: str | dict[str, Any]) -> str | dict[str, Any]:
    """Validate task input size."""
    if isinstance(value, str):
        if len(value) > TASK_INPUT_MAX_LENGTH:
            raise ValueError(f"Task input must be at most {TASK_INPUT_MAX_LENGTH} characters")
        return sanitize_string(value)
    elif isinstance(value, dict):
        # Check serialized size
        import json
        serialized = json.dumps(value)
        if len(serialized) > TASK_INPUT_MAX_LENGTH:
            raise ValueError(f"Task input must be at most {TASK_INPUT_MAX_LENGTH} characters when serialized")
        return sanitize_dict(value)
    return value


def validate_batch_size(items: list) -> list:
    """Validate that a batch doesn't exceed maximum size."""
    if len(items) > BATCH_MAX_SIZE:
        raise ValueError(f"Batch size must be at most {BATCH_MAX_SIZE} items")
    return items


# ============================================================================
# Pydantic Annotated Types
# ============================================================================

# Sanitized string that strips HTML
SanitizedStr = Annotated[str, AfterValidator(sanitize_string)]

# Strong password
StrongPassword = Annotated[str, AfterValidator(validate_password)]

# Valid agent ID
ValidAgentId = Annotated[str, AfterValidator(validate_agent_id)]

# Positive decimal
PositiveDecimal = Annotated[float, AfterValidator(validate_positive_decimal)]

# Valid email with length check
ValidEmail = Annotated[str, AfterValidator(validate_email)]


# ============================================================================
# Pydantic Field Validators (for use in models)
# ============================================================================

def make_password_validator():
    """Create a password field validator for Pydantic models."""
    def validator(cls, v: str) -> str:
        return validate_password(v)
    return field_validator("password", "new_password", mode="after")(classmethod(validator))


def make_email_validator():
    """Create an email field validator for Pydantic models."""
    def validator(cls, v: str) -> str:
        return validate_email(v)
    return field_validator("email", mode="after")(classmethod(validator))


def make_agent_id_validator():
    """Create an agent_id field validator for Pydantic models."""
    def validator(cls, v: str) -> str:
        return validate_agent_id(v)
    return field_validator("agent_id", mode="after")(classmethod(validator))


def make_cost_validator():
    """Create a cost field validator for Pydantic models."""
    def validator(cls, v: float | None) -> float | None:
        if v is not None:
            return validate_positive_decimal(v)
        return v
    return field_validator("cost_usd", "cost", mode="after")(classmethod(validator))
