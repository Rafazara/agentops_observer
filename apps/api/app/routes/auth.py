"""
Authentication Routes

Handles user registration, login, token refresh, and API key management.
"""

import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
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
from app.core.rate_limiter import limiter
from app.models.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    CurrentUser,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    VerifyResetCodeRequest,
    VerifyResetCodeResponse,
    ResetPasswordRequest,
)
from app.models import APIKey, APIKeyCreate, APIKeyCreated, SuccessResponse, BaseSchema

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
        429: {"description": "Rate limit exceeded"},
    },
)
@limiter.limit("3/minute")
async def register(
    request: Request,
    data: RegisterRequest,
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
            data.email,
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )
        
        # Check if slug exists
        existing_slug = await conn.fetchrow(
            "SELECT id FROM organizations WHERE slug = $1",
            data.organization_slug,
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
            data.organization_name,
            data.organization_slug,
        )
        
        # Create user
        password_hash = hash_password(data.password)
        user = await conn.fetchrow(
            """
            INSERT INTO users (org_id, email, name, password_hash, role)
            VALUES ($1, $2, $3, $4, 'owner')
            RETURNING id, email, name
            """,
            org["id"],
            data.email,
            data.name,
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
        429: {"description": "Rate limit exceeded"},
    },
)
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: LoginRequest,
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
        data.email,
    )
    
    if not user or not verify_password(data.password, user["password_hash"]):
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


# ============================================================================
# Password Reset
# ============================================================================

def generate_reset_code() -> str:
    """Generate a 6-digit OTP."""
    return "".join(secrets.choice("0123456789") for _ in range(6))


