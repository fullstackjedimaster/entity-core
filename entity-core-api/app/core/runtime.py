# app/core/runtime.py
from __future__ import annotations

from typing import Any, Dict

from app.core.settings import env

# ---------------------------------------------------------------------------
#  Lightweight "context" helpers for ec-control
# ---------------------------------------------------------------------------
# ec-control does NOT talk to any database directly. It is a pure orchestration
# layer that:
#   - validates external JWTs via Auth0 (or other IdP),
#   - derives tenant/entity_schema/org information from claims,
#   - calls ec-model over HTTP with a RequestEnvelope and the caller's JWT.
# ---------------------------------------------------------------------------

# Name of the claim in the JWT that holds the tenant/entity_schema key.
SCHEMA_CLAIM = env("EC_SCHEMA_CLAIM") or "entity_schema"

# Default entity_schema to use if the claim is missing.
DEFAULT_SCHEMA = env("EC_DEFAULT_SCHEMA") or "public"


def get_effective_schema(claims: Dict[str, Any]) -> str:
    """
    Given decoded JWT claims from an authenticated user, determine which
    logical entity_schema / tenant key to pass down to ec-model.

    This does not perform any DB operations; it only computes a string
    that will typically end up in RequestEnvelope.context or options.
    """
    return str(claims.get(SCHEMA_CLAIM) or DEFAULT_SCHEMA)
