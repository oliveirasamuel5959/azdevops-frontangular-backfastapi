from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from personal_finance_api.models.transaction import Transaction


class TransactionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, transaction: Transaction) -> Transaction:
        self.session.add(transaction)
        await self.session.flush()
        await self.session.refresh(transaction)
        return transaction

    async def list_all(self) -> list[Transaction]:
        statement = select(Transaction).order_by(
            Transaction.transaction_date.desc(),
            Transaction.created_at.desc(),
        )
        result = await self.session.scalars(statement)
        return list(result.all())

    async def get_by_id(self, transaction_id: UUID) -> Transaction | None:
        return await self.session.get(Transaction, transaction_id)

    async def delete(self, transaction: Transaction) -> None:
        await self.session.delete(transaction)
        await self.session.flush()
