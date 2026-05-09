# entity-core-api/app/routes/options.py

from __future__ import annotations

import os
from typing import Any, Dict

import httpx
from fastapi import APIRouter, Header, HTTPException, Query, Request

router = APIRouter(prefix="/api/actions", tags=["options"])

ENTITY_SERVER_URL = os.getenv("ENTITY_SERVER_URL", "http://entity-server:8000").rstrip("/")


def _normalize_option_item(item: Any) -> Dict[str, str]:
    if isinstance(item, dict):
        value = (
            item.get("value")
            or item.get("id")
            or item.get("uuid")
            or item.get("key")
            or ""
        )

        label = (
            item.get("label")
            or item.get("name")
            or item.get("title")
            or item.get("value")
            or item.get("id")
            or ""
        )

        return {
            "value": str(value),
            "label": str(label),
        }

    return {
        "value": str(item),
        "label": str(item),
    }


def _normalize_options_payload(payload: Any) -> Dict[str, list[Dict[str, str]]]:
    if not isinstance(payload, dict):
        return {}

    result: Dict[str, list[Dict[str, str]]] = {}

    for field_name, items in payload.items():
        if items is None:
            result[field_name] = []
            continue

        if isinstance(items, list):
            result[field_name] = [_normalize_option_item(item) for item in items]
            continue

        result[field_name] = [_normalize_option_item(items)]

    return result


def _extract_claims_from_request(request: Request) -> Dict[str, Any]:
    claims = getattr(request.state, "claims", None)

    if isinstance(claims, dict):
        return claims

    return {}


def _extract_schema(request: Request) -> str:
    claims = _extract_claims_from_request(request)

    schema = (
        getattr(request.state, "schema", None)
        or claims.get("schema")
        or claims.get("entity_schema")
        or claims.get("https://fullstackjedi.dev/schema")
        or claims.get("https://fullstackjedi.dev/entity_schema")
    )

    if not schema:
        raise HTTPException(
            status_code=400,
            detail="No entity schema found in request state or claims",
        )

    return str(schema)


@router.get("/foreign-key-options")
async def get_foreign_key_options(
    request: Request,
    entity: str = Query(..., min_length=1),
    field: str | None = Query(default=None),
    parentField: str | None = Query(default=None),
    parentValue: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
) -> Dict[str, list[Dict[str, str]]]:
    entity_schema = _extract_schema(request)

    envelope = {
        "operation": "execute",
        "target": "ec.get_foreign_key_options",
        "args": {
            "entity_schema": entity_schema,
            "entity_name": entity,
            "column_name": field,
            "parent_field": parentField,
            "parent_value": parentValue,
        },
        "meta": {
            "schema": entity_schema,
        },
    }

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    if authorization:
        headers["Authorization"] = authorization

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            f"{ENTITY_SERVER_URL}/api/manage",
            json=envelope,
            headers=headers,
        )

    try:
        payload = res.json()
    except Exception:
        payload = None

    if res.status_code >= 400:
        raise HTTPException(
            status_code=res.status_code,
            detail={
                "message": "entity-server failed while loading foreign key options",
                "payload": payload,
            },
        )

    raw_options = payload.get("result") if isinstance(payload, dict) else payload

    if isinstance(raw_options, dict) and "data" in raw_options:
        raw_options = raw_options["data"]

    if isinstance(raw_options, dict) and "options" in raw_options:
        raw_options = raw_options["options"]

    return _normalize_options_payload(raw_options)