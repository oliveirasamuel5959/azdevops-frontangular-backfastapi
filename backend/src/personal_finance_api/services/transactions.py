from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from personal_finance_api.models.transaction import Transaction
from personal_finance_api.repositories.transactions import TransactionRepository
from personal_finance_api.schemas.transaction import TransactionCreate, TransactionUpdate


class TransactionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = TransactionRepository(session)

    async def create(self, data: TransactionCreate) -> Transaction:
        transaction = Transaction(
            type=data.type.value,
            amount=data.amount,
            category=data.category,
            description=data.description,
            transaction_date=data.transaction_date,
            currency=data.currency,
        )
        await self.repository.add(transaction)
        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction

    async def list_all(self) -> list[Transaction]:
        return await self.repository.list_all()

    async def get_by_id(self, transaction_id: UUID) -> Transaction | None:
        return await self.repository.get_by_id(transaction_id)

    async def update(
        self,
        transaction_id: UUID,
        data: TransactionUpdate,
    ) -> Transaction | None:
        transaction = await self.repository.get_by_id(transaction_id)
        if transaction is None:
            return None

        transaction.type = data.type.value
        transaction.amount = data.amount
        transaction.category = data.category
        transaction.description = data.description
        transaction.transaction_date = data.transaction_date
        transaction.currency = data.currency
        await self.session.commit()
        await self.session.refresh(transaction)
        return transaction

    async def delete(self, transaction_id: UUID) -> bool:
        transaction = await self.repository.get_by_id(transaction_id)
        if transaction is None:
            return False

        await self.repository.delete(transaction)
        await self.session.commit()
        return True
