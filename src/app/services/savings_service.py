"""
app/services/savings_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business logic layer for savings targets and income streams.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.schemas.transaction import PaymentMethod, TransactionCreate, TransactionType
from app.services.transaction_service import create_transaction


async def log_savings(
    client: AsyncClient,
    user_id: str,
    target_id: str,
    amount: int,
    wallet_id: str,
    note: str | None = None
) -> dict:
    # 1. Ensure target exists and belongs to user
    target_res = await (
        client.table("savings_targets")
        .select("*")
        .eq("id", target_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .maybe_single()
        .execute()
    )
    target = target_res.data
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Savings target not found."
        )

    # 2. Create the associated expense transaction manually (bypassing sync transaction_service)
    import uuid
    from datetime import datetime, timezone

    # Deduct wallet balance
    wallet_res = await client.table("wallets").select("balance").eq("id", wallet_id).eq("user_id", user_id).maybe_single().execute()
    if wallet_res.data:
        new_balance = wallet_res.data["balance"] - amount
        await client.table("wallets").update({"balance": new_balance}).eq("id", wallet_id).execute()

    # Insert transaction
    tx_row = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "wallet_id": wallet_id,
        "type": "expense",
        "amount": amount,
        "payment_method": "cash",
        "note": note or f"Contribution to {target['name']}",
        "transaction_date": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    await client.table("transactions").insert(tx_row).execute()

    # 3. Update target balance
    new_amount = target["current_amount"] + amount
    
    # Optional: If new_amount >= target_amount, mark as completed?
    # Keeping it simple for MVP: just update the balance.
    update_res = await (
        client.table("savings_targets")
        .update({"current_amount": new_amount})
        .eq("id", target_id)
        .execute()
    )
    
    return update_res.data[0]
