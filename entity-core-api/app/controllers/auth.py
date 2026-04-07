# app/controllers/auth.py
from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

import json

from fastapi import Depends, HTTPException, Request, status
from jose import jwt

from app.core.settings import env

# ---------------------------------------------------------------------------
#  Auth0 / OIDC config for ec-control (entity-core)
# ---------------------------------------------------------------------------

AUTH0_DOMAIN = env("AUTH0_DOMAIN")
AUTH0_AUDIENCE = env("AUTH0_AUDIENCE")
AUTH0_ISSUER = env("AUTH0_ISSUER") or (f"https://{AUTH0_DOMAIN}/" if AUTH0_DOMAIN else None)
ALGORITHMS = ["RS256"]

if not AUTH0_DOMAIN or not AUTH0_AUDIENCE or not AUTH0_ISSUER:
    raise RuntimeError(
        "[ec-control] AUTH0_DOMAIN, AUTH0_AUDIENCE, and AUTH0_ISSUER must be set "
        "for JWT validation."
    )


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

def _get_token_from_header(request: Request) -> str:
    """
    Extract Bearer token from Authorization header.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be in the format: Bearer <token>",
        )

    return parts[1]


def _get_rsa_key(request: Request, token: str) -> Dict[str, Any]:
    """
    Locate the RSA key in the preloaded JWKS that matches the token's `kid`.
    JWKS should already be in app.state.jwks, populated by preload_jwks(app).
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token header",
        )

    if "kid" not in unverified_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header missing 'kid'",
        )

    jwks = getattr(request.app.state, "jwks", None)
    if not jwks or "keys" not in jwks:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWKS not loaded on server",
        )

    for key in jwks["keys"]:
        if key.get("kid") == unverified_header["kid"]:
            return {
                "kty": key.get("kty"),
                "kid": key.get("kid"),
                "use": key.get("use"),
                "n": key.get("n"),
                "e": key.get("e"),
            }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to find matching key for token",
    )


def decode_token(request: Request, token: str) -> Dict[str, Any]:
    """
    Decode and verify an incoming Auth0 JWT using RS256 and the preloaded JWKS.
    Enforces audience and issuer.
    """
    rsa_key = _get_rsa_key(request, token)

    try:
        claims = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_AUDIENCE,
            issuer=AUTH0_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.JWTClaimsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token claims: {exc}",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unable to parse authentication token: {exc}",
        )

    if not isinstance(claims, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return claims


def claims_have_scopes(
    claims: Dict[str, Any],
    required_scopes: Iterable[str],
    scope_claim: str = "scope",
) -> bool:
    """
    Generic scope checker.

    We first look at:
      - `permissions` (Auth0 API-style)
      - then at `scope` (space-delimited string)
      - then at `scopes` list
    """
    required = set(required_scopes)
    if not required:
        return True

    # Auth0's RBAC / API permissions
    perms = claims.get("permissions") or []
    if isinstance(perms, list):
        if required.issubset(set(str(p) for p in perms)):
            return True

    # space-delimited 'scope'
    raw_scopes = claims.get(scope_claim)
    scopes: List[str] = []
    if isinstance(raw_scopes, str):
        scopes = raw_scopes.split()
    elif isinstance(raw_scopes, list):
        scopes = [str(s) for s in raw_scopes]

    if required.issubset(set(scopes)):
        return True

    # Fallback to 'scopes' list if present
    alt_scopes = claims.get("scopes")
    if isinstance(alt_scopes, list):
        if required.issubset(set(str(s) for s in alt_scopes)):
            return True

    return False


# ---------------------------------------------------------------------------
#  FastAPI dependency
# ---------------------------------------------------------------------------

def require_jwt(required_scopes: Optional[Iterable[str]] = None):
    """
    Usage patterns you already have:

        # As a Depends:
        @router.get("/something")
        async def route(claims: dict = Depends(require_jwt(["crud:read"]))):
            ...

        # Or manually:
        claims = await require_jwt([])(request)

    This validates an Auth0 JWT from the Authorization header, enforces
    scopes/permissions if provided, and returns the decoded claims.
    """

    required_scopes = list(required_scopes or [])

    async def dependency(request: Request) -> Dict[str, Any]:
        token = _get_token_from_header(request)
        claims = decode_token(request, token)

        if required_scopes and not claims_have_scopes(
            claims, required_scopes, scope_claim="scope"
        ):
            # Also consider Auth0 `permissions` claim
            if not claims_have_scopes(claims, required_scopes, scope_claim="permissions"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient scopes for this operation",
                )

        # Make claims available to middleware (e.g., SchemaContextMiddleware)
        request.scope.setdefault("claims", claims)
        return claims

    return dependency
