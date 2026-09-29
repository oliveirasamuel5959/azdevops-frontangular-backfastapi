from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from personal_finance_api.config.settings import get_settings
from personal_finance_api.controllers.health import router as health_router
from personal_finance_api.controllers.transactions import router as transactions_router
from personal_finance_api.database.session import engine
from personal_finance_api.utils.logging import configure_logging

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    await engine.dispose()


app = FastAPI(title=get_settings().app_name, version="0.1.0", lifespan=lifespan)
app.include_router(health_router)
app.include_router(transactions_router)
