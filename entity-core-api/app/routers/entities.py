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
# Get entity template
# ---------------------------------------------------------------------------


@router.get("")
async def list_entities(
    request: Request,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="list_entities",
        id=None,
        data={},
        args={"entity_schema": entity_schema},
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed list_entities")

    return {
        "entities": result or []
    }

@router.get("/{entity_name}")
async def get_entity(
    request: Request,
    entity_name: str,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")

    if not entity_schema:
        raise HTTPException(status_code=400, detail="Missing entity_schema claim")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="get_entity",
        id=None,
        data={},
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name
        }
    )

    data = await call_model_manage(envelope, token=internal_token)
    ent = _unwrap_result(data, "entity-server failed get_entity")

    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")

    return ent
# ---------------------------------------------------------------------------
# Create entity
# ---------------------------------------------------------------------------

@router.post("/{entity_name}")
async def create_entity(
    request: Request,
    entity_name: str,
    body: CreateEntityBody,
    token_payload: dict = Depends(require_jwt()),
):
    if not body.entity_json:
        raise HTTPException(status_code=400, detail="Missing entity_json")

    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")
    if not entity_schema:
        raise HTTPException(status_code=400, detail="Missing entity_schema claim")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="create_entity",
        id=None,
        data=body.entity_json,
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name
        },
    )

    data = await call_model_manage(envelope, token=internal_token)
    _unwrap_result(data, "entity-server failed create_entity")

    return {
        "entity_name": entity_name,
        "entity_json": body.entity_json,
    }

# ---------------------------------------------------------------------------
# Form metadata
# ---------------------------------------------------------------------------

@router.get("/{entity}/form_metadata")
async def get_form_metadata(request: Request, entity: str):
    await require_jwt([f"read:{entity}"])(request)
    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="get_form_metadata",
        id=None,
        data={},
        args={"entity": entity},
    )

    data = await call_model_manage(envelope, token= internal_token )
    result = _unwrap_result(data, "entity-server failed form_metadata")

    if isinstance(result, dict) and "rows" in result:
        return result["rows"]

    if isinstance(result, list):
        return result

    raise HTTPException(status_code=500, detail="Unexpected result format")


# ---------------------------------------------------------------------------
# Column options
# ---------------------------------------------------------------------------

@router.get("/options/{entity}/{column}")
async def get_column_options(
    request: Request,
    entity: str,
    column: str,
    filter: Optional[str] = None,
):
    await require_jwt([f"read:{entity}"])(request)
    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="get_column_options",
        id=None,
        data={},
        args={
            "entity": entity,
            "column": column,
            "filter": filter,
        }
    )

    data = await call_model_manage(envelope, token= internal_token )
    result = _unwrap_result(data, "entity-server failed column_options")

    values: List[Any] = []

    if isinstance(result, list):
        for item in result:
            values.append(item.get("value") if isinstance(item, dict) else item)
        return values

    if isinstance(result, dict) and "rows" in result:
        for row in result["rows"]:
            if isinstance(row, dict):
                values.append(row.get("value"))
        return values

    raise HTTPException(status_code=500, detail="Unexpected result format")