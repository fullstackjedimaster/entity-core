from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status
from jose import jwt

from app.core.settings import env
from app.schemas import RequestEnvelope

# Base URL for the entity-server service.
# IMPORTANT:
#   Use the site root here, not /manage or /api/manage.
#   Example:
#       https://entity-server.fullstackjedi.dev
EC_MODEL_BASE_URL = env("EC_MODEL_BASE_URL") or "http://localhost:8003"

# Shared secret used for internal entity-core -> entity-server service JWTs.
# Prefer EC_SHARED_JWT_SECRET if present; fall back to DEV_JWT_SECRET.
EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET") or env("DEV_JWT_SECRET")

if not EC_SHARED_JWT_SECRET:
    raise RuntimeError(
        "[entity-core] EC_SHARED_JWT_SECRET or DEV_JWT_SECRET must be set "
        "for internal service JWT generation."
    )


def _build_url(path: str) -> str:
    base = EC_MODEL_BASE_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def _build_internal_service_token() -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "iss": "entity-core",
        "sub": "entity-core",
        "aud": "entity-server-internal",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=5)).timestamp()),
    }
    return jwt.encode(payload, EC_SHARED_JWT_SECRET, algorithm="HS256")


async def _post(
    path: str,
    payload: Dict[str, Any],
    token: Optional[str] = None,
) -> Dict[str, Any]:
    url = _build_url(path)
    headers: Dict[str, str] = {"Content-Type": "application/json"}

    # If a real user access token is provided, forward it.
    # Otherwise mint a short-lived internal service JWT.
    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        internal_token = _build_internal_service_token()
        headers["Authorization"] = f"Bearer {internal_token}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to reach entity-server at {url}: {exc}",
            ) from exc

    if resp.status_code >= 400:
        detail: Any = None
        try:
            data = resp.json()
            detail = data.get("detail") if isinstance(data, dict) else data
        except Exception:
            detail = resp.text

        raise HTTPException(
            status_code=resp.status_code,
            detail=detail,
        )

    try:
        return resp.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Invalid JSON response from entity-server at {url}",
        ) from exc


# ---------------------------------------------------------------------------
#  High-level helpers
# ---------------------------------------------------------------------------

async def call_model_manage(
    envelope: RequestEnvelope,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    POST a RequestEnvelope to entity-server's /api/manage endpoint.
    """
    return await _post("/api/manage", envelope.model_dump(), token)