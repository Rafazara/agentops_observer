"""
Authentication Routes

Handles user registration, login, token refresh, and API key management.
"""

from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

from app.core.config import settings
from app.core.database import db, Database, get_db
from app.core.cache import cache, RedisCache, get_cache
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    generate_api_key,
    verify_api_key,
    generate_token_hash,
)
from app.models.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    CurrentUser,
    ChangePasswordRequest,
)
from app.models import APIKey, APIKeyCreate, APIKeyCreated, SuccessResponse

logger = structlog.get_logger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


# ============================================================================
# Dependencies
# ============================================================================

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
    database: Database = Depends(get_db),
) -> CurrentUser:
    """
    Validate authentication and return current user.
    
    Supports both JWT tokens and API keys.
    """
    user_data = None
    
    # Try JWT token first
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id:
                user_data = await database.fetch_one(
                    """
                    SELECT u.*, o.name as organization_name, o.slug as organization_slug
                    FROM users u
                    JOIN organizations o ON u.org_id = o.id
                    WHERE u.id = $1 AND u.is_active = TRUE
                    """,
                    UUID(user_id),
                )
    
    # Try API key
    elif x_api_key:
        # Get key by prefix
        prefix = x_api_key[:20]
        key_record = await database.fetch_one(
            """
            SELECT ak.*, u.*, o.name as organization_name, o.slug as organization_slug
            FROM api_keys ak
            JOIN users u ON ak.user_id = u.id
            JOIN organizations o ON u.org_id = o.id
            WHERE ak.key_prefix = $1 AND ak.revoked_at IS NULL
              AND u.is_active = TRUE
              AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
            """,
            prefix,
        )
        
        if key_record and verify_api_key(x_api_key, key_record["key_hash"]):
            # Update last used
            await database.execute(
                "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
                key_record["id"],
            )
            user_data = key_record
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return CurrentUser(
        id=user_data["id"],
        email=user_data["email"],
        name=user_data["name"],
        role=user_data["role"],
        org_id=user_data["org_id"],
        organization_name=user_data["organization_name"],
        organization_slug=user_data["organization_slug"],
        is_active=user_data["is_active"],
        last_login_at=user_data.get("last_login_at"),
        created_at=user_data["created_at"],
    )


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Require admin or owner role."""
    if current_user.role not in ["admin", "owner"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ============================================================================
# Registration
# ============================================================================

@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register new organization and user",
    responses={
        409: {"description": "Email or organization slug already exists"},
    },
)
async def register(
    request: RegisterRequest,
    database: Database = Depends(get_db),
):
    """
    Register a new organization with an owner user.
    
    Creates both the organization and the first user (as owner).
    """
    async with database.transaction() as conn:
        # Check if email exists
        existing_email = await conn.fetchrow(
            "SELECT id FROM users WHERE email = $1",
            request.email,
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        
        # Check if slug exists
        existing_slug = await conn.fetchrow(
            "SELECT id FROM organizations WHERE slug = $1",
            request.organization_slug,
        )
        if existing_slug:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Organization slug already taken",
            )
        
        # Create organization
        org = await conn.fetchrow(
            """
            INSERT INTO organizations (name, slug, plan)
            VALUES ($1, $2, 'starter')
            RETURNING id, name, slug
            """,
            request.organization_name,
            request.organization_slug,
        )
        
        # Create user
        password_hash = hash_password(request.password)
        user = await conn.fetchrow(
            """
            INSERT INTO users (org_id, email, name, password_hash, role)
            VALUES ($1, $2, $3, $4, 'owner')
            RETURNING id, email, name
            """,
            org["id"],
            request.email,
            request.name,
            password_hash,
        )
        
        logger.info(
            "New organization registered",
            org_id=str(org["id"]),
            user_id=str(user["id"]),
        )
        
        return RegisterResponse(
            user_id=user["id"],
            org_id=org["id"],
            email=user["email"],
            name=user["name"],
            organization_name=org["name"],
            organization_slug=org["slug"],
        )


# ============================================================================
# Login
# ============================================================================

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email and password",
    responses={
        401: {"description": "Invalid credentials"},
    },
)
async def login(
    request: LoginRequest,
    database: Database = Depends(get_db),
):
    """
    Authenticate user and return access and refresh tokens.
    """
    # Find user
    user = await database.fetch_one(
        """
        SELECT u.*, o.name as organization_name, o.slug as organization_slug
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        WHERE u.email = $1 AND u.is_active = TRUE
        """,
        request.email,
    )
    
    if not user or not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    # Update last login
    await database.execute(
        "UPDATE users SET last_login_at = NOW() WHERE id = $1",
        user["id"],
    )
    
    # Create tokens
    access_token = create_access_token({"sub": str(user["id"])})
    refresh_token = create_refresh_token({"sub": str(user["id"])})
    
    # Store refresh token hash
    token_hash = generate_token_hash(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    await database.execute(
        """
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        """,
        user["id"],
        token_hash,
        expires_at,
    )
    
    logger.info("User logged in", user_id=str(user["id"]))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


# ============================================================================
# Token Refresh
# ============================================================================

@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
    responses={
        401: {"description": "Invalid or expired refresh token"},
    },
)
async def refresh_token(
    request: RefreshRequest,
    database: Database = Depends(get_db),
):
    """
    Exchange a valid refresh token for a new access token.
    """
    # Validate refresh token
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    user_id = payload.get("sub")
    token_hash = generate_token_hash(request.refresh_token)
    
    # Check if token exists and is valid
    stored_token = await database.fetch_one(
        """
        SELECT id FROM refresh_tokens
        WHERE user_id = $1 AND token_hash = $2 
          AND expires_at > NOW() AND revoked_at IS NULL
        """,
        UUID(user_id),
        token_hash,
    )
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found or expired",
        )
    
    # Revoke old token
    await database.execute(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
        stored_token["id"],
    )
    
    # Create new tokens
    access_token = create_access_token({"sub": user_id})
    new_refresh_token = create_refresh_token({"sub": user_id})
    
    # Store new refresh token
    new_token_hash = generate_token_hash(new_refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.jwt_refresh_token_expire_days
    )
    await database.execute(
        """
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        """,
        UUID(user_id),
        new_token_hash,
        expires_at,
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


# ============================================================================
# Current User
# ============================================================================

@router.get(
    "/me",
    response_model=CurrentUser,
    summary="Get current user info",
)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get information about the currently authenticated user.
    """
    return current_user


