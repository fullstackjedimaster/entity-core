# app/schemas.py
from __future__ import annotations
from typing import Optional, Dict, Any, Literal, List
from pydantic import BaseModel, Field

from dataclasses import dataclass


Operation = Literal["create", "read", "update", "delete", "execute"]


class RequestEnvelope(BaseModel):
    operation: Operation
    target: str                      # entity name OR action name
    id: Optional[str] = None         # GUID row id or correlation id
    args: Optional[Dict[str, Any]] = None  # data payload
    meta: Optional[Dict[str, Any]] = None  # tracing or UI state




class EntityResponse(BaseModel):
    entity: str = None


class RequestResult(BaseModel):
    ok: bool
    message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


# ------------------------------------------------------------
# User Models
# ------------------------------------------------------------
class DBUser(BaseModel):
    id: str
    auth0_sub: str
    email: Optional[str]
    name: Optional[str]
    picture_url: Optional[str]
    given_name: Optional[str]
    family_name: Optional[str]
    locale: Optional[str]
    last_login_at: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


class DBUserWithAuth(DBUser):

    roles: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    org_id: Optional[str] = None   # ✅ ensures front-end gets org_id cleanly


# ------------------------------------------------------------
# Provisioning (during onboarding)
# ------------------------------------------------------------
# NOTE: You are creating a **single tenant entity_schema**, not multi-org / multi-membership yet.
# This is the final, simplified shape matching `provision_tenant`.

class ProvisionPayload(BaseModel):
    entity_schema: str = Field(..., description="Tenant entity_schema name (org key)")
    sub: str = Field(..., description="Auth0 user ID")
    email: str
    name: str
    picture: Optional[str] = None


class FormMetadataResponse(BaseModel):
    entity_name: str
    entity_json: Dict[str, Any]


class TenantBody(BaseModel):
    sub: str
    app_metadata: Dict[str, Any]


class CreateEntityBody(BaseModel):
    entity_schema: str
    entity_name: str
    entity_json: Dict[str, Any]


@dataclass
class TenantContext:
    entity_schema: str
    sub: Optional[str] = None
    org_id: Optional[str] = None
    permissions: list[str] = None
