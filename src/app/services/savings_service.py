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

    # 2. Execute RPC
    try:
        await client.rpc(
            "log_savings_contribution",
            {
                "p_user_id": user_id,
                "p_wallet_id": wallet_id,
                "p_target_id": target_id,
                "p_amount": amount
            }
        ).execute()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to log savings contribution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log savings contribution."
        )

    # 3. Return updated target (we can fetch it again, or just construct it)
    new_amount = target["current_amount"] + amount
    target["current_amount"] = new_amount
    return target
