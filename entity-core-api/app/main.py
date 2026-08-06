# app/main.py
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.error_handlers import install_global_error_handlers
from app.core.init import preload_jwks
from app.core.settings import CORS_ORIGINS, env
from app.routers import (
    crud as crud_router,
    demo_reset as demo_reset_router,
    entities as entities_router,
    internal as internal_router,
    login as login_router,
    onboarding as onboarding_router,
)


def parse_cors_origins(raw: str) -> list[str]:
    """
    Parse a comma-separated CORS_ORIGINS environment value.

    Empty entries are ignored and duplicates are removed while preserving
    their original order.
    """
    origins: list[str] = []

    for value in raw.split(","):
        origin = value.strip().rstrip("/")

        if origin and origin not in origins:
            origins.append(origin)

    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Entity Core control-service lifespan.

    Entity Core validates Auth0 JWTs and delegates data operations to
    Entity Server. It does not maintain a local database connection pool.
    """
    await preload_jwks(app)
    yield


app_name = env("EC_CONTROL_APP_NAME") or "Entity Core Control"

app = FastAPI(
    title=app_name,
    version="0.1.0",
    lifespan=lifespan,
)

cors_origins = parse_cors_origins(CORS_ORIGINS)

if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=[
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Onboarding-Token",
            "X-Embed-Token",
        ],
        expose_headers=[
            "Content-Disposition",
        ],
        max_age=86400,
    )

install_global_error_handlers(app)

app.include_router(login_router.router)
app.include_router(demo_reset_router.router)
app.include_router(onboarding_router.router)
app.include_router(entities_router.router)
app.include_router(internal_router.router)
app.include_router(crud_router.router)


@app.get("/")
async def root():
    return {
        "service": "ec-control",
        "status": "ok",
    }


@app.get("/health")
async def health():
    return {
        "service": "ec-control",
        "status": "ok",
    }