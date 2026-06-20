from typing import Any

import jwt
from jwt import InvalidTokenError
from fastapi import HTTPException, status

from app.core.config import settings

_ALGORITHM = "HS256"


def verify_supabase_jwt(token: str) -> dict[str, Any]:
    """
    Decode and verify a Supabase-issued JWT.
    Returns the payload on success; raises HTTP 401 on failure.
    """
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[_ALGORITHM],
            audience="authenticated",
        )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
