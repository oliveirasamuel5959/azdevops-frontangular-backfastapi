# Frontend Plan, Requirements, and Validation

## Goal and scope

Build a single-page Angular personal-finance dashboard backed by saved transactions from the FastAPI API. It is a single-user demo and does not include login or registration.

## Requirements

### Technology and structure

- Use Angular with strict TypeScript settings and the Angular CLI tooling appropriate to the implementation-time supported release.
- Keep the first release to one dashboard page, with reusable components/services where that improves clarity rather than introducing unnecessary page infrastructure.
- Include an Angular production build in the frontend Docker image using a multi-stage Dockerfile.
- Serve the built static application from a lightweight web server. Configure the frontend container to proxy `/api` requests to the backend service so browser requests use a same-origin path.

### Dashboard experience

- Load the transaction list from `GET /api/v1/transactions` when the dashboard opens and show loading, empty, and retryable error states.
- Show summary totals derived only from saved transactions. Keep currency totals separate; the initial summary cards can focus on USD transactions while the list displays each record's currency.
- Show the user's saved transactions with category, description, transaction date, type, and amount.
- Provide an entry form with transaction type, amount, category, optional description, date, and currency.
- Validate required fields and positive monetary amounts before submitting. Keep amount handling decimal-safe in API payloads.
- Submit new records to `POST /api/v1/transactions` and edits to `PUT /api/v1/transactions/{id}` using the `/api` proxy path. Provide a delete action using `DELETE /api/v1/transactions/{id}`.
- Reflect successful create, update, and delete operations in the list and derived summaries; show pending states and actionable validation/API errors.
- Keep the dashboard usable at common desktop and mobile viewport sizes, and provide accessible labels and keyboard-operable controls.

## Implementation plan

1. Generate the Angular application and establish its strict build, formatting, lint, and test commands.
2. Implement the dashboard layout and live summaries/list backed by the API.
3. Add a typed transaction model and API service using Angular's HTTP client.
4. Implement the transaction form, client-side validation, create/edit/delete actions, request state, and success/error feedback.
5. Add production server configuration so `/api` is forwarded to the FastAPI container while the Angular app supports browser refresh/deep-link fallback.
6. Add the multi-stage frontend Dockerfile and include frontend checks and image build in CI.

## Validation and acceptance criteria

- Dependency installation is reproducible through the committed frontend lockfile.
- Angular lint/static checks, unit tests, and production build pass in CI.
- Component/form tests cover initial GET loading, empty and error states, required fields, invalid amounts, create/update/delete success, and API errors.
- The dashboard displays transactions and derived summary values from the API; it has no hard-coded transaction or finance-summary data.
- Successful API responses update the UI; failed writes are not presented as saved.
- The production container serves the dashboard and correctly proxies `/api/v1/transactions` CRUD requests to the backend.
- Manual responsive/accessibility review confirms readable layout, labeled inputs, keyboard access, and visible form errors.
