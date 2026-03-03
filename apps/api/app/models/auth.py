"""
Auth Models

Pydantic models for authentication and authorization.
"""

from datetime import datetime
from uuid import UUID

from pydantic import Field, EmailStr

from app.models import BaseSchema, UserRole


# ============================================================================
# Registration
# ============================================================================

class RegisterRequest(BaseSchema):
    """User registration request."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=255)
    organization_name: str = Field(..., min_length=1, max_length=255)
    organization_slug: str = Field(
        ..., 
        min_length=1, 
        max_length=100,
        pattern=r"^[a-z0-9-]+$",
    )


class RegisterResponse(BaseSchema):
    """Registration response."""
    user_id: UUID
    org_id: UUID
    email: str
    name: str
    organization_name: str
    organization_slug: str


# ============================================================================
# Login
# ============================================================================

class LoginRequest(BaseSchema):
    """Login request."""
    email: EmailStr
    password: str


class TokenResponse(BaseSchema):
    """Token response for login/refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshRequest(BaseSchema):
    """Token refresh request."""
    refresh_token: str


# ============================================================================
# Current User
# ============================================================================

class CurrentUser(BaseSchema):
    """Current authenticated user info."""
    id: UUID
    email: str
    name: str
    role: UserRole
    
    org_id: UUID
    organization_name: str
    organization_slug: str
    
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime


# ============================================================================
# Password
# ============================================================================

class ChangePasswordRequest(BaseSchema):
    """Change password request."""
    current_password: str
    new_password: str = Field(..., min_length=8)


class ResetPasswordRequest(BaseSchema):
    """Request password reset."""
    email: EmailStr


class ResetPasswordConfirm(BaseSchema):
    """Confirm password reset."""
    token: str
    new_password: str = Field(..., min_length=8)
