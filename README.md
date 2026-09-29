# Personal Finance Dashboard

A monolithic personal-finance web application with an Angular frontend, an asynchronous FastAPI backend, and PostgreSQL. The first release is a single-user demo: its dashboard summarizes stored transactions and lets the user create, update, and delete financial records.

## Project documentation

- [Backend plan, requirements, and validation](specs/backend.md)
- [Frontend plan, requirements, and validation](specs/frontend.md)
- [DevOps plan, requirements, and validation](specs/devops.md)

## Architecture overview

The repository contains independently built frontend and backend containers, orchestrated with PostgreSQL by the root-level `docker-compose.yaml`:

```text
frontend/                  Angular dashboard, Dockerfile, and Nginx API proxy
backend/                   FastAPI application, migrations, tests, and Dockerfile
  pyproject.toml           Python dependencies and project metadata (uv)
  uv.lock                  Locked Python dependencies
  src/personal_finance_api/
    config/                Settings and environment configuration
    controllers/           HTTP routes
    database/              Async SQLAlchemy engine and sessions
    models/                SQLAlchemy table models
    repositories/          Async database access
    schemas/               Pydantic request and response schemas
    services/              Business logic
    utils/                 Logging and shared utilities
specs/                     Domain plans and acceptance criteria
.github/workflows/         CI and deployment-ready GitHub Actions workflows
docker-compose.yaml        Local frontend, backend, and PostgreSQL services
```

## Run locally

With Docker Engine and Docker Compose V2 installed, start the stack with:

```bash
cp .env.example .env
docker compose up --build
```

Open the frontend at `http://localhost:8080`. The API will be available at `http://localhost:8000`, with interactive API documentation at `http://localhost:8000/docs`. The dashboard submits transactions through its `/api` route; the frontend container proxies those requests to FastAPI. PostgreSQL data persists across normal stops.

Stop the stack with `Ctrl+C`, or run:

```bash
docker compose down
```

To also remove the local PostgreSQL data volume, use `docker compose down --volumes`.

### Configuration

Copy `.env.example` to `.env` and set local PostgreSQL credentials, the matching async `DATABASE_URL`, and service ports there. The local `.env` must be ignored by Git; do not put production credentials in it. Azure environment values and GitHub Actions secrets will be configured separately for staging and production.

## Local validation

The main end-to-end check is to start the Compose stack, open the dashboard, submit a valid transaction, and verify that it is stored in PostgreSQL. The backend readiness endpoint is available at `http://localhost:8000/health/ready`. See the domain specs for backend and frontend checks.

## Delivery status

The Angular dashboard, FastAPI transaction API, PostgreSQL migration, Dockerfiles, local Compose stack, GitHub Actions CI, and manually triggered production Azure Container Apps deployment workflow are implemented. Configure the production GitHub Environment's OIDC variables, database secret, and required reviewers before dispatching deployments; see the [DevOps spec](specs/devops.md).
