# app/core/auth0_mgmt.py
from __future__ import annotations

import time
from urllib.parse import quote

import httpx

from app.core.settings import env

AUTH0_DOMAIN = env("AUTH0_DOMAIN", required=True)
AUTH0_M2M_CLIENT_ID = env("AUTH0_M2M_CLIENT_ID", required=True)
AUTH0_M2M_CLIENT_SECRET = env("AUTH0_M2M_CLIENT_SECRET", required=True)
AUTH0_MANAGEMENT_AUDIENCE = env(
    "AUTH0_MANAGEMENT_AUDIENCE",
    f"https://{AUTH0_DOMAIN}/api/v2/",
)

_cached_token: str | None = None
_cached_expiry = 0.0


async def get_management_token() -> str:
    """
    Return a cached Auth0 Management API token, refreshing it when needed.
    """
    global _cached_token, _cached_expiry

    now = time.time()

    if _cached_token and now < (_cached_expiry - 60):
        return _cached_token

    payload = {
        "grant_type": "client_credentials",
        "client_id": AUTH0_M2M_CLIENT_ID,
        "client_secret": AUTH0_M2M_CLIENT_SECRET,
        "audience": AUTH0_MANAGEMENT_AUDIENCE,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"https://{AUTH0_DOMAIN}/oauth/token",
            json=payload,
        )

    if response.status_code != 200:
        raise RuntimeError(
            "Auth0 token request failed: "
            f"{response.status_code} {response.text}"
        )

    data = response.json()
    _cached_token = data["access_token"]
    _cached_expiry = now + int(data.get("expires_in", 3600))

    return _cached_token


async def delete_auth0_user(sub: str) -> bool:
    """
    Delete an Auth0 user by user_id/sub.

    Auth0 user IDs contain characters such as ``|`` and must be URL encoded.
    A 404 is treated as success so repeated demo resets remain idempotent.

    The M2M application must have the Management API ``delete:users`` scope.
    """
    if not sub or not sub.strip():
        raise ValueError("Auth0 user sub is required")

    token = await get_management_token()
    encoded_sub = quote(sub.strip(), safe="")
    url = f"https://{AUTH0_DOMAIN}/api/v2/users/{encoded_sub}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.delete(
            url,
            headers={"Authorization": f"Bearer {token}"},
        )

    if response.status_code in {204, 404}:
        return True

    raise RuntimeError(
        "Auth0 user deletion failed for "
        f"{sub!r}: {response.status_code} {response.text}"
    )
