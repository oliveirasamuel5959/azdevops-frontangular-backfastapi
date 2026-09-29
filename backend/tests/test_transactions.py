from datetime import date
from decimal import Decimal
from uuid import UUID

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


async def test_list_transactions_returns_newest_first(client):
    older = {
        "type": "expense",
        "amount": "12.50",
        "category": "Groceries",
        "transaction_date": "2026-09-01",
    }
    newer = {
        "type": "income",
        "amount": "2500.00",
        "category": "Salary",
        "transaction_date": "2026-09-28",
    }
    await client.post("/api/v1/transactions", json=older)
    await client.post("/api/v1/transactions", json=newer)

    response = await client.get("/api/v1/transactions")

    assert response.status_code == 200
    assert [item["category"] for item in response.json()] == ["Salary", "Groceries"]


async def test_get_transaction_returns_persisted_record(client):
    created = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": "12.50",
            "category": "Groceries",
            "transaction_date": "2026-09-28",
        },
    )

    response = await client.get(f"/api/v1/transactions/{created.json()['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created.json()["id"]
    assert response.json()["category"] == "Groceries"


async def test_update_transaction_persists_complete_replacement(client, test_engine):
    created = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": "12.50",
            "category": "Groceries",
            "description": "Weekly shop",
            "transaction_date": "2026-09-28",
            "currency": "USD",
        },
    )
    transaction_id = created.json()["id"]
    payload = {
        "type": "income",
        "amount": "2250.75",
        "category": "Salary",
        "description": "September payroll",
        "transaction_date": "2026-09-29",
        "currency": "EUR",
    }

    response = await client.put(f"/api/v1/transactions/{transaction_id}", json=payload)

    assert response.status_code == 200
    assert response.json()["id"] == transaction_id
    assert response.json()["type"] == "income"
    assert Decimal(response.json()["amount"]) == Decimal("2250.75")
    assert response.json()["category"] == "Salary"
    assert response.json()["description"] == "September payroll"
    assert response.json()["currency"] == "EUR"

    sessions = async_sessionmaker(test_engine)
    async with sessions() as session:
        transaction = await session.get(Transaction, UUID(transaction_id))
    assert transaction is not None
    assert transaction.category == "Salary"
    assert transaction.amount == Decimal("2250.75")


async def test_invalid_update_does_not_change_transaction(client):
    created = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": "12.50",
            "category": "Groceries",
            "transaction_date": "2026-09-28",
        },
    )
    payload = {
        "type": "expense",
        "amount": "0",
        "category": "Updated category",
        "transaction_date": "2026-09-29",
        "currency": "USD",
    }

    response = await client.put(f"/api/v1/transactions/{created.json()['id']}", json=payload)
    current = await client.get(f"/api/v1/transactions/{created.json()['id']}")

    assert response.status_code == 422
    assert current.status_code == 200
    assert current.json()["category"] == "Groceries"


async def test_delete_transaction_removes_record(client, test_engine):
    created = await client.post(
        "/api/v1/transactions",
        json={
            "type": "expense",
            "amount": "12.50",
            "category": "Groceries",
            "transaction_date": "2026-09-28",
        },
    )
    transaction_id = created.json()["id"]

    response = await client.delete(f"/api/v1/transactions/{transaction_id}")
    listing = await client.get("/api/v1/transactions")

    assert response.status_code == 204
    assert listing.status_code == 200
    assert listing.json() == []
    sessions = async_sessionmaker(test_engine)
    async with sessions() as session:
        count = await session.scalar(select(func.count()).select_from(Transaction))
    assert count == 0


@pytest.mark.parametrize("method", ["get", "put", "delete"])
async def test_item_routes_return_404_for_missing_transaction(client, method):
    path = "/api/v1/transactions/7ec46be3-48c2-4acb-9ddc-3940276021dc"
    payload = {
        "type": "expense",
        "amount": "12.50",
        "category": "Groceries",
        "transaction_date": "2026-09-28",
    }

    response = await client.request(
        method,
        path,
        json=payload if method == "put" else None,
    )

    assert response.status_code == 404
