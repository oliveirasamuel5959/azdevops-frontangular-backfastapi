# DevOps Plan, Requirements, and Validation

## Goal and scope

Provide a local Docker Compose stack and GitHub Actions CI for the Angular/FastAPI/PostgreSQL monolith. Prepare an explicit, manually invoked deployment workflow for later Azure staging and production deployment. Azure infrastructure and active production rollout are future work, not prerequisites for local development.

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
- Add a separate `workflow_dispatch` deployment workflow scaffold. It should select staging or production through protected GitHub Environments, build/tag/push frontend and backend images to Azure Container Registry (ACR), then deploy the corresponding images to Azure App Service.
- Gate production with a required GitHub Environment approval. Use OIDC/federated credentials where configured instead of long-lived Azure credentials.
- Document required Azure resources and configuration before enabling deployment: ACR, separate frontend/API App Service apps for staging and production (or an explicitly chosen equivalent topology), Azure Database for PostgreSQL, secure networking, TLS, app settings, and GitHub environment secrets/variables.
- Keep staging and production configuration/data separate. Do not use the local `.env` file as an Azure secret source.
- Run schema migrations as a controlled deployment step before the new API version receives traffic; do not allow competing app replicas to apply migrations concurrently.

### Azure workflow configuration contract

The manual workflow runs from `main` and targets the selected GitHub Environment (`staging` or `production`). Configure each GitHub Environment independently with these variables:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for the Azure workload identity used by GitHub OIDC.
- `ACR_NAME` and `ACR_LOGIN_SERVER` for the registry; `RESOURCE_GROUP` for the target apps.
- `FRONTEND_APP_NAME` and `BACKEND_APP_NAME` for that environment's Linux App Service apps.
- `API_UPSTREAM` as the HTTPS base URL (without a trailing slash) of the matching API app, and optionally `NGINX_RESOLVER` if the environment uses a custom DNS resolver. The workflow defaults this resolver to `168.63.129.16`.

Optionally set the repository-level variable `DEPLOY_RUNNER` to a JSON array of runner labels when the default `ubuntu-latest` runner cannot reach private Azure resources (for example, `["self-hosted", "linux", "x64", "azure-vnet"]`). The runner must have Docker, Azure CLI, `curl`, and `jq` available.

Configure the environment-specific `DATABASE_URL` as a GitHub Environment secret. It must use TLS and connect only to that environment's Azure Database for PostgreSQL instance. If the database or App Services are private, use a self-hosted deployment runner with network access to both. Never copy values from the local `.env` file into Azure.

Create an OIDC federated credential for each GitHub Environment subject (`repo:<owner>/<repository>:environment:<environment>`). Grant that identity `AcrPush` on ACR and the minimum permissions needed to update the target App Services. Enable a system-assigned identity on each App Service and grant it `AcrPull` on the registry; the workflow configures App Service to use that identity for image pulls. Set the backend app's `RUN_MIGRATIONS=false`; the workflow runs the new backend image once as a migration command before updating the API app image. Database changes must remain compatible with the currently serving API during this migration step.

Before enabling production deployment, configure the `production` GitHub Environment with required reviewers. Provision separate staging and production databases and app settings, private networking and TLS as required, and separate frontend/API App Service apps for each environment. Set the frontend app to port `80`, the API app to port `8000`, and the frontend's `API_UPSTREAM` to the same-environment API HTTPS URL. The workflow tags both images with the source commit SHA.

## Implementation plan

1. Add `.gitignore` protection and `.env.example`; document the configuration contract.
2. Add Compose services, health checks, persistent storage, and local API proxy/network behavior.
3. Add developer commands/run instructions to `README.md` and verify the full local stack.
4. Add CI workflows for locked installs, backend/frontend checks, container builds, and an API/database integration smoke test.
5. Add a manually triggered Azure deployment workflow with staging/production environment selection and production approval gate.
6. When Azure infrastructure is provisioned, configure OIDC, registry/repository settings, App Service targets, managed PostgreSQL connectivity, and staging smoke tests before enabling production deployments.

## Validation and acceptance criteria

- A clean checkout can follow the README setup, create `.env` from `.env.example`, and start all services with Docker Compose.
- Compose reports PostgreSQL and backend healthy before dependent services are considered ready; data remains after a normal `docker compose down` and is removed only when the volume is explicitly deleted.
- Frontend access works at the documented local URL, and a transaction submitted through the frontend reaches the API and is persisted in PostgreSQL.
- CI runs on pull requests and relevant branch pushes, fails on backend/frontend check failures, and builds both Docker images.
- The integration job validates transaction persistence against the Compose PostgreSQL service.
- Deployment is manual until Azure resources and GitHub environment configuration exist; production requires an approval gate and uses production-specific settings.
- Staging and production images are traceable to the source commit and are pushed to ACR before App Service rollout.
- Secrets are not printed in logs, committed to the repository, or embedded in container image layers.
