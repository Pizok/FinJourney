from fastapi import APIRouter, status
from pydantic import BaseModel
from typing import Optional
from app.api.v1.dependencies import AuthUser, DbClient
from app.db.queries.loans_queries import insert_loan, update_loan, hard_delete_loan

router = APIRouter(prefix="/loans", tags=["loans"])

class LoanCreate(BaseModel):
    name: str
    total_amount: float
    paid_amount: float = 0
    next_due_date: str
    monthly_installment: float

class LoanUpdate(BaseModel):
    name: Optional[str] = None
    total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    next_due_date: Optional[str] = None
    monthly_installment: Optional[float] = None

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a loan",
)
async def create_loan(
    body: LoanCreate,
    user: AuthUser,
    db: DbClient,
):
    loan = await insert_loan(
        db,
        user_id=user.user_id,
        name=body.name,
        total_amount=body.total_amount,
        paid_amount=body.paid_amount,
        next_due_date=body.next_due_date,
        monthly_installment=body.monthly_installment,
    )
    return {"success": True, "data": loan}

@router.patch(
    "/{loan_id}",
    status_code=status.HTTP_200_OK,
    summary="Update a loan",
)
async def patch_loan(
    loan_id: str,
    body: LoanUpdate,
    user: AuthUser,
    db: DbClient,
):
    loan = await update_loan(
        db,
        loan_id=loan_id,
        user_id=user.user_id,
        updates=body.model_dump(exclude_unset=True),
    )
    return {"success": True, "data": loan}

@router.delete(
    "/{loan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hard-delete a loan",
)
async def delete_loan(
    loan_id: str,
    user: AuthUser,
    db: DbClient,
):
    await hard_delete_loan(db, loan_id, user.user_id)

class LoanRepayRequest(BaseModel):
    amount: float
    wallet_id: str

@router.post(
    "/{loan_id}/repay",
    status_code=status.HTTP_200_OK,
    summary="Log a loan repayment",
)
async def repay_loan(
    loan_id: str,
    body: LoanRepayRequest,
    user: AuthUser,
    db: DbClient,
):
    from fastapi import HTTPException
    try:
        await db.rpc(
            "log_loan_repayment",
            {
                "p_user_id": user.user_id,
                "p_wallet_id": body.wallet_id,
                "p_loan_id": loan_id,
                "p_amount": body.amount
            }
        ).execute()
        return {"success": True}
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to log loan repayment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to log loan repayment."
        )