@router.put(
    "/me/password",
    response_model=SuccessResponse,
    summary="Change password",
)
async def change_password(
    request: ChangePasswordRequest,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Change the current user's password.
    """
    # Verify current password
    user = await database.fetch_one(
        "SELECT password_hash FROM users WHERE id = $1",
        current_user.id,
    )
    
    if not verify_password(request.current_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    
    # Update password
    new_hash = hash_password(request.new_password)
    await database.execute(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        new_hash,
        current_user.id,
    )
    
    # Revoke all refresh tokens
    await database.execute(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1",
        current_user.id,
    )
    
    logger.info("Password changed", user_id=str(current_user.id))
    
    return SuccessResponse(message="Password changed successfully")


# ============================================================================
# API Keys
# ============================================================================

@router.get(
    "/api-keys",
    response_model=list[APIKey],
    summary="List API keys",
)
async def list_api_keys(
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    List all API keys for the current user.
    """
    keys = await database.fetch_all(
        """
        SELECT id, name, key_prefix, scopes, last_used_at, created_at
        FROM api_keys
        WHERE user_id = $1 AND revoked_at IS NULL
        ORDER BY created_at DESC
        """,
        current_user.id,
    )
    
    return [APIKey(**dict(k)) for k in keys]


@router.post(
    "/api-keys",
    response_model=APIKeyCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Create API key",
)
async def create_api_key(
    request: APIKeyCreate,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Create a new API key.
    
    The full key is only shown once in the response. Store it securely.
    """
    full_key, prefix, key_hash = generate_api_key()
    
    key = await database.fetch_one(
        """
        INSERT INTO api_keys (org_id, user_id, name, key_prefix, key_hash, scopes)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, key_prefix, scopes, created_at
        """,
        current_user.org_id,
        current_user.id,
        request.name,
        prefix,
        key_hash,
        request.scopes,
    )
    
    logger.info(
        "API key created",
        user_id=str(current_user.id),
        key_prefix=prefix,
    )
    
    return APIKeyCreated(
        id=key["id"],
        name=key["name"],
        key=full_key,  # Only time full key is shown
        key_prefix=key["key_prefix"],
        scopes=key["scopes"],
        created_at=key["created_at"],
    )


@router.delete(
    "/api-keys/{key_id}",
    response_model=SuccessResponse,
    summary="Revoke API key",
)
async def revoke_api_key(
    key_id: UUID,
    current_user: CurrentUser = Depends(get_current_user),
    database: Database = Depends(get_db),
):
    """
    Revoke an API key.
    """
    result = await database.execute(
        """
        UPDATE api_keys 
        SET revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        """,
        key_id,
        current_user.id,
    )
    
    if "UPDATE 0" in result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found",
        )
    
    logger.info(
        "API key revoked",
        user_id=str(current_user.id),
        key_id=str(key_id),
    )
    
    return SuccessResponse(message="API key revoked")
