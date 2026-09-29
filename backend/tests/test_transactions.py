from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from personal_finance_api.models.transaction import Transaction


@pytest.mark.parametrize(
    "payload",
    [
        {
            "type": "expense",
            "amount": "12.50",
            "category": "Groceries",
            "description": "Weekly shop",
            "transaction_date": "2026-09-28",
            "currency": "USD",
        },
        {
            "type": "income",
            "amount": "2500.00",
            "category": "Salary",
            "transaction_date": "2026-09-01",
        },
    ],
)
async def test_create_transaction_persists_and_returns_record(client, test_engine, payload):
    response = await client.post("/api/v1/transactions", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["type"] == payload["type"]
    assert Decimal(body["amount"]) == Decimal(payload["amount"])
    assert body["category"] == payload["category"]
    assert body["transaction_date"] == payload["transaction_date"]
    assert body["currency"] == payload.get("currency", "USD")
    assert body["id"]

    sessions = async_sessionmaker(test_engine)
    async with sessions() as session:
        count = await session.scalar(select(func.count()).select_from(Transaction))
    assert count == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"type": "transfer"},
        {"amount": "0"},
        {"amount": "-1.00"},
        {"amount": "1.234"},
        {"currency": "usd"},
        {"category": "   "},
        {"transaction_date": "not-a-date"},
    ],
)
async def test_invalid_transaction_is_rejected_without_persistence(client, test_engine, overrides):
    payload = {
        "type": "expense",
        "amount": "10.00",
        "category": "Utilities",
        "transaction_date": date.today().isoformat(),
        "currency": "USD",
    }
    payload.update(overrides)

    response = await client.post("/api/v1/transactions", json=payload)

    assert response.status_code == 422
    sessions = async_sessionmaker(test_engine)
    async with sessions() as session:
        count = await session.scalar(select(func.count()).select_from(Transaction))
    assert count == 0


async def test_liveness_does_not_require_database(client):
    response = await client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
