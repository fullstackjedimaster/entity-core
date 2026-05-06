from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, Request
from jose import jwt

from app.core.settings import env

EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET")
ALGORITHM = "HS256"

NS = "https://fullstackjedi.dev"

ENTITY_SCHEMA_KEYS = (
    "entity_schema",
    f"{NS}/entity_schema",
    "schema",
)

ORG_ID_KEYS = (
    "org_id",
    f"{NS}/org_id",
)

ROLES_KEYS = (
    "roles",
    f"{NS}/roles",
)

PERMISSIONS_KEYS = (
    "permissions",
    f"{NS}/permissions",
)


def _first_string(claims: Dict[str, Any], *keys: str) -> Optional[str]:
    for key in keys:
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _first_list(claims: Dict[str, Any], *keys: str) -> list[str]:
    for key in keys:
        value = claims.get(key)

        if isinstance(value, list):
            return [str(v) for v in value]

        if isinstance(value, str) and value.strip():
            return [v for v in value.split() if v]

    return []


def normalize_claims(claims: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize Auth0 namespaced claims into simple internal claim names.

    Edge token may contain:
      https://fullstackjedi.dev/entity_schema

    Internal services should use:
      entity_schema
    """
    normalized = dict(claims)

    entity_schema = _first_string(claims, *ENTITY_SCHEMA_KEYS)
    org_id = _first_string(claims, *ORG_ID_KEYS)
    roles = _first_list(claims, *ROLES_KEYS)
    permissions = _first_list(claims, *PERMISSIONS_KEYS, "scope")

    if entity_schema:
        normalized["entity_schema"] = entity_schema
        normalized[f"{NS}/entity_schema"] = entity_schema

    if org_id:
        normalized["org_id"] = org_id
        normalized[f"{NS}/org_id"] = org_id

    normalized["roles"] = roles
    normalized[f"{NS}/roles"] = roles

    normalized["permissions"] = permissions
    normalized[f"{NS}/permissions"] = permissions

    return normalized


def get_entity_schema_from_claims(claims: Dict[str, Any]) -> str:
    normalized = normalize_claims(claims)
    entity_schema = normalized.get("entity_schema")

    if not entity_schema:
        raise HTTPException(
            status_code=400,
            detail="Missing entity_schema claim",
        )

    return str(entity_schema)


def issue_internal_token(
    request: Request,
    claims: Optional[Dict[str, Any]] = None,
    expires_minutes: int = 5,
) -> str:
    """
    Mint the HS256 service token sent from entity-core-api to entity-server.

    This token MUST carry the normalized tenant claims so entity-server never
    has to know about Auth0 claim namespaces.
    """
    if not EC_SHARED_JWT_SECRET:
        raise RuntimeError("EC_SHARED_JWT_SECRET is not set")

    source_claims: Dict[str, Any] = claims or getattr(request.state, "claims", {}) or {}
    normalized = normalize_claims(source_claims)

    entity_schema = normalized.get("entity_schema")
 
    now = datetime.now(timezone.utc)

    payload = {
        "iss": "entity-core-api",
        "aud": "entity-server",
        "sub": normalized.get("sub") or "entity-core-api",
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
        "scope": "internal crud:create crud:read crud:update crud:delete",
        "permissions": normalized.get("permissions")
        or ["crud:create", "crud:read", "crud:update", "crud:delete"],
        "roles": normalized.get("roles") or [],
        "org_id": normalized.get("org_id") or None,
        "entity_schema": entity_schema or None,
    }

    return jwt.encode(payload, EC_SHARED_JWT_SECRET, algorithm=ALGORITHM)