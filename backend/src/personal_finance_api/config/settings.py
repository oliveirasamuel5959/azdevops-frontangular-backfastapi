from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=False, extra="ignore")

    app_name: str = "Personal Finance API"
    database_url: str = "postgresql+asyncpg://finance_app:local_dev_change_me@localhost:5432/personal_finance"
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
