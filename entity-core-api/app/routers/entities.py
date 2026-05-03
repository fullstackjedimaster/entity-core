from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request, Depends, HTTPException
from app.controllers.auth import require_jwt
from app.controllers.internal_auth import issue_internal_token
from app.core.model_client import call_model_manage
from app.schemas import CreateEntityBody, RequestEnvelope, EntityResponse

router = APIRouter(
    prefix="/api/entities",
    dependencies=[Depends(require_jwt())]
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Authorization header must be: Bearer <token>",
        )
    return parts[1]


def _unwrap_result(data: Dict[str, Any], error_msg: str):
    if not data.get("ok", False):
        raise HTTPException(status_code=502, detail=data.get("message") or error_msg)
    return data.get("result")


# ---------------------------------------------------------------------------
# List entities
# ---------------------------------------------------------------------------

@router.get("")
async def list_entities(request: Request, token_payload: dict = Depends(require_jwt())):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")
    internal_token = issue_internal_token(request)


    envelope = RequestEnvelope(
        operation="execute",
        target="ec.list_entities",
        id=None,
        args= {"entity_schema": entity_schema},
        meta={"source": "entity-core:/api/entities"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed listing entities")

    rows = result.get("rows", [])

    return {
        "entities": [
            r["entity"]
            for r in rows
            if isinstance(r, dict) and "entity" in r
        ]
    }


# ---------------------------------------------------------------------------
# Get entity template
# ---------------------------------------------------------------------------

@router.get("/{entity}", response_model=EntityResponse)
async def get_entity(request: Request,  entity_name: str, token_payload: dict = Depends(require_jwt())):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")
    internal_token = issue_internal_token(request)
    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_entity",
        id=None,
        args={"entity_schema":entity_schema,
            "entity_name": entity_name},
        meta={"source": "entity-core:/api/entities/{entity_name}"},
    )

    data = await call_model_manage(envelope, token=internal_token )
    ent = _unwrap_result(data, "entity-server failed get_entity")

    if ent is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if isinstance(ent, dict) and "entity" in ent:
        return EntityResponse(
            entity=ent["entity"]
        )
    return None

@router.get("")
async def list_entities(
    request: Request,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")
    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.list_entities",
        id=None,
        args={
            "entity_schema": entity_schema,
        },
        meta={"source": "entity-core:/api/entities"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    return _unwrap_result(data, "entity-server failed list_entities")


@router.get("/{entity_name}")
async def get_entity(request: Request, entity_name: str, token_payload: dict = Depends(require_jwt())):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")
    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_entity",
        id=None,
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name,
        },
        meta={"source": "entity-core:/api/entities/{entity_name}"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    ent = _unwrap_result(data, "entity-server failed get_entity")

    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")

    return ent
# ---------------------------------------------------------------------------
# Create entity
# ---------------------------------------------------------------------------

@router.post("/{entity}")
async def create_entity(
    request: Request,
    body: CreateEntityBody,
    token_payload: dict = Depends(require_jwt()),
):
    if not body.entity_json:
        raise HTTPException(status_code=400, detail="Missing entity_json")

    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.create_entity",
        id=None,
        args={
            "entity_schema": entity_schema,
            "entity_name": body.entity_name,
            "entity_json": body.entity_json,
        },
        meta={"source": "entity-core:/api/entities/{entity}:POST"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    _unwrap_result(data, "entity-server failed create_entity")

    return {"status": "ok"}


