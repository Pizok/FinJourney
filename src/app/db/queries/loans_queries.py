from datetime import datetime, timezone
import uuid
from typing import Any, Optional
from supabase import AsyncClient

def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

async def get_loans_by_user(db: AsyncClient, user_id: str) -> list[dict[str, Any]]:
    response = await (
        db.table("loans")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .execute()
    )
    return response.data or []

async def insert_loan(
    db: AsyncClient,
    user_id: str,
    name: str,
    total_amount: float,
    paid_amount: float,
    next_due_date: str,
    monthly_installment: float,
) -> dict[str, Any]:
    payload = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": name,
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "next_due_date": next_due_date,
        "monthly_installment": monthly_installment,
        "created_at": _now_utc(),
    }
    response = await db.table("loans").insert(payload).execute()
    return response.data[0]

async def update_loan(
    db: AsyncClient,
    loan_id: str,
    user_id: str,
    updates: dict[str, Any],
) -> dict[str, Any]:
    # only mutable fields
    safe_updates = {k: v for k, v in updates.items() if k in {"name", "total_amount", "paid_amount", "next_due_date", "monthly_installment"}}
    response = await (
        db.table("loans")
        .update(safe_updates)
        .eq("id", loan_id)
        .eq("user_id", user_id)
        .execute()
    )
    return response.data[0] if response.data else {}

async def hard_delete_loan(
    db: AsyncClient,
    loan_id: str,
    user_id: str,
) -> None:
    await (
        db.table("loans")
        .delete()
        .eq("id", loan_id)
        .eq("user_id", user_id)
        .execute()
    )
