from sqlalchemy.ext.asyncio import AsyncSession

from personal_finance_api.models.transaction import Transaction
from personal_finance_api.repositories.transactions import TransactionRepository
from personal_finance_api.schemas.transaction import TransactionCreate


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
