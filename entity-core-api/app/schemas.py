# app/schemas.py
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


Operation = Literal[
    "create",
    "read",
    "update",
    "delete",
    "list",
    "execute",
]


class RequestEnvelope(BaseModel):
    """
    Shared request envelope used between entity-core-api and entity-server.

    Rules:
      - operation = CRUD verb or "execute"
      - target = entity name for CRUD, action name for execute
      - id = row UUID when applicable
      - data = main payload
      - args = secondary/action args
      - meta = tracing/debug metadata only

    Tenant/entity_schema should come from JWT claims/internal token,
    not from request body. args.entity_schema may exist only as fallback.
    """

    operation: Operation
    target: str
    id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    args: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None


class RequestResult(BaseModel):
    ok: bool
    result: Any = None
    error: Optional[str] = None
    message: Optional[str] = None


class EntityResponse(BaseModel):
    entity: Any = None


class EntityItemResponse(BaseModel):
    entityItem: Any = None


class CreateEntityBody(BaseModel):
    """
    Body for POST /api/entities/{entity_name}.

    entity_schema is intentionally NOT here.
    It comes from Auth0 claims -> internal token -> entity-server claims.
    """

    entity_json: Dict[str, Any]


class FormMetadataResponse(BaseModel):
    entity_name: str
    entity_json: Dict[str, Any]


class TenantBody(BaseModel):
    sub: str
    app_metadata: Dict[str, Any]


class ProvisionPayload(BaseModel):
    entity_schema: str = Field(..., description="Tenant schema/org key")
    sub: str = Field(..., description="Auth0 user ID")
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    locale: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)


class DBUser(BaseModel):
    id: str
    auth0_sub: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture_url: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    locale: Optional[str] = None
    last_login_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DBUserWithAuth(DBUser):
    roles: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    org_id: Optional[str] = None
    entity_schema: Optional[str] = None


@dataclass
class TenantContext:
    entity_schema: str
    sub: Optional[str] = None
    org_id: Optional[str] = None
    permissions: Optional[List[str]] = None
    roles: Optional[List[str]] = None