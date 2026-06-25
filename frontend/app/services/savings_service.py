"""
app/services/savings_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business logic layer for savings targets and income streams.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.transaction import PaymentMethod, TransactionCreate, TransactionType
from app.services.transaction_service import create_transaction


def recalculate_scalars(client: Client, user_id: str) -> None:
    """
    Recalculates and updates the scalar `expected_monthly_income` and
    `monthly_savings_target` on the `journey_profiles` table.
    
    Must be called after any CRUD mutation on `income_streams` or `savings_targets`.
    """
    # 1. Sum active income streams
    income_res = (
        client.table("income_streams")
        .select("amount")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    total_income = sum(item["amount"] for item in income_res.data) if income_res.data else 0

    # 2. Sum active savings contributions
    savings_res = (
        client.table("savings_targets")
        .select("monthly_contribution")
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .execute()
    )
    total_savings = sum(item["monthly_contribution"] for item in savings_res.data) if savings_res.data else 0

    # 3. Update journey_profiles
    client.table("journey_profiles").update({
        "expected_monthly_income": total_income,
        "monthly_savings_target": total_savings
    }).eq("id", user_id).execute()


def log_savings(
    client: Client,
    user_id: str,
    target_id: str,
    amount: int,
    wallet_id: str,
    note: str | None = None
) -> dict:
    """
    Log savings to a target.
    1. Deducts from wallet by creating an EXPENSE transaction tied to savings_target_id.
    2. Updates current_amount on savings_target.
    
    Note: Does NOT trigger scalar recalculation, because it only affects
    current_amount, not the monthly_contribution target.
    """
    # 1. Fetch current savings target
    target_res = (
        client.table("savings_targets")
        .select("*")
        .eq("id", target_id)
        .eq("user_id", user_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not target_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "TARGET_NOT_FOUND", "message": "Savings target not found or deleted."},
        )
    target = target_res.data

    # 2. Create transaction (will deduct from wallet inside transaction_service)
    txn_payload = TransactionCreate(
        type=TransactionType.expense,
        amount=amount,
        wallet_id=UUID(wallet_id),
        savings_target_id=UUID(target_id),
        payment_method=PaymentMethod.other,
        transaction_date=datetime.now().date(),
        note=note or "Logged to Savings Target"
    )
    
    # This automatically validates ownership and applies the balance deduction.
    create_transaction(client, user_id, txn_payload)

    # 3. Update savings target progress
    new_amount = target["current_amount"] + amount
    updated_res = (
        client.table("savings_targets")
        .update({"current_amount": new_amount})
        .eq("id", target_id)
        .execute()
    )

    return updated_res.data[0]
