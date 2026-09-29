# Frontend Plan, Requirements, and Validation

## Goal and scope

Build a single-page Angular personal-finance dashboard. The initial dashboard presents illustrative mock finance data and includes a small form to create a transaction through the FastAPI endpoint. It is a single-user demo and does not include login or registration.

## Requirements

### Technology and structure

- Use Angular with strict TypeScript settings and the Angular CLI tooling appropriate to the implementation-time supported release.
- Keep the first release to one dashboard page, with reusable components/services where that improves clarity rather than introducing unnecessary page infrastructure.
- Include an Angular production build in the frontend Docker image using a multi-stage Dockerfile.
- Serve the built static application from a lightweight web server. Configure the frontend container to proxy `/api` requests to the backend service so browser requests use a same-origin path.

### Dashboard experience

- Show mock summary data for a current balance, income, and expenses, plus a small recent-activity/transaction view.
- Clearly treat this as demo data; do not imply that mock summary values are calculated from stored transactions.
- Provide an entry form with transaction type, amount, category, optional description, date, and currency.
- Validate required fields and positive monetary amounts before submitting. Keep amount handling decimal-safe in API payloads.
- Submit the form to `POST /api/v1/transactions` using the `/api` proxy path. Show a clear pending state, success confirmation, and actionable validation/API error state.
- Keep the dashboard usable at common desktop and mobile viewport sizes, and provide accessible labels and keyboard-operable controls.

## Implementation plan

1. Generate the Angular application and establish its strict build, formatting, lint, and test commands.
2. Implement the dashboard layout, mock summary widgets, and mock recent-activity data.
3. Add a typed transaction model and API service using Angular's HTTP client.
4. Implement the transaction form, client-side validation, request state, and success/error feedback.
5. Add production server configuration so `/api` is forwarded to the FastAPI container while the Angular app supports browser refresh/deep-link fallback.
6. Add the multi-stage frontend Dockerfile and include frontend checks and image build in CI.

## Validation and acceptance criteria

- Dependency installation is reproducible through the committed frontend lockfile.
- Angular lint/static checks, unit tests, and production build pass in CI.
- Component/form tests cover required fields, invalid amounts, submitting state, API success, and API error behavior.
- The dashboard renders all mock summary values and recent-activity entries without requiring an API read endpoint.
- A successful API response gives visible feedback; the UI does not present a failed write as saved.
- The production container serves the dashboard and correctly proxies `/api/v1/transactions` to the backend.
- Manual responsive/accessibility review confirms readable layout, labeled inputs, keyboard access, and visible form errors.
