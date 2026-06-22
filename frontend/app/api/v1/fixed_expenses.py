from fastapi import APIRouter, status
from pydantic import BaseModel
from typing import Optional, Any
from app.api.v1.dependencies import AuthUser, DbClient
from app.db.queries.fixed_expenses_queries import insert_fixed_expense, hard_delete_fixed_expense

router = APIRouter(prefix="/fixed-expenses", tags=["fixed-expenses"])

class FixedExpenseCreate(BaseModel):
    name: str
    amount: float
    recurrence_type: str
    recurrence_value: Optional[Any] = None

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a fixed expense",
)
async def create_fixed_expense(
    body: FixedExpenseCreate,
    user: AuthUser,
    db: DbClient,
):
    expense = await insert_fixed_expense(
        db,
        user_id=user.user_id,
        name=body.name,
        amount=body.amount,
        recurrence_type=body.recurrence_type,
        recurrence_value=body.recurrence_value,
    )
    return {"success": True, "data": expense}

@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hard-delete a fixed expense",
)
async def delete_fixed_expense(
    expense_id: str,
    user: AuthUser,
    db: DbClient,
):
    await hard_delete_fixed_expense(db, expense_id, user.user_id)