def send_reset_email(email: str, code: str) -> bool:
    """
    Send password reset email via SMTP.
    
    Returns True if sent successfully, False otherwise.
    """
    smtp_host = settings.__dict__.get("smtp_host", "")
    smtp_port = settings.__dict__.get("smtp_port", 587)
    smtp_user = settings.__dict__.get("smtp_user", "")
    smtp_password = settings.__dict__.get("smtp_password", "")
    
    if not smtp_host:
        logger.warning("SMTP not configured, skipping email", email=email)
        return False
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #09090b;
                color: #fafafa;
                margin: 0;
                padding: 40px 20px;
            }}
            .container {{
                max-width: 480px;
                margin: 0 auto;
                background: #18181b;
                border-radius: 12px;
                padding: 40px;
                border: 1px solid #27272a;
            }}
            .logo {{
                text-align: center;
                margin-bottom: 32px;
            }}
            .logo-text {{
                font-size: 24px;
                font-weight: 700;
                color: #10b981;
            }}
            h1 {{
                font-size: 20px;
                margin: 0 0 16px 0;
                color: #fafafa;
            }}
            p {{
                color: #a1a1aa;
                line-height: 1.6;
                margin: 0 0 24px 0;
            }}
            .code {{
                background: #27272a;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 24px 0;
            }}
            .code-text {{
                font-family: 'SF Mono', Monaco, 'Courier New', monospace;
                font-size: 32px;
                font-weight: 600;
                letter-spacing: 8px;
                color: #10b981;
            }}
            .footer {{
                font-size: 12px;
                color: #71717a;
                text-align: center;
                margin-top: 32px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">
                <span class="logo-text">AgentOps</span> Observer
            </div>
            <h1>Reset your password</h1>
            <p>You requested to reset your password. Use the code below to continue:</p>
            <div class="code">
                <span class="code-text">{code}</span>
            </div>
            <p>This code expires in <strong>15 minutes</strong>.</p>
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
            <div class="footer">
                &copy; 2024 AgentOps Observer. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    """
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Reset your AgentOps password"
        msg["From"] = smtp_user
        msg["To"] = email
        
        text_content = f"Your AgentOps password reset code is: {code}\n\nThis code expires in 15 minutes."
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        logger.info("Reset email sent", email=email)
        return True
        
    except Exception as e:
        logger.error("Failed to send reset email", error=str(e), email=email)
        return False


@router.post(
    "/forgot-password",
    response_model=SuccessResponse,
    summary="Request password reset",
    responses={
        429: {"description": "Rate limit exceeded"},
    },
)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    database: Database = Depends(get_db),
    redis: RedisCache = Depends(get_cache),
):
    """
    Request a password reset code.
    
    Always returns 200 to prevent email enumeration.
    """
    # Check if user exists (but don't reveal this in response)
    user = await database.fetch_one(
        "SELECT id, email FROM users WHERE email = $1 AND is_active = TRUE",
        data.email,
    )
    
    if user:
        # Generate 6-digit OTP
        code = generate_reset_code()
        
        # Store in Redis with 15 min TTL
        key = f"password_reset:{data.email}"
        await redis.set(key, code, ttl_seconds=900)  # 15 minutes
        
        # Send email (async in production)
        send_reset_email(data.email, code)
        
        logger.info("Password reset requested", email=data.email)
    
    # Always return success (prevent enumeration)
    return SuccessResponse(
        message="If an account with that email exists, a reset code has been sent."
    )


@router.post(
    "/verify-reset-code",
    response_model=VerifyResetCodeResponse,
    summary="Verify reset code",
    responses={
        400: {"description": "Invalid or expired code"},
        429: {"description": "Rate limit exceeded"},
    },
)
@limiter.limit("5/minute")
async def verify_reset_code(
    request: Request,
    data: VerifyResetCodeRequest,
    database: Database = Depends(get_db),
    redis: RedisCache = Depends(get_cache),
):
    """
    Verify the reset code and return a reset token.
    """
    # Get stored code
    key = f"password_reset:{data.email}"
    stored_code = await redis.get(key)
    
    if not stored_code or stored_code != data.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code",
        )
    
    # Delete the code (one-time use)
    await redis.delete(key)
    
    # Verify user exists
    user = await database.fetch_one(
        "SELECT id FROM users WHERE email = $1 AND is_active = TRUE",
        data.email,
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code",
        )
    
    # Create a short-lived reset token (10 minutes)
    reset_token = create_access_token(
        {"sub": str(user["id"]), "type": "password_reset"},
        expires_delta=timedelta(minutes=10),
    )
    
    logger.info("Reset code verified", user_id=str(user["id"]))
    
    return VerifyResetCodeResponse(
        reset_token=reset_token,
        expires_in=600,
    )


class ResetPasswordData(BaseSchema):
    """Reset password with token."""
    reset_token: str
    new_password: str = Field(..., min_length=8)


@router.post(
    "/reset-password",
    response_model=SuccessResponse,
    summary="Reset password with token",
    responses={
        400: {"description": "Invalid or expired token"},
        429: {"description": "Rate limit exceeded"},
    },
)
@limiter.limit("3/minute")
async def reset_password(
    request: Request,
    data: ResetPasswordData,
    database: Database = Depends(get_db),
):
    """
    Reset password using the reset token.
    """
    # Validate token
    payload = decode_token(data.reset_token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    
    user_id = payload.get("sub")
    
    # Update password
    new_hash = hash_password(data.new_password)
    result = await database.execute(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        new_hash,
        UUID(user_id),
    )
    
    # Revoke all refresh tokens (invalidate all sessions)
    await database.execute(
        "UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1",
        UUID(user_id),
    )
    
    logger.info("Password reset completed", user_id=user_id)
    
    return SuccessResponse(message="Password reset successfully. Please login with your new password.")


# ============================================================================
# OAuth
# ============================================================================

class OAuthCodeRequest(BaseSchema):
    """OAuth code exchange request."""
    code: str
    redirect_uri: str


@router.post(
    "/oauth/google",
    response_model=TokenResponse,
    summary="Login with Google OAuth",
)
@limiter.limit("10/minute")
async def oauth_google(
    request: Request,
    data: OAuthCodeRequest,
    database: Database = Depends(get_db),
):
    """
    Exchange Google OAuth code for tokens.
    """
    import httpx
    
    google_client_id = settings.__dict__.get("google_client_id", "")
    google_client_secret = settings.__dict__.get("google_client_secret", "")
    
    if not google_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google OAuth not configured",
        )
    
    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": data.code,
                "client_id": google_client_id,
                "client_secret": google_client_secret,
                "redirect_uri": data.redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        
        if token_response.status_code != 200:
            logger.error("Google token exchange failed", response=token_response.text)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange OAuth code",
            )
        
        tokens = token_response.json()
        
        # Get user info
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        
        if user_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Google",
            )
        
        user_info = user_response.json()
    
    email = user_info["email"]
    name = user_info.get("name", email.split("@")[0])
    
    # Find or create user
    user = await database.fetch_one(
        """
        SELECT u.*, o.name as organization_name, o.slug as organization_slug
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        WHERE u.email = $1
        """,
        email,
    )
    
    if not user:
        # Create new user and organization
        async with database.transaction() as conn:
            org_slug = email.split("@")[0].lower().replace(".", "-")[:50]
            # Ensure unique slug
            existing = await conn.fetchrow("SELECT id FROM organizations WHERE slug = $1", org_slug)
            if existing:
                org_slug = f"{org_slug}-{secrets.token_hex(3)}"
            
            org = await conn.fetchrow(
                """
                INSERT INTO organizations (name, slug, plan)
                VALUES ($1, $2, 'starter')
                RETURNING id, name, slug
                """,
                f"{name}'s Workspace",
                org_slug,
            )
            
            user = await conn.fetchrow(
                """
                INSERT INTO users (org_id, email, name, password_hash, role, oauth_provider)
                VALUES ($1, $2, $3, $4, 'owner', 'google')
                RETURNING id, email, name, role, org_id, is_active, created_at
                """,
                org["id"],
                email,
                name,
                "",  # No password for OAuth users
            )
            
            user = dict(user)
            user["organization_name"] = org["name"]
            user["organization_slug"] = org["slug"]
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled",
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
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    await database.execute(
        """
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        """,
        user["id"],
        token_hash,
        expires_at,
    )
    
    logger.info("OAuth login (Google)", user_id=str(user["id"]))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post(
    "/oauth/github",
    response_model=TokenResponse,
    summary="Login with GitHub OAuth",
)
@limiter.limit("10/minute")
async def oauth_github(
    request: Request,
    data: OAuthCodeRequest,
    database: Database = Depends(get_db),
):
    """
    Exchange GitHub OAuth code for tokens.
    """
    import httpx
    
    github_client_id = settings.__dict__.get("github_client_id", "")
    github_client_secret = settings.__dict__.get("github_client_secret", "")
    
    if not github_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="GitHub OAuth not configured",
        )
    
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "code": data.code,
                "client_id": github_client_id,
                "client_secret": github_client_secret,
                "redirect_uri": data.redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        
        if token_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange OAuth code",
            )
        
        tokens = token_response.json()
        
        if "error" in tokens:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=tokens.get("error_description", "OAuth error"),
            )
        
        # Get user info
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {tokens['access_token']}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        
        if user_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from GitHub",
            )
        
        user_info = user_response.json()
        
        # Get primary email
        emails_response = await client.get(
            "https://api.github.com/user/emails",
            headers={
                "Authorization": f"Bearer {tokens['access_token']}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        
        email = None
        if emails_response.status_code == 200:
            for e in emails_response.json():
                if e.get("primary") and e.get("verified"):
                    email = e["email"]
                    break
        
        if not email:
            email = user_info.get("email")
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not get email from GitHub. Please make your email public or grant email scope.",
            )
    
    name = user_info.get("name") or user_info.get("login", email.split("@")[0])
    
    # Find or create user (same logic as Google)
    user = await database.fetch_one(
        """
        SELECT u.*, o.name as organization_name, o.slug as organization_slug
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        WHERE u.email = $1
        """,
        email,
    )
    
    if not user:
        async with database.transaction() as conn:
            org_slug = (user_info.get("login") or email.split("@")[0]).lower()[:50]
            existing = await conn.fetchrow("SELECT id FROM organizations WHERE slug = $1", org_slug)
            if existing:
                org_slug = f"{org_slug}-{secrets.token_hex(3)}"
            
            org = await conn.fetchrow(
                """
                INSERT INTO organizations (name, slug, plan)
                VALUES ($1, $2, 'starter')
                RETURNING id, name, slug
                """,
                f"{name}'s Workspace",
                org_slug,
            )
            
            user = await conn.fetchrow(
                """
                INSERT INTO users (org_id, email, name, password_hash, role, oauth_provider)
                VALUES ($1, $2, $3, $4, 'owner', 'github')
                RETURNING id, email, name, role, org_id, is_active, created_at
                """,
                org["id"],
                email,
                name,
                "",
            )
            
            user = dict(user)
            user["organization_name"] = org["name"]
            user["organization_slug"] = org["slug"]
    
    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled",
        )
    
    await database.execute(
        "UPDATE users SET last_login_at = NOW() WHERE id = $1",
        user["id"],
    )
    
    access_token = create_access_token({"sub": str(user["id"])})
    refresh_token = create_refresh_token({"sub": str(user["id"])})
    
    token_hash = generate_token_hash(refresh_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_refresh_token_expire_days)
    await database.execute(
        """
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        """,
        user["id"],
        token_hash,
        expires_at,
    )
    
    logger.info("OAuth login (GitHub)", user_id=str(user["id"]))
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )
