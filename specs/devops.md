# DevOps Plan, Requirements, and Validation

## Goal and scope

Provide a local Docker Compose stack and GitHub Actions CI for the Angular/FastAPI/PostgreSQL monolith. Deploy the current production frontend/API pair to Azure Container Apps through a manually invoked workflow. Staging remains future work until separate staging apps and a database are provisioned.

## Requirements

### Local containers and configuration

- Keep the frontend and backend independently buildable, with `frontend/Dockerfile` and `backend/Dockerfile`.
- Add a root `docker-compose.yaml` with `frontend`, `backend`, and `postgres` services, a persistent PostgreSQL volume, health checks, and dependency readiness conditions.
- Use `.env` for local Compose interpolation and service configuration. Commit `.env.example` with variable names and safe local placeholders; ignore `.env` and never commit real credentials.
- Include configuration for the PostgreSQL database/user/password and ports, the async backend database URL, and frontend/backend host ports. Keep service-to-service URLs on the Compose network and route frontend `/api` calls to FastAPI.
- Publish useful local ports (planned defaults: frontend `8080`, API `8000`, PostgreSQL `5432`) and allow overrides via `.env`.
- Support a persistent local database volume and document how to stop the stack with and without deleting persisted data.

### CI and deployment workflow

- Add GitHub Actions CI for pull requests and pushes to the primary branch. It should install locked backend/frontend dependencies, run backend lint and tests, run frontend checks/tests/build, and build both container images.
- Add a Compose-backed integration validation that waits for healthy services, posts a transaction, and confirms the API and database path works.
- Add a separate `workflow_dispatch` deployment workflow for the production Container Apps pair. It should build and tag frontend/backend images with the source commit, push both images to ACR, apply a one-off database migration job, and update the API and frontend Container Apps.
- Gate production with a required GitHub Environment approval. Use OIDC/federated credentials where configured instead of long-lived Azure credentials.
- Document required Azure resources and configuration: ACR, the Container Apps environment and separate frontend/API Container Apps, Azure Database for PostgreSQL, networking, TLS, Container Apps secrets/variables, and GitHub Environment configuration.
- Do not use the local `.env` file as an Azure secret source. Keep production configuration and data separate from any future staging environment.
- Run schema migrations in a single-replica Container Apps Job before the new API image receives traffic. Keep `RUN_MIGRATIONS=false` on the long-running API Container App so scaling replicas cannot race migrations.

### Azure workflow configuration contract

The manual workflow runs from `main` and targets the protected GitHub Environment `production`. Configure this GitHub Environment with:

- Variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for GitHub OIDC.
- Variables `ACR_NAME=acrfinancialapp`, `ACR_LOGIN_SERVER=acrfinancialapp.azurecr.io`, `RESOURCE_GROUP=rg-financial-app`, and `ACA_ENVIRONMENT=managedEnvironment-rgfinancialapp-9076`.
- Variables `BACKEND_APP_NAME=financialapp` and `FRONTEND_APP_NAME=frontendfinanceapp`.
- Secret `DATABASE_URL`, matching the database URL already referenced by the backend Container App.
- Optionally set `NGINX_RESOLVER`; the workflow defaults it to `127.0.0.11` for the Container Apps environment.

Create a GitHub OIDC federated credential with subject `repo:<owner>/<repository>:environment:production`. Grant its identity `AcrPush` on ACR and permissions to update the Container Apps and create/start a Container Apps Job in `rg-financial-app`. The Container Apps environment's `system-environment` identity must retain `AcrPull` on ACR. The migration runs inside the Container Apps environment, so the GitHub runner doesn't need database network access.

The `DATABASE_URL` GitHub Environment secret must use TLS and connect to the production Azure Database for PostgreSQL instance. The workflow stores it as a secret on its migration Job and does not print it. Never copy values from the local `.env` file into Azure.

The workflow runs the migration Job with one replica, waits for it to succeed, then deploys the API and frontend images tagged with the commit SHA. Database changes must remain compatible with the currently serving API during this migration step.

Configure the `production` GitHub Environment with required reviewers. The backend Container App listens on port `8000`; the frontend listens on port `80` and receives `API_UPSTREAM`, `API_UPSTREAM_HOST`, and `NGINX_RESOLVER` from the workflow. The workflow derives the API HTTPS hostname from the backend Container App.

## Implementation plan

1. Add `.gitignore` protection and `.env.example`; document the configuration contract.
2. Add Compose services, health checks, persistent storage, and local API proxy/network behavior.
3. Add developer commands/run instructions to `README.md` and verify the full local stack.
4. Add CI workflows for locked installs, backend/frontend checks, container builds, and an API/database integration smoke test.
5. Replace the App Service deployment scaffold with a manually triggered, production-protected Container Apps deployment workflow.
6. Configure the production GitHub Environment, OIDC permissions, Container Apps environment identity, and DATABASE_URL secret; provision a separate staging stack before adding staging deployments.

## Validation and acceptance criteria

- A clean checkout can follow the README setup, create `.env` from `.env.example`, and start all services with Docker Compose.
- Compose reports PostgreSQL and backend healthy before dependent services are considered ready; data remains after a normal `docker compose down` and is removed only when the volume is explicitly deleted.
- Frontend access works at the documented local URL, and a transaction submitted through the frontend reaches the API and is persisted in PostgreSQL.
- CI runs on pull requests and relevant branch pushes, fails on backend/frontend check failures, and builds both Docker images.
- The integration job validates transaction persistence against the Compose PostgreSQL service.
- Deployment is manual to the production Container Apps pair; production requires a GitHub Environment approval gate.
- Migrations complete once in a Container Apps Job before the new API revision receives traffic; the serving API has `RUN_MIGRATIONS=false`.
- Production frontend and backend images are traceable to the source commit and are pushed to ACR before Container Apps rollout.
- Secrets are not printed in logs, committed to the repository, or embedded in container image layers.
