"""
categories.py — FastAPI endpoint handlers for the Category resource.

Routes exposed (all under /api/v1, prefix applied in api.py)
-------------------------------------------------------------
  GET    /categories              → list[CategoryOut]
  POST   /categories              → CategoryOut          (201 Created)
  PATCH  /categories/{id}         → CategoryOut
  DELETE /categories/{id}         → 204 No Content

Categories are global per user — not scoped per wallet. The same category
(e.g. "Food") applies across all wallets, and the spending aggregate is
computed across wallets unless a wallet_id filter is active on the
summary endpoint.

This router is intentionally thin. All business logic (level gate, name
uniqueness, ownership validation) lives in wallet_service.py. This file
only declares routes, validates path/query params, and wraps responses.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from app.api.v1.dependencies import AuthUser, DBClient
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import wallet_service

router = APIRouter(tags=["categories"])


# ---------------------------------------------------------------------------
# Response envelope helpers (mirroring wallets.py)
# ---------------------------------------------------------------------------

def _ok(data: Any) -> dict[str, Any]:
    """Wrap a payload in the standard success envelope."""
    return {"success": True, "data": data}


def _no_content() -> JSONResponse:
    """Return a bare 204 No Content response."""
    return JSONResponse(status_code=status.HTTP_204_NO_CONTENT, content=None)


# ---------------------------------------------------------------------------
# Category CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/categories",
    summary="List categories",
    description=(
        "Return all active global categories owned by the authenticated user, "
        "ordered by creation date ascending. "
        "Category spending figures are available via GET /wallets/summary."
    ),
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def list_categories(
    user: AuthUser,
    db:   DBClient,
) -> dict[str, Any]:
    categories: list[CategoryOut] = await wallet_service.get_categories(db, user.user_id)
    return _ok([c.model_dump() for c in categories])


@router.post(
    "/categories",
    summary="Create category",
    description=(
        "Create a new global category. "
        "Enforces Level 1 cap (max 10 categories). "
        "Returns HTTP 403 with LEVEL_GATE_CATEGORY_CAP when the cap is reached. "
        "Returns HTTP 409 on duplicate name. "
        "monthly_limit of 0 means uncapped (no spending limit enforced)."
    ),
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
async def create_category(
    payload: CategoryCreate,
    user:    AuthUser,
    db:      DBClient,
) -> dict[str, Any]:
    category: CategoryOut = await wallet_service.create_category(
        client=db,
        user_id=user.user_id,
        payload=payload,
        current_level=user.level,
    )
    return _ok(category.model_dump())


@router.patch(
    "/categories/{category_id}",
    summary="Update category",
    description=(
        "Update a category's name and/or monthly spending limit. "
        "At least one field must be provided. "
        "Changing monthly_limit takes effect immediately on the next summary call — "
        "it does not retroactively alter historical transaction records. "
        "Returns HTTP 404 if not found, HTTP 409 on name collision."
    ),
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
async def update_category(
    category_id: UUID,
    payload:     CategoryUpdate,
    user:        AuthUser,
    db:          DBClient,
) -> dict[str, Any]:
    category: CategoryOut = await wallet_service.update_category(
        client=db,
        category_id=str(category_id),
        user_id=user.user_id,
        payload=payload,
    )
    return _ok(category.model_dump())


@router.delete(
    "/categories/{category_id}",
    summary="Delete category",
    description=(
        "Soft-delete a category. "
        "Historical transactions that reference this category are preserved — "
        "they retain the category_id foreign key but the category name will "
        "no longer resolve from the active categories list. "
        "Returns HTTP 404 if not found."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_category(
    category_id: UUID,
    user:        AuthUser,
    db:          DBClient,
) -> JSONResponse:
    await wallet_service.delete_category(
        client=db,
        category_id=str(category_id),
        user_id=user.user_id,
    )
    return _no_content()
