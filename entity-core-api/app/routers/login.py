# app/routers/login.py
from __future__ import annotations

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
import time

from app.schemas import DBUserWithAuth
from app.controllers.auth import require_jwt
from app.core.settings import env

router = APIRouter(prefix="/internal/users", tags=["auth"])

# ---------------------------------------------------------------------------
# Dev login (unchanged)
# ---------------------------------------------------------------------------

SECRET_KEY = env("EC_SHARED_JWT_SECRET")
ALGORITHM = "HS256"


@router.post("/login")
async def login_dev(username: str):
    """
    Simple dev-only login that mints an HS256 token from EC_SHARED_JWT_SECRET.
    NOTE: This is separate from your Auth0 flow and should only be used
    in local/dev environments.
    """
    if env("ENABLE_LOCAL_LOGIN") not in ("1", "true"):
        raise HTTPException(status_code=403, detail="Local login disabled")

    if not SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="EC_SHARED_JWT_SECRET is not set; dev login unavailable.",
        )

    payload = {"sub": username, "exp": int(time.time()) + 7200}
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


# ---------------------------------------------------------------------------
# Helpers for /me
# ---------------------------------------------------------------------------

def _get_claim(
    claims: dict,
    *keys: str,
    default: Optional[str] = None,
) -> Optional[str]:
    """
    Helper to pull a value from claims using several possible keys.
    First non-empty string wins.
    """
    for k in keys:
        if not k:
            continue
        v = claims.get(k)
        if isinstance(v, str) and v.strip():
            return v
    return default


def _get_list_claim(
    claims: dict,
    *keys: str,
) -> List[str]:
    """
    Helper to pull a list-of-strings from claims using several possible keys.
    Tries:
      - list under given key(s)
      - space-delimited string under given key(s)
    """
    for k in keys:
        if not k:
            continue
        v = claims.get(k)
        if isinstance(v, list):
            return [str(x) for x in v]
        if isinstance(v, str):
            # space-delimited scopes string
            return [p for p in v.split() if p]
    return []


# ---------------------------------------------------------------------------
# /internal/users/me — token-only user info (no DB)
# ---------------------------------------------------------------------------

@router.get("/me", response_model=DBUserWithAuth)
async def get_current_user(
    claims: dict = Depends(require_jwt(["crud:read"])),
) -> DBUserWithAuth:
    """
    Return the current user info derived purely from the validated JWT.

    entity-core (ec-control) does NOT touch the database; it just:
      - validates the external JWT (Auth0, etc) via require_jwt
      - projects identity/roles/permissions/org_id from claims

    Any DB-level user sync happens downstream (entity-server / ec-model),
    not here.
    """

    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=400, detail="Token missing 'sub'")

    # Basic identity from common Auth0-style claims
    email = _get_claim(
        claims,
        "email",
        "https://fullstackjedi.dev/email",
    )
    name = _get_claim(
        claims,
        "name",
        "nickname",
    )
    picture = _get_claim(
        claims,
        "picture",
        "https://fullstackjedi.dev/picture",
    )
    given_name = _get_claim(claims, "given_name")
    family_name = _get_claim(claims, "family_name")
    locale = _get_claim(claims, "locale", default="en")

    # Roles/permissions from namespaced or plain claims
    roles = _get_list_claim(
        claims,
        "roles",
        "https://fullstackjedi.dev/roles",
    )
    permissions = _get_list_claim(
        claims,
        "permissions",
        "https://fullstackjedi.dev/permissions",
        "scope",  # sometimes scopes come as a single space-delimited string
    )

    # Org / entity_schema — we’ll treat any of these as the org_id
    org_id = _get_claim(
        claims,
        "org_id",
        "https://fullstackjedi.dev/org_id"

    )

    entity_schema = _get_claim(
        claims,
        "entity_schema",
        "https://fullstackjedi.dev/entity_schema"

    )

    # Map into DBUserWithAuth. Fields that normally come from DB stay None.
    return DBUserWithAuth(
        id=sub,
        auth0_sub=sub,
        email=email,
        name=name,
        picture_url=picture,
        given_name=given_name,
        family_name=family_name,
        locale=locale,
        last_login_at=None,
        created_at=None,
        updated_at=None,
        roles=roles,
        permissions=permissions,
        org_id=org_id,
        entity_schema=entity_schema
    )
