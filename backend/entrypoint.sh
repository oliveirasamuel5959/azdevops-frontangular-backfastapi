#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  uv run --no-sync alembic upgrade head
fi

exec uv run --no-sync uvicorn personal_finance_api.main:app --host 0.0.0.0 --port 8000
