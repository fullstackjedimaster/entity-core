# app/core/error_handlers.py
from __future__ import annotations
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from db_errors import translate_db_error

def install_global_error_handlers(app: FastAPI) -> None:
    """
    Register a generous catch-all that:
    - passes through HTTPException untouched,
    - translates DB-ish exceptions to 4xx JSON via translate_db_error,
    - falls back to a 500 with a minimal payload otherwise.
    """

    @app.exception_handler(Exception)
    async def _all_exceptions(request: Request, exc: Exception):
        # If raised explicitly as HTTPException, let FastAPI's default path handle it
        if isinstance(exc, HTTPException):
            # Returning None allows FastAPI default to kick in
            return JSONResponse(
                status_code=exc.status_code,
                content=exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail},
            )

        # Try to map DB errors (psycopg2/asyncpg/SQLAlchemy, etc.)
        try:
            http_exc = translate_db_error(exc)
            return JSONResponse(status_code=http_exc.status_code, content=http_exc.detail)
        except Exception:
            # Truly unknown / internal error → 500
            return JSONResponse(
                status_code=500,
                content={"error": "internal_error", "message": "Unexpected server error"},
            )
