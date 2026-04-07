# app/main.py
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from core.init import preload_jwks
from core.settings import env
from core.error_handlers import install_global_error_handlers

# Routers: only the ones that actually exist in ec-control.
from routers import (
    entities as entities_router,
    internal as internal_router,
    login as login_router,
    provision as provision_router,
    template as template_router,
)


# ---------------------------------------------------------------------------
#  Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    ec-control lifespan:
    - Preload JWKS / auth metadata for validating external JWTs.
    - NO database pools or adapter setup. All data access is via ec-model.
    """
    await preload_jwks(app)
    yield
    # Nothing to tear down; no DB pools.


# ---------------------------------------------------------------------------
#  Application
# ---------------------------------------------------------------------------

app_name = env("EC_CONTROL_APP_NAME") or "Entity Core Control"
app = FastAPI(
    title=app_name,
    version="0.1.0",
    lifespan=lifespan,
)

# Global error handlers (non-DB) shared across routes.
install_global_error_handlers(app)

# ---------------------------------------------------------------------------
#  Router registration
# ---------------------------------------------------------------------------

# All of these routers should be implemented in terms of:
#   - ec-control's own auth (Auth0, etc.) to validate user JWTs
#   - app.core.model_client.call_model_manage(...) to talk to ec-model
# ec-control itself never touches a database.
app.include_router(login_router.router)
app.include_router(provision_router.router)
app.include_router(entities_router.router)
app.include_router(template_router.router)
app.include_router(internal_router.router)


# Optional root endpoint for quick diagnostics
@app.get("/")
async def root():
    return {
        "service": "ec-control",
        "status": "ok",
    }
