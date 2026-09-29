from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from personal_finance_api.database.session import get_session
from personal_finance_api.schemas.transaction import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
)
from personal_finance_api.services.transactions import TransactionService

router = APIRouter(prefix="/api/v1/transactions", tags=["transactions"])


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    payload: TransactionCreate,
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> TransactionResponse:
    transaction = await TransactionService(session).create(payload)
    return TransactionResponse.model_validate(transaction)


@router.get("", response_model=list[TransactionResponse])
async def list_transactions(
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> list[TransactionResponse]:
    transactions = await TransactionService(session).list_all()
    return [TransactionResponse.model_validate(item) for item in transactions]


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: UUID,
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> TransactionResponse:
    transaction = await TransactionService(session).get_by_id(transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return TransactionResponse.model_validate(transaction)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: UUID,
    payload: TransactionUpdate,
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> TransactionResponse:
    transaction = await TransactionService(session).update(transaction_id, payload)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return TransactionResponse.model_validate(transaction)


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    session: AsyncSession = Depends(get_session),  # noqa: B008
) -> Response:
    deleted = await TransactionService(session).delete(transaction_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
