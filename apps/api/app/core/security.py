"""
Security Utilities

JWT token generation, password hashing, and API key management.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt
import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)

# JWT Configuration
ALGORITHM = "HS256"


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT access token.
    
    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiration time
    
    Returns:
        str: Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    })
    
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Create a JWT refresh token.
    
    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiration time
    
    Returns:
        str: Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=settings.jwt_refresh_token_expire_days
        )
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    })
    
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    """
    Decode and validate a JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Optional[dict]: Decoded payload or None if invalid
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.debug("Token decode failed", error=str(e))
        return None


# Alias for backward compatibility
decode_access_token = decode_token


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
    
    Returns:
        str: Hashed password
    """
    salt = bcrypt.gensalt(rounds=settings.password_hash_rounds)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        password: Plain text password
        hashed: Hashed password
    
    Returns:
        bool: True if password matches
    """
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.
    
    Returns:
        tuple: (full_key, prefix, key_hash)
            - full_key: Complete key shown to user once
            - prefix: First 12 chars for identification
            - key_hash: Hashed key for storage
    """
    # Generate a secure random key
    random_part = secrets.token_urlsafe(32)
    full_key = f"{settings.api_key_prefix}{random_part}"
    
    # Extract prefix (shown in UI for identification)
    prefix = full_key[:20]
    
    # Hash the full key for storage
    key_hash = hash_password(full_key)
    
    return full_key, prefix, key_hash


def verify_api_key(api_key: str, key_hash: str) -> bool:
    """
    Verify an API key against its hash.
    
    Args:
        api_key: Full API key
        key_hash: Stored hash
    
    Returns:
        bool: True if key is valid
    """
    return verify_password(api_key, key_hash)


def generate_token_hash(token: str) -> str:
    """
    Generate a hash for refresh token storage.
    
    Uses a faster hash since refresh tokens are already random.
    
    Args:
        token: Token to hash
    
    Returns:
        str: Token hash
    """
    import hashlib
    return hashlib.sha256(token.encode()).hexdigest()
