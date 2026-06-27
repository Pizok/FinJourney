from datetime import datetime, timezone
import uuid
from typing import Any, Optional
from supabase import AsyncClient

def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

async def get_fixed_expenses_by_user(db: AsyncClient, user_id: str) -> list[dict[str, Any]]:
    response = await (
        db.table("fixed_expenses")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []

async def insert_fixed_expense(
    db: AsyncClient,
    user_id: str,
    name: str,
    amount: float,
    recurrence_type: str,
    recurrence_value: Any,
) -> dict[str, Any]:
    payload = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": name,
        "amount": amount,
        "recurrence_type": recurrence_type,
        "recurrence_value": str(recurrence_value) if recurrence_value is not None else None,
        "created_at": _now_utc(),
    }
    response = await db.table("fixed_expenses").insert(payload).execute()
    return response.data[0]

async def hard_delete_fixed_expense(
    db: AsyncClient,
    expense_id: str,
    user_id: str,
) -> None:
    await (
        db.table("fixed_expenses")
        .delete()
        .eq("id", expense_id)
        .eq("user_id", user_id)
        .execute()
    )

async def update_fixed_expense(
    db: AsyncClient,
    expense_id: str,
    user_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    if "recurrence_value" in updates and updates["recurrence_value"] is not None:
        updates["recurrence_value"] = str(updates["recurrence_value"])
    response = await (
        db.table("fixed_expenses")
        .update(updates)
        .eq("id", expense_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else None
