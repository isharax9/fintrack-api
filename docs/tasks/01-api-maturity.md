# Task 01: API Maturity

Goal: raise the API from MVP-grade to production-ready foundation.

Target maturity: 8/10

## Scope

This task focuses on backend correctness, security, reliability, and contract stability. It prepares the API for a complete frontend rebuild and for real financial workflows.

## Workstreams

### 1. Auth Hardening

Current state:

- Access and refresh JWTs exist.
- Refresh sessions now use a `RefreshSession` database table.
- Refresh tokens are hashed server-side.
- Access and refresh tokens include `sessionId`.
- Refresh tokens rotate on refresh.
- Frontend currently persists refresh tokens client-side.
- Password reset OTP flow exists.

Done in current pass:

- Add refresh token rotation.
- Add server-side session records.
- Support multiple devices/sessions.
- Support logout current session and logout all sessions.
- Store only hashed refresh tokens server-side.
- Revoke active sessions on password reset.

Still needed:

- Add deeper session tests for refresh token reuse, logout, logout-all, and password reset revocation.
- Add session listing endpoint for the future settings UI.
- Add httpOnly-cookie refresh delivery when the frontend auth layer is rebuilt.
- Keep forgot-password responses enumeration-safe.
- Keep monitoring OTP and auth rate limits.

Acceptance criteria:

- Login creates a session.
- Refresh rotates refresh token and invalidates old token.
- Reusing an old refresh token revokes the session.
- Logout revokes the active session.
- Logout-all revokes every user session.
- Password reset revokes all active sessions.
- Tests cover login, refresh rotation, token reuse, logout, password reset revocation.

## 2. Database Migrations

Current state:

- Prisma schema exists.
- A first migration was added for recurring `isActive` and `BIWEEKLY`.
- Baseline migration exists.
- Docker uses `prisma migrate deploy`.

Still needed:

- Validate fresh database startup from migrations.
- Add migration documentation.
- Validate migrations in CI.

Schema constraints to add:

- `BudgetGoal`: unique `(userId, categoryId, month, year)`.
- `Category`: unique `(userId, name)`.
- `Account`: consider unique `(userId, name)` or permit duplicates explicitly.
- Add indexes for list/report queries:
  - `Transaction(userId, date)`
  - `Transaction(userId, type, date)`
  - `Transaction(userId, categoryId, date)`
  - `Transaction(userId, accountId, date)`
  - `Transfer(userId, date)`
  - `RecurringTransaction(userId, isActive, nextDate)`

Acceptance criteria:

- Docker startup uses `npx prisma migrate deploy`.
- No production path uses `prisma db push`.
- `npx prisma validate` passes.
- A fresh database can be created using migrations only.

## 3. Test Coverage

Current state:

- Vitest is installed.
- Basic schema tests exist for recurring, transfers, and transactions.

Needed test layers:

- Unit tests for schemas and pure utilities.
- Service tests for money-changing workflows.
- Route tests with Fastify `inject`.
- Database integration tests against isolated test database.

Critical test cases:

- Register seeds default categories.
- Login and refresh session behavior.
- Transaction create/update/delete updates account balances correctly.
- Transfer updates both account balances atomically.
- Transfer to same account is rejected.
- Cross-user access is rejected.
- Budget duplicate is rejected by DB and service.
- Savings allocation decrements bucket and increments goal atomically.
- Recurring execution creates transaction, updates account, advances nextDate.
- PDF summary respects month/year.

Acceptance criteria:

- `npm test` covers critical business rules.
- `npm run build` and `npm test` are required checks.
- Tests do not depend on developer-local data.

## 4. OpenAPI And Contracts

Current state:

- Manual API docs exist in `API_DOCS.md`.
- Swagger/OpenAPI is registered.
- Swagger UI is available at `/docs`.
- OpenAPI JSON is available at `/openapi.json`.
- Bearer auth security scheme is defined.
- Auth routes have request/response schemas.
- Every route group has OpenAPI request/response schemas, including params and querystring contracts.
- Protected route groups are tagged and marked with bearer auth.
- Contract tests assert every public route appears in `/openapi.json`.

Still needed:

- Generate frontend API types from `/openapi.json`.
- Keep `API_DOCS.md` as human summary, not the only source of truth.

Acceptance criteria:

- `/docs` works locally.
- OpenAPI JSON includes route groups for auth, users, accounts, transactions, transfers, categories, tags, budgets, savings, recurring, reports, exports, and audit logs.
- OpenAPI JSON documents `/health` and `/ready`.
- Frontend can generate API types from the spec after route schemas are expanded.

## 5. Audit Logs

Current state:

- AuditLog model, migration, service, and `/api/audit` route exist.
- Auth, accounts, transactions, transfers, budget goals, and savings allocation write audit logs.
- Request ID, IP, and user-agent metadata are propagated into audited service calls for key money/security actions.

Still needed:

- Expand audit coverage to categories, tags, recurring transactions, exports, and cron execution.
- Add audit tests around money-changing service transactions.
- Add admin/internal retention policy.

Actions to audit:

- User login success/failure metadata.
- Password reset requested/completed.
- Session revoked.
- Account create/update/delete.
- Transaction create/update/delete.
- Transfer create/reversal.
- Budget create/update/delete.
- Savings allocation.
- Recurring create/update/delete/executed.
- Export generated.

Acceptance criteria:

- Audit records are created inside the same transaction for money-changing operations where possible.
- Audit records can be listed for the authenticated user.
- Sensitive values are redacted.

## 6. Error Handling And Observability

Current state:

- Central `AppError` and error formatter exist.
- Fastify error handler and not-found handler are registered.
- Zod errors and Prisma unique constraint errors have consistent response shapes.
- Legacy controller catch blocks have been removed, so controllers now flow through the central error handler.
- Common business/service errors now use typed `AppError` helpers.
- Fastify logging uses request IDs, configurable `LOG_LEVEL`, and redacts authorization/cookie/token/password fields.
- `/health` is a dependency-free liveness endpoint.
- `/ready` checks PostgreSQL and Redis readiness and returns dependency status, latency, request ID, and `503` when required dependencies are unavailable.

Still needed:

- Route-level tests for representative centralized error responses.

Target error shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": []
  },
  "requestId": "req_..."
}
```

Acceptance criteria:

- Controllers stop hand-rolling inconsistent error responses.
- Validation errors return predictable shape.
- Unexpected errors are logged with request ID and return safe message.

## 7. Security And Dependency Hygiene

Needed:

- Run `npm audit` and decide fix strategy.
- Remove hardcoded secrets from Docker compose examples.
- Add stricter CORS config by environment.
- Review rate limiting with Redis.
- Add security headers verification.
- Add secret scanning to CI later.

Acceptance criteria:

- No production secrets in source.
- Known dependency vulnerabilities have documented decisions or fixes.
- Auth and password reset routes have specific rate limits.

## Deliverables

- Updated Prisma migrations.
- Hardened auth/session implementation.
- Test suite for critical workflows.
- OpenAPI documentation.
- Audit log model and service.
- Centralized error handling.
- Updated Docker startup.
- Updated `API_DOCS.md`.

## Verification

Run:

```bash
npx prisma validate
npm run build
npm test
```

After migration changes:

```bash
docker compose down -v
docker compose up --build
curl http://localhost:5001/health
```

## Out Of Scope

- Frontend rebuild.
- Bank integrations.
- Payment processing.
- Multi-tenant/household sharing.
