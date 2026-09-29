from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from personal_finance_api.database.session import get_session
from personal_finance_api.schemas.transaction import TransactionCreate, TransactionResponse
from personal_finance_api.services.transactions import TransactionService

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> TransactionResponse:
    transaction = await TransactionService(session).create(payload)
    return TransactionResponse.model_validate(transaction)
