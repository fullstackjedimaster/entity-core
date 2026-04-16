# app/routers/entity.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from app.controllers.auth import require_jwt
from app.core.model_client import call_model_manage
from app.schemas import CreateEntityBody, RequestEnvelope, EntityResponse

router = APIRouter(prefix="/api/entities", tags=["entities"])


def _extract_bearer_token(request: Request) -> str:
    """
    Reuse the incoming Authorization header so entity-server can
    validate the same JWT. We do NOT re-sign anything here.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Authorization header must be in the format: Bearer <token>",
        )
    return parts[1]


@router.get("")
async def list_entities(request: Request):
    """
    List entity names that have templates.

    Old behavior:
      - Direct SELECT ec.listTemplates(schema) FROM DB.

    New behavior:
      - Build a RequestEnvelope and call entity-server via call_model_manage.
      - entity-server is responsible for resolving schema/org and hitting ec.listTemplates.
    """
    # 🔐 Require any authenticated user (no specific scopes)
    _claims = await require_jwt([])(request)
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.list_entities",
        id=None,
        args={},  # schema is derived by entity-server from the JWT
        meta={"source": "entity-core:/entities"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for listTemplates",
        )

    result = data.get("result")
    # Be defensive about shape: it might be list OR {"rows": [...]}
    if isinstance(result, dict) and "rows" in result:
        rows = result["rows"]
    else:
        rows = result or []

    entities: List[str] = []
    for row in rows:
        if isinstance(row, dict) and "entity_name" in row:
            entities.append(str(row["entity_name"]))

    return {"entities": entities}

@router.get("/{entity}", response_model=EntityResponse)
async def get_entity(
    request: Request,
    entity: str) -> EntityResponse:
    """
    Get a template JSON for the given entity_name in the caller's schema.
    """
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_entity",
        id=None,
        args={"entity_name": entity},
        meta={"source": "entity-core:/api/entities/{entity}:GET"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for getTemplate",
        )

    ent = data.get("result")
    if ent is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if isinstance(ent, dict) and "entity_json" in ent and "entity_name" in ent:
        return EntityResponse(entity_name=ent["entity_name"], template=ent["entity_json"])

    # Fallback: assume tpl is the raw template dict
    return EntityResponse(entity_name=ent, template=ent)

@router.post("/{entity}")
async def create_entity(
    request: Request,
    entity: str,
    body: CreateEntityBody,
):

    if not body.entity_json or entity.strip() == "":
        raise HTTPException(status_code=400, detail="Missing  entity_json")

    _claims = await require_jwt([])(request)  # any authenticated user for now
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.create_entity",
        id=None,
        args={
            "schema_name": body.schema_name,
            "entity_name": entity,
            "entity_json": body.entity_jsom,
        },
        meta={"source": "entity-core:/entities/{entity}"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for insertTemplate",
        )

    return JSONResponse(content={"status": "ok"}, status_code=200)


# ---------------------------------------------------------------------------
# Get form metadata for entity (backed by ec.get_form_metadata)
# ---------------------------------------------------------------------------

@router.get("/{entityName}/form_metadata")
async def get_form_metadata(
    request: Request,
    entity: str,
):
    """
    Fetch form metadata for an entity.

    Old behavior:
      - SELECT * FROM ec.get_form_metadata(schema, entity).

    New behavior:
      - entity-core calls entity-server → target 'ec.get_form_metadata'
      - entity-server resolves schema/org from JWT and calls the DB function.
    """
    _claims = await require_jwt([f"read:{entity}"])(request)
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_form_metadata",
        id=None,
        args={"entity_name": entity},
        meta={"source": "entity-core:/api/entity/{entity}/form_metadata"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for get_form_metadata",
        )

    result = data.get("result")
    # Again, be flexible about shape:
    if isinstance(result, dict) and "rows" in result:
        return result["rows"]
    if isinstance(result, list):
        return result

    raise HTTPException(
        status_code=500,
        detail="Unexpected result format from entity-server for get_form_metadata",
    )


# ---------------------------------------------------------------------------
# Column option provider for cascading dropdowns (ec.get_column_options)
# ---------------------------------------------------------------------------

@router.get("/options/{entityName}/{column}")
async def get_column_options(
    request: Request,
    entity: str,
    column: str,
    filter: Optional[str] = None,
):
    """
    Fetch options for a given entity/column (used for cascading dropdowns, etc.).

    Old behavior:
      - SELECT * FROM ec.get_column_options(schema, entity, column, filter).

    New behavior:
      - entity-core calls entity-server → target 'ec.get_column_options'
      - entity-server resolves schema/org and calls the DB function.
    """
    _claims = await require_jwt([f"read:{entity}"])(request)
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_column_options",
        id=None,
        args={
            "entity_name": entity,
            "column": column,
            "filter": filter,
        },
        meta={"source": "entity-core:/api/options/{entity}/{column}"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for get_column_options",
        )

    result = data.get("result")
    # Expect either a list of scalars or list of dicts with 'value'
    if isinstance(result, list):
        values: List[Any] = []
        for item in result:
            if isinstance(item, dict) and "value" in item:
                values.append(item["value"])
            else:
                values.append(item)
        return values

    if isinstance(result, dict) and "rows" in result:
        values = []
        for row in result["rows"]:
            if isinstance(row, dict) and "value" in row:
                values.append(row["value"])
        return values

    raise HTTPException(
        status_code=500,
        detail="Unexpected result format from entity-server for get_column_options",
    )
