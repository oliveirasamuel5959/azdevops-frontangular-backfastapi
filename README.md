# Personal Finance Dashboard

A monolithic personal-finance web application planned with an Angular frontend, an asynchronous FastAPI backend, and PostgreSQL. The first release is a single-user demo: the dashboard uses mock data and a form writes a financial transaction to the database.

## Project documentation

- [Backend plan, requirements, and validation](specs/backend.md)
- [Frontend plan, requirements, and validation](specs/frontend.md)
- [DevOps plan, requirements, and validation](specs/devops.md)

## Architecture overview

The repository will contain independently built frontend and backend containers, orchestrated with PostgreSQL by a root-level `docker-compose.yaml`:

```text
frontend/                  Angular dashboard and Dockerfile
backend/                   FastAPI application and Dockerfile
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

The application containers and Compose file are part of the implementation plan and have not yet been added. Once implemented, start the stack with Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

Open the frontend at `http://localhost:8080`. The API will be available at `http://localhost:8000`, with interactive API documentation at `http://localhost:8000/docs`. The dashboard will submit transactions through its `/api` route; the frontend container will proxy those requests to FastAPI.

Stop the stack with `Ctrl+C`, or run:

```bash
docker compose down
```

To also remove the local PostgreSQL data volume, use `docker compose down --volumes`.

### Configuration

Copy `.env.example` to `.env` and set local PostgreSQL credentials and service ports there. The local `.env` must be ignored by Git; do not put production credentials in it. Azure environment values and GitHub Actions secrets will be configured separately for staging and production.

## Planned local validation

After implementation, the main end-to-end check will be to start the Compose stack, open the dashboard, submit a valid transaction, and verify that it is stored in PostgreSQL. See the domain specs for backend, frontend, and CI acceptance checks.

## Delivery status

This repository currently contains the project plan and documentation. The application, Dockerfiles, Compose file, environment template, and GitHub Actions workflows remain to be implemented according to the linked specs.
