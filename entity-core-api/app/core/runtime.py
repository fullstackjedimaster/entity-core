from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException

from app.core.settings import env
from app.controllers.internal_auth import normalize_claims

NS = "https://fullstackjedi.dev"

SCHEMA_CLAIM = env("EC_SCHEMA_CLAIM") or "entity_schema"
DEFAULT_SCHEMA = env("EC_DEFAULT_SCHEMA") or ""


def get_effective_schema(claims: Dict[str, Any]) -> str:
    normalized = normalize_claims(claims)

    entity_schema = (
        normalized.get("entity_schema")
        or normalized.get(f"{NS}/entity_schema")
        or normalized.get(SCHEMA_CLAIM)
        or DEFAULT_SCHEMA
    )

    if not entity_schema:
        raise HTTPException(
            status_code=400,
            detail="Missing entity_schema claim",
        )

    return str(entity_schema)


def attach_claim_context(request, claims: Dict[str, Any]) -> Dict[str, Any]:
    normalized = normalize_claims(claims)
    request.state.claims = normalized
    request.state.entity_schema = get_effective_schema(normalized)
    request.state.org_id = normalized.get("org_id")
    request.state.roles = normalized.get("roles") or []
    request.state.permissions = normalized.get("permissions") or []
    return normalized