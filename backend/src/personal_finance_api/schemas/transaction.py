from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


class TransactionType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"


Category = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
CurrencyCode = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}$", min_length=3, max_length=3)]


class TransactionCreate(BaseModel):
    type: TransactionType
    amount: Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
    category: Category
    description: Annotated[str | None, Field(max_length=500)] = None
    transaction_date: date
    currency: CurrencyCode = "USD"

    @field_validator("description")
    @classmethod
    def blank_description_is_none(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            return None
        return value.strip() if value is not None else None


class TransactionUpdate(TransactionCreate):
    """Complete replacement data for an existing transaction."""


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: TransactionType
    amount: Decimal
    category: str
    description: str | None
    transaction_date: date
    currency: str
    created_at: datetime
