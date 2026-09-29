# Backend Plan, Requirements, and Validation

## Goal and scope

Build an asynchronous FastAPI service for the personal-finance dashboard. The initial release is a single-user demo with no authentication. The dashboard reads and writes financial transactions in PostgreSQL and derives its transaction summaries from those records.

## Requirements

### Technology

- Declare Python project metadata and dependencies in `backend/pyproject.toml`; use `uv` to add/sync dependencies and maintain the committed `backend/uv.lock` lockfile for reproducible local and container installs.
- Use FastAPI with `async def` route handlers and SQLAlchemy's async APIs.
- Connect to PostgreSQL using the async PostgreSQL driver (`asyncpg`).
- Use Pydantic schemas for request and response validation, and environment-based settings for configuration.
- Use Alembic for versioned schema migrations.
- Include backend linting and asynchronous API/database tests in CI.

### Required package layout

Use the Python `src/` layout. Replace `personal_finance_api` below with the chosen distribution/package name if it changes, and keep the requested responsibilities separate:

```text
backend/
  src/
    personal_finance_api/
      __init__.py
      config/       Settings and environment configuration
      controllers/  FastAPI routers and HTTP-level concerns
      database/     Async engine, session factory, and session dependency
      models/       SQLAlchemy table definitions
      repositories/ Async SQLAlchemy persistence queries
      schemas/      Pydantic input/output schemas
      services/     Business rules and transaction use cases
      utils/        Logging and shared utility logic
  alembic/        Migration environment and revision files
  tests/          Unit and API/integration tests
  Dockerfile
  pyproject.toml
  uv.lock
```

Use absolute imports from the named package (for example, `from personal_finance_api.services.transaction_service import TransactionService`). Treat `src/` as the source root, not as an import package; application code should not rely on working-directory-relative imports. Configure the package build/discovery in `pyproject.toml` so the package installs correctly in development, tests, and the container.

Controllers must delegate business logic to services. Services use repositories for persistence; repositories receive an async SQLAlchemy session rather than creating their own engines or sessions. The session lifecycle is managed centrally by `database/` and injected into requests.

### Data and API

- Define a transaction model with an identifier, transaction type (`income` or `expense`), positive decimal amount, category, optional description, transaction date, currency code, and creation timestamp.
- Persist monetary values using a fixed-precision decimal database type; do not use binary floating-point values for money.
- Define separate Pydantic schemas for transaction creation and transaction responses. Validate the transaction type, positive amount, date, and currency format at the request boundary.
- Provide `POST /api/v1/transactions`, returning HTTP `201` and the persisted transaction representation on success.
- Provide `GET /api/v1/transactions`, returning persisted transactions ordered by transaction date and creation time, newest first; provide `GET /api/v1/transactions/{id}` for a single record.
- Provide `PUT /api/v1/transactions/{id}` for a validated full replacement and `DELETE /api/v1/transactions/{id}` returning HTTP `204` after deletion.
- Return HTTP `404` for item GET, PUT, or DELETE requests when the transaction does not exist.
- Expose liveness and readiness health endpoints. Readiness should verify that the service can connect to PostgreSQL.
- Publish the OpenAPI schema and interactive docs in local development.
- Return consistent validation and server error responses without leaking credentials or database internals.
- Keep authentication and user-account modeling out of the first version; scope those before introducing real personal data or multi-user behavior.

### Configuration and operations

- Read the async database URL and runtime settings from environment variables supplied by Compose or the deployment platform.
- Emit structured, useful application logs through `utils/`; never log credentials or full sensitive financial payloads.
- Provide a backend Dockerfile suitable for local Compose and registry image builds.
- Apply Alembic migrations as an explicit deployment/startup step before serving requests. Avoid having multiple production replicas race to run migrations.

## Implementation plan

1. Initialize `backend/pyproject.toml` with `uv`, establish the `src/personal_finance_api/` package layout and import convention, and add configuration, logging, and async SQLAlchemy session management.
2. Add the transaction model, initial Alembic migration, and create/response schemas.
3. Implement create, list, get, update, delete, and health operations through the repository, service, and controller layers using async functions end to end.
4. Add tests using isolated database state, including request validation, successful persistence, and error cases.
5. Add the backend Dockerfile and wire health checks, environment, and migrations into the local Compose workflow.
6. Run formatting/lint, unit and API tests, migration checks, and image build in CI.

## Validation and acceptance criteria

- From `backend/`, `uv sync --locked` installs the dependencies declared in `pyproject.toml` reproducibly, and the package imports work from an installed environment rather than depending on the repository root being on `PYTHONPATH`.
- Static checks pass and test coverage exercises transaction validation and the create use case.
- An API integration test posts a valid transaction and confirms the returned record was committed and can be read back from PostgreSQL.
- List and item GET routes return persisted records; PUT changes are persisted, invalid replacements leave the row unchanged, and DELETE removes the row.
- Item GET, PUT, and DELETE return `404` for unknown transaction identifiers.
- Invalid transaction types, non-positive amounts, and malformed input are rejected with appropriate client errors and create no database row.
- Alembic can create a fresh schema and upgrade an existing test database to the latest revision.
- Liveness succeeds without requiring database availability; readiness reports failure when PostgreSQL is unavailable and success when it is reachable.
- The backend image builds and starts in Compose, and its health endpoint becomes healthy after the database is ready.
