from typing import Any

import jwt
from jwt import InvalidTokenError, PyJWKClient
from fastapi import HTTPException, status

from app.core.config import settings


# Supabase publishes JWKS at the project root (not under /auth/v1/)
_jwk_client = PyJWKClient(
    f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
    headers={"apikey": settings.supabase_service_key},
)


def verify_supabase_jwt(token: str) -> dict[str, Any]:
    """
    Decode and verify a Supabase-issued JWT.
    Supports both legacy HS256 (JWT secret) and modern RS256/ES256 (JWKS).
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "HS256":
            # Legacy symmetric verification
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            # Modern asymmetric verification (RS256, ES256)
            signing_key = _jwk_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
            )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
