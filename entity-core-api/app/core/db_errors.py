# app/core/db_errors.py
from __future__ import annotations
from typing import Any, Optional
from fastapi import HTTPException

# Common PostgreSQL SQLSTATE codes we want to map
_SQLSTATE_MAP_4XX = {
    "23505": (409, "unique_violation"),
    "23502": (400, "not_null_violation"),
    "23503": (400, "foreign_key_violation"),
    "23514": (400, "check_violation"),
    "22P02": (400, "invalid_text_representation"),  # bad casts (e.g., uuid, int)
    "22007": (400, "invalid_datetime_format"),
    "22008": (400, "datetime_field_overflow"),
    "22018": (400, "invalid_character_value_for_cast"),
    "42P01": (400, "undefined_table"),
    "42703": (400, "undefined_column"),
    "42601": (400, "syntax_error"),
}

def _extract_sqlstate(exc: BaseException) -> Optional[str]:
    """
    Try very hard to extract a Postgres SQLSTATE code from exceptions coming from:
    - psycopg2: .pgcode
    - asyncpg: .sqlstate
    - SQLAlchemy: .orig.pgcode / .orig.sqlstate
    - wrapped exceptions via __cause__ / __context__
    """
    # Direct
    for attr in ("sqlstate", "SQLSTATE", "pgcode", "code"):
        v = getattr(exc, attr, None)
        if isinstance(v, str) and len(v) >= 5:
            return v[:5]

    # SQLAlchemy wraps DBAPI errors in .orig
    orig = getattr(exc, "orig", None)
    if orig:
        for attr in ("sqlstate", "SQLSTATE", "pgcode", "code"):
            v = getattr(orig, attr, None)
            if isinstance(v, str) and len(v) >= 5:
                return v[:5]

    # Follow causes
    cause = getattr(exc, "__cause__", None) or getattr(exc, "__context__", None)
    if cause and cause is not exc:
        return _extract_sqlstate(cause)

    # Try to sniff from args (last resort, brittle but helpful)
    # Sometimes messages embed "(SQLSTATE 23505)" etc.
    try:
        msg = str(exc)
        for token in _SQLSTATE_MAP_4XX.keys():
            if token in msg:
                return token
    except Exception:
        pass

    return None

def translate_db_error(exc: BaseException) -> HTTPException:
    """
    Convert DB-ish exceptions to HTTPException with a friendly shape:
    status_code, detail={"error": "...", "code": "...", "message": "..."}
    Defaults to 400 if we can’t classify, so we don’t leak 500s for user input mistakes.
    """
    sqlstate = _extract_sqlstate(exc)
    message = str(getattr(exc, "orig", exc)) or str(exc)
    # Trim very long messages
    if len(message) > 10_000:
        message = message[:10_000] + "…"

    if sqlstate and sqlstate in _SQLSTATE_MAP_4XX:
        status, label = _SQLSTATE_MAP_4XX[sqlstate]
        return HTTPException(
            status_code=status,
            detail={"error": label, "code": sqlstate, "message": message},
        )

    # Unknown DB error → treat as client error unless obviously internal
    # You can tune this if you prefer 422 for validation-like failures.
    return HTTPException(
        status_code=400,
        detail={"error": "db_error", "code": sqlstate or "unknown", "message": message},
    )
