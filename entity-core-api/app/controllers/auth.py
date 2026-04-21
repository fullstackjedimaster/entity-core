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
EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET")
if not AUTH0_DOMAIN or not AUTH0_AUDIENCE or not AUTH0_ISSUER:
    raise RuntimeError(
        "[ec-control] AUTH0_DOMAIN, AUTH0_AUDIENCE, and AUTH0_ISSUER must be set "
        "for JWT validation."
    )


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------

def _get_token_from_header(request: Request) -> str:
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        scheme, token = auth_header.split(" ", 1)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token.strip()


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
    Supports:
      - Auth0 RS256 tokens (external users)
      - HS256 internal service tokens (entity-core → entity-server)
    """

    # --- Try HS256 (internal service) FIRST ---
    try:
        claims = jwt.decode(
            token,
            EC_SHARED_JWT_SECRET,
            algorithms=["HS256"],
        )
        if isinstance(claims, dict):
            claims["_internal"] = True
            return claims
    except Exception:
        pass  # fall through to Auth0

    # --- Fallback to Auth0 RS256 ---
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


SCHEMA_CLAIM = "https://fullstackjedi.dev/schema"

def require_jwt(required_permissions: Optional[Iterable[str]] = None):
    required_permissions = set(required_permissions or [])

    async def dependency(request: Request) -> Dict[str, Any]:
        token = _get_token_from_header(request)
        claims = decode_token(request, token)

        if required_permissions:
            scope_str = claims.get("scope", "")
            scope_list = scope_str.split() if isinstance(scope_str, str) else []

            permissions = claims.get("permissions", [])
            if isinstance(permissions, str):
                permissions = [permissions]

            if not (
                required_permissions.issubset(set(scope_list)) or
                required_permissions.issubset(set(permissions))
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions",
                )

        request.state.claims = claims
        request.state.schema = (
                claims.get(SCHEMA_CLAIM)
                or claims.get("schema")  # optional fallback
        )


        return claims

    return dependency