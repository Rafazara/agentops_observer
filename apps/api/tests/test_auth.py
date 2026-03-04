"""
Authentication Tests

Tests for registration, login, token refresh, and API key management.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import create_test_user, create_test_org


# ============================================================================
# Registration Tests
# ============================================================================

@pytest.mark.asyncio
async def test_register_success(async_client: AsyncClient, test_db):
    """Register with valid data returns 201 and user + org info."""
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@test.com",
            "password": "ValidPass123",
            "name": "New User",
            "organization_name": "New Org",
            "organization_slug": "new-org",
        },
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "user_id" in data
    assert "org_id" in data
    assert data["email"] == "newuser@test.com"
    assert data["organization_slug"] == "new-org"


@pytest.mark.asyncio
async def test_register_duplicate_email(async_client: AsyncClient, test_db, test_user):
    """Register with duplicate email returns 409 conflict."""
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": test_user["email"],
            "password": "ValidPass123",
            "name": "Another User",
            "organization_name": "Another Org",
            "organization_slug": "another-org",
        },
    )
    
    assert response.status_code == 409
    assert "already registered" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_register_invalid_email(async_client: AsyncClient):
    """Register with invalid email returns 422 validation error."""
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": "ValidPass123",
            "name": "User",
            "organization_name": "Org",
            "organization_slug": "org",
        },
    )
    
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_weak_password(async_client: AsyncClient):
    """Register with weak password returns 422 validation error."""
    response = await async_client.post(
        "/api/v1/auth/register",
        json={
            "email": "user@test.com",
            "password": "weak",  # Too short
            "name": "User",
            "organization_name": "Org",
            "organization_slug": "org",
        },
    )
    
    assert response.status_code == 422


# ============================================================================
# Login Tests
# ============================================================================

@pytest.mark.asyncio
async def test_login_success(async_client: AsyncClient, test_user):
    """Login with correct credentials returns 200 and tokens."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_user["email"],
            "password": test_user["password"],
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert "expires_in" in data


@pytest.mark.asyncio
async def test_login_wrong_password(async_client: AsyncClient, test_user):
    """Login with wrong password returns 401 unauthorized."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_user["email"],
            "password": "WrongPassword123",
        },
    )
    
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_nonexistent_email(async_client: AsyncClient):
    """Login with nonexistent email returns 401 (same message, no enumeration)."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": "nonexistent@test.com",
            "password": "SomePassword123",
        },
    )
    
    assert response.status_code == 401
    # Same error message as wrong password to prevent enumeration
    assert "invalid" in response.json()["detail"].lower()


# ============================================================================
# Token Refresh Tests
# ============================================================================

@pytest.mark.asyncio
async def test_refresh_token_success(async_client: AsyncClient, test_user):
    """Refresh token returns new access token."""
    # First login to get refresh token
    login_response = await async_client.post(
        "/api/v1/auth/login",
        json={
            "email": test_user["email"],
            "password": test_user["password"],
        },
    )
    refresh_token = login_response.json()["refresh_token"]
    
    # Use refresh token
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_invalid_token(async_client: AsyncClient):
    """Refresh with invalid token returns 401."""
    response = await async_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    
    assert response.status_code == 401


# ============================================================================
# Current User Tests
# ============================================================================

@pytest.mark.asyncio
async def test_get_me_authenticated(async_client: AsyncClient, test_user, auth_headers):
    """Get /me with valid token returns user data."""
    response = await async_client.get(
        "/api/v1/auth/me",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]
    assert "id" in data
    assert "org_id" in data


@pytest.mark.asyncio
async def test_get_me_unauthenticated(async_client: AsyncClient):
    """Get /me without token returns 401."""
    response = await async_client.get("/api/v1/auth/me")
    
    assert response.status_code == 401


# ============================================================================
# API Key Tests
# ============================================================================

@pytest.mark.asyncio
async def test_create_api_key(async_client: AsyncClient, auth_headers):
    """Generate API key returns key with prefix."""
    response = await async_client.post(
        "/api/v1/auth/api-keys",
        headers=auth_headers,
        json={
            "name": "Test Key",
            "scopes": ["read", "write"],
        },
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "key" in data
    assert data["key"].startswith("agentops_sk_")
    assert "key_prefix" in data
    assert data["scopes"] == ["read", "write"]


@pytest.mark.asyncio
async def test_revoke_api_key(async_client: AsyncClient, auth_headers, test_api_key):
    """Revoke API key successfully."""
    response = await async_client.delete(
        f"/api/v1/auth/api-keys/{test_api_key['id']}",
        headers=auth_headers,
    )
    
    assert response.status_code == 200
    
    # Verify key no longer works
    response2 = await async_client.get(
        "/api/v1/auth/me",
        headers={"X-API-Key": test_api_key["key"]},
    )
    assert response2.status_code == 401


# ============================================================================
# Password Reset Tests
# ============================================================================

@pytest.mark.asyncio
async def test_forgot_password_always_200(async_client: AsyncClient):
    """Forgot password always returns 200 (no email enumeration)."""
    # Test with existing email
    response1 = await async_client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "existing@test.com"},
    )
    assert response1.status_code == 200
    
    # Test with non-existing email - same response
    response2 = await async_client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "nonexistent@test.com"},
    )
    assert response2.status_code == 200
    
    # Both should have same message structure
    assert response1.json().keys() == response2.json().keys()
