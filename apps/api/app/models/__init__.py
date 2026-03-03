"""
Pydantic Models - Shared Types

Common types and base models used across the application.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Enums
# ============================================================================

class EnvironmentType(str, Enum):
    """Execution environment."""
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"


class ExecutionStatus(str, Enum):
    """Agent execution status."""
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    LOOP_DETECTED = "loop_detected"
    TIMEOUT = "timeout"
    CANCELLED = "cancelled"


class EventType(str, Enum):
    """Execution event types."""
    LLM_CALL = "llm_call"
    TOOL_CALL = "tool_call"
    MEMORY_READ = "memory_read"
    MEMORY_WRITE = "memory_write"
    PLANNING_STEP = "planning_step"
    SUBAGENT_CALL = "subagent_call"
    ERROR = "error"
    CHECKPOINT = "checkpoint"
    CUSTOM = "custom"


class IncidentSeverity(str, Enum):
    """Incident severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    WARNING = "warning"
    LOW = "low"
    INFO = "info"


class IncidentStatus(str, Enum):
    """Incident status."""
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class UserRole(str, Enum):
    """User role in organization."""
    OWNER = "owner"
    ADMIN = "admin"
    DEVELOPER = "developer"
    VIEWER = "viewer"


class PlanType(str, Enum):
    """Subscription plan types."""
    STARTER = "starter"
    GROWTH = "growth"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class FrameworkType(str, Enum):
    """AI agent frameworks."""
    LANGCHAIN = "langchain"
    AUTOGEN = "autogen"
    CREWAI = "crewai"
    SEMANTIC_KERNEL = "semantic_kernel"
    OPENAI_ASSISTANTS = "openai_assistants"
    ANTHROPIC_TOOLS = "anthropic_tools"
    CUSTOM = "custom"


class ProviderType(str, Enum):
    """LLM providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    AZURE_OPENAI = "azure_openai"
    AWS_BEDROCK = "aws_bedrock"
    COHERE = "cohere"
    MISTRAL = "mistral"
    TOGETHER = "together"
    GROQ = "groq"
    LOCAL = "local"
    CUSTOM = "custom"


# ============================================================================
# Base Models
# ============================================================================

class BaseSchema(BaseModel):
    """Base schema with common configuration."""
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        use_enum_values=True,
    )


class TimestampMixin(BaseModel):
    """Mixin for created/updated timestamps."""
    created_at: datetime
    updated_at: datetime | None = None


# ============================================================================
# Pagination
# ============================================================================

T = TypeVar("T")


class CursorPagination(BaseModel):
    """Cursor-based pagination parameters."""
    cursor: str | None = Field(None, description="Cursor for next page")
    limit: int = Field(50, ge=1, le=100, description="Items per page")


class PaginatedResponse(BaseSchema, Generic[T]):
    """Paginated response wrapper."""
    data: list[T]
    next_cursor: str | None = None
    has_more: bool = False
    total: int | None = None


# ============================================================================
# Common Response Models
# ============================================================================

class HealthResponse(BaseSchema):
    """Health check response."""
    status: str
    version: str
    database: bool
    redis: bool
    kafka: bool


class ErrorResponse(BaseSchema):
    """Error response model."""
    error: str
    message: str
    detail: Any | None = None
    request_id: str | None = None


class SuccessResponse(BaseSchema):
    """Generic success response."""
    success: bool = True
    message: str | None = None


# ============================================================================
# Organization & User Models
# ============================================================================

class OrganizationBase(BaseSchema):
    """Organization base schema."""
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z0-9-]+$")


class OrganizationCreate(OrganizationBase):
    """Create organization request."""
    pass


class Organization(OrganizationBase, TimestampMixin):
    """Organization response."""
    id: UUID
    plan: PlanType
    settings: dict[str, Any] = Field(default_factory=dict)


class UserBase(BaseSchema):
    """User base schema."""
    email: str = Field(..., max_length=255)
    name: str = Field(..., min_length=1, max_length=255)


class UserCreate(UserBase):
    """Create user request."""
    password: str = Field(..., min_length=8)
    role: UserRole = UserRole.DEVELOPER


class User(UserBase, TimestampMixin):
    """User response (without sensitive data)."""
    id: UUID
    org_id: UUID
    role: UserRole
    is_active: bool
    last_login_at: datetime | None = None


class UserWithOrg(User):
    """User with organization details."""
    organization: Organization


# ============================================================================
# Project & Agent Models
# ============================================================================

class ProjectBase(BaseSchema):
    """Project base schema."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class ProjectCreate(ProjectBase):
    """Create project request."""
    pass


class Project(ProjectBase, TimestampMixin):
    """Project response."""
    id: UUID
    org_id: UUID
    settings: dict[str, Any] = Field(default_factory=dict)


class AgentBase(BaseSchema):
    """Agent base schema."""
    agent_id: str = Field(..., min_length=1, max_length=255)
    display_name: str | None = None
    framework: FrameworkType = FrameworkType.CUSTOM
    tags: list[str] = Field(default_factory=list)


class AgentCreate(AgentBase):
    """Create agent request."""
    project_id: UUID | None = None


class AgentUpdate(BaseSchema):
    """Update agent request."""
    display_name: str | None = None
    framework: FrameworkType | None = None
    tags: list[str] | None = None
    metadata: dict[str, Any] | None = None


class Agent(AgentBase):
    """Agent response."""
    id: UUID
    org_id: UUID
    project_id: UUID | None
    current_version: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime | None
    last_execution_at: datetime | None


# ============================================================================
# API Key Models
# ============================================================================

class APIKeyCreate(BaseSchema):
    """Create API key request."""
    name: str = Field(..., min_length=1, max_length=255)
    scopes: list[str] = Field(default=["read", "write"])


class APIKeyCreated(BaseSchema):
    """API key creation response (includes full key, shown once)."""
    id: UUID
    name: str
    key: str  # Full key, shown only once
    key_prefix: str
    scopes: list[str]
    created_at: datetime


class APIKey(BaseSchema):
    """API key response (without full key)."""
    id: UUID
    name: str
    key_prefix: str
    scopes: list[str]
    last_used_at: datetime | None
    created_at: datetime
