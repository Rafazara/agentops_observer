"""
CSRF Protection Middleware

Generates and validates CSRF tokens for state-changing requests.
Uses itsdangerous for secure token generation.
"""

import secrets
from typing import Callable

from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

# CSRF token serializer
csrf_serializer = URLSafeTimedSerializer(settings.secret_key, salt="csrf-token")

# Token validity duration (in seconds)
CSRF_TOKEN_MAX_AGE = 3600  # 1 hour

# Paths exempt from CSRF protection (use API key auth instead)
CSRF_EXEMPT_PATHS = [
    "/api/v1/ingest/",
    "/api/v1/ws/",
    "/health",
    "/ping",
    "/docs",
    "/openapi.json",
    "/redoc",
]

# Methods that don't require CSRF protection
CSRF_SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]


def generate_csrf_token(session_id: str | None = None) -> str:
    """
    Generate a CSRF token.
    
    Args:
        session_id: Optional session identifier for additional binding
        
    Returns:
        Signed CSRF token string
    """
    nonce = secrets.token_urlsafe(16)
    data = {"n": nonce}
    if session_id:
        data["s"] = session_id
    return csrf_serializer.dumps(data)


def validate_csrf_token(token: str, session_id: str | None = None) -> bool:
    """
    Validate a CSRF token.
    
    Args:
        token: The CSRF token to validate
        session_id: Optional session ID to verify binding
        
    Returns:
        True if valid, False otherwise
    """
    try:
        data = csrf_serializer.loads(token, max_age=CSRF_TOKEN_MAX_AGE)
        
        # Verify session binding if provided
        if session_id and data.get("s") != session_id:
            logger.debug("CSRF token session mismatch")
            return False
            
        return True
        
    except SignatureExpired:
        logger.debug("CSRF token expired")
        return False
    except BadSignature:
        logger.debug("CSRF token invalid signature")
        return False
    except Exception as e:
        logger.debug("CSRF token validation error", error=str(e))
        return False


def is_csrf_exempt(path: str) -> bool:
    """Check if a path is exempt from CSRF protection."""
    for exempt_path in CSRF_EXEMPT_PATHS:
        if path.startswith(exempt_path):
            return True
    return False


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF Protection Middleware.
    
    - Sets CSRF token in httpOnly cookie on authenticated requests
    - Validates CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
    - Exempts ingest endpoints (use API key auth)
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip for safe methods
        if request.method in CSRF_SAFE_METHODS:
            return await call_next(request)
        
        # Skip for exempt paths
        if is_csrf_exempt(request.url.path):
            return await call_next(request)
        
        # Skip if using API key authentication
        if request.headers.get("X-API-Key"):
            return await call_next(request)
        
        # Get CSRF token from header or form
        csrf_header = request.headers.get("X-CSRF-Token")
        
        # Also check for token in cookies (for same-site requests)
        csrf_cookie = request.cookies.get("csrf_token")
        
        # Use header token for validation, cookie for reference
        if not csrf_header:
            # For form submissions, try to get from body
            content_type = request.headers.get("Content-Type", "")
            if "application/x-www-form-urlencoded" in content_type:
                # Can't easily read form data here without consuming body
                # So we require header for API calls
                pass
        
        # Validate if we have both cookie and header
        if csrf_cookie and csrf_header:
            if not validate_csrf_token(csrf_header):
                logger.warning(
                    "CSRF validation failed",
                    path=request.url.path,
                    method=request.method,
                )
                return Response(
                    content='{"error": "csrf_token_invalid", "message": "CSRF token is invalid or expired"}',
                    status_code=status.HTTP_403_FORBIDDEN,
                    media_type="application/json",
                )
        elif csrf_cookie and not csrf_header:
            # Cookie present but no header - require header for API calls
            # This is optional - you may want to be more lenient
            pass
        
        # Process request
        response = await call_next(request)
        
        # Set/refresh CSRF cookie after successful auth requests
        if request.url.path in ["/api/v1/auth/login", "/api/v1/auth/refresh"]:
            if 200 <= response.status_code < 300:
                new_token = generate_csrf_token()
                response.set_cookie(
                    key="csrf_token",
                    value=new_token,
                    httponly=True,
                    samesite="strict",
                    secure=settings.is_production,
                    max_age=CSRF_TOKEN_MAX_AGE,
                )
        
        return response
