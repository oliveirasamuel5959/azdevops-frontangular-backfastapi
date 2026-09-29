FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.15 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
RUN uv sync --locked --no-dev

COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && useradd --create-home --uid 10001 app && chown -R app:app /app

USER app
EXPOSE 8000
CMD ["./entrypoint.sh"]
