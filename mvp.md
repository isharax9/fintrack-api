# FinTrack Product Plan

Last reviewed: 2026-06-05

FinTrack is a personal finance product with two repositories:

- `fintrack-api`: Fastify, TypeScript, Prisma, PostgreSQL, Redis.
- `fintrack-web`: Next.js, TypeScript, Tailwind CSS, TanStack Query, Zustand.

This document replaces the old MVP-only notes. It records what currently exists, what is incomplete, and what should be added before calling the product production grade.

## Current State

The backend is more than the original MVP. It already has modules for authentication, users, categories, transactions, budget goals, reports, accounts, transfers, tags, savings, PDF exports, and background jobs.

The frontend also exists in the sibling `fintrack-web` repository. It has auth pages, dashboard pages, transaction and budget screens, reports, savings, recurring, settings, shared layout, and API hooks.

Verification performed:

- `fintrack-api`: `npm run build` passes.
- `fintrack-web`: `npm run build` passes.
- `fintrack-web`: `npm run lint` fails with 11 errors and 26 warnings, mainly `any` icon lookups, unused imports, and the theme toggle effect.

## Implemented Backend Features

### Authentication

- Register, login, refresh, logout.
- Forgot password, verify OTP, reset password.
- Password hashing with bcrypt.
- Access and refresh JWTs.
- Redis-backed refresh token lookup when Redis is available.
- OTP storage in Redis.
- Default categories seeded per user at registration.

### Finance Core

- Transactions with category, optional account, optional tags.
- Category CRUD with default-category deletion protection.
- Budget goals by month and year.
- Monthly summary, category spending, and six-month trend reports.
- User profile read, update, and account deletion.

### Money Movement

- Accounts with type and balance.
- Transfers between accounts with balance updates.
- Transaction create, update, and delete adjust linked account balances.

### Planning

- Savings bucket.
- Savings goals.
- Allocate bucket funds to savings goals.
- End-of-month rollover of unused budget money into the savings bucket.

### Outputs

- Transactions PDF export.
- Summary PDF export.

## Partially Implemented Or Risky Areas

These are not blockers for a demo, but they are blockers for a serious production release.

### Backend Gaps

- No automated tests.
- No Prisma migration history; Docker currently uses `prisma db push`.
- No generated OpenAPI spec or schema-driven API documentation.
- No request/response schemas registered with Fastify for runtime documentation.
- No centralized error model; controllers return mixed `400`, `401`, `404`, and `500` behavior.
- Refresh token design allows only one active refresh token per user and does not rotate tokens.
- Refresh tokens are returned to the client body, so the frontend stores them in `localStorage`.
- OTP generation uses `Math.random`; use cryptographic randomness.
- Rate limiting depends on plugin config but needs verification against Redis and route-specific policies.
- Background jobs run inside every API process, which can duplicate work in multi-instance deployments.
- Recurring transactions have CRUD API routes and cron processing. Missing advanced operations: skip next run, run now, execution history, and failure retry visibility.
- Transfers have create/list only; no get, update, delete, filters, or reversal workflow.
- Accounts do not prevent deletion when linked data exists; current deletion can leave transactions with null accounts and transfers affected by cascade.
- Transaction tag ownership is not validated when connecting tag IDs.
- Reports use server local date boundaries and should be made timezone-aware.
- PDF summary ignores the requested month/year for income and expense totals.
- Category names are not unique per user.
- Budget goals have duplicate prevention in service code but no database unique constraint.
- Monetary calculations convert Prisma Decimal values to JavaScript numbers in several places.

### Frontend Gaps

- Auth tokens are persisted in `localStorage`; the docs previously claimed memory plus httpOnly cookie.
- No Next.js middleware exists for route protection; route protection is client-side.
- No API proxy route exists for cookie-based refresh.
- Types do not cover accounts, transfers, tags, savings, recurring transactions, and exports fully.
- Dashboard contains hardcoded upcoming bills and comparison values.
- Search UI in the navbar is visual only.
- Notifications/messages are visual only.
- Recurring transactions page still needs to be wired to the backend CRUD API.
- No test setup for components, hooks, or end-to-end flows.
- No accessibility audit, keyboard test pass, or responsive screenshot verification.

## Production Grade Definition

FinTrack should not be called production grade until these are true:

- All critical money-changing workflows are tested: transactions, transfers, budgets, account balances, savings allocations, auth, and password reset.
- Database changes use migrations, not `db push`.
- API contract is documented and versioned.
- Auth uses secure refresh-token storage, token rotation, session revocation, and CSRF protection where cookies are used.
- All user-owned objects enforce ownership checks at the database/service boundary.
- Background jobs are single-runner safe.
- Logs, metrics, request IDs, and error tracking exist.
- Secrets are not present in compose files except local examples.
- CI runs lint, typecheck, tests, Prisma validation, and build.
- Frontend has authenticated route handling, typed API clients, empty/loading/error states, and no hardcoded finance data.
- Deployment, backup, restore, and incident procedures are documented.

## Recommended Feature Roadmap

### Phase 1: Stabilize The Existing MVP

1. Add backend tests with Vitest or Node test runner plus Fastify `inject`.
2. Add Prisma migrations and replace `prisma db push` in Docker startup.
3. Add a central error helper and consistent error response format.
4. Fix frontend lint errors and warnings.
5. Replace frontend `localStorage` refresh token storage with secure cookie/session design.
6. Add missing TypeScript types for the current backend models.
7. Remove hardcoded dashboard data or mark it as mock-only.

### Phase 2: Complete Current Feature Set

1. Wire the recurring transaction frontend page to the new backend CRUD APIs.
2. Add accounts detail page and account transaction filtering.
3. Add transfer detail, filters, and delete/reversal behavior.
4. Add tag ownership validation and tag management UI.
5. Add savings bucket funding workflow, not only allocation to goals.
6. Add CSV export and filtered PDF export.
7. Add budget rollover audit records so users can see why money entered the savings bucket.

### Phase 3: Product Features To Add

1. Onboarding flow: create accounts, choose currency, set first budgets, create first savings goal.
2. Import transactions from CSV with duplicate detection.
3. Rules for auto-categorization by merchant/title.
4. Recurring bills calendar with due dates and expected cashflow.
5. Budget alerts by email and in-app notifications.
6. Multi-currency display with exchange-rate snapshot per transaction.
7. Account reconciliation and balance correction entries.
8. Advanced reports: cashflow, net worth, month-over-month comparisons, budget variance, top merchants.
9. Shared household/workspace support with roles.
10. Data export and account deletion workflow that meets privacy expectations.

### Phase 4: Production Operations

1. CI/CD for both repositories.
2. Staging and production environments.
3. Database backups and restore drills.
4. Observability: structured logs, metrics, tracing, error alerts.
5. Security headers, CORS, rate limiting, dependency scanning, and secret scanning.
6. Load and concurrency tests for account balance updates and cron jobs.

## Next Best Engineering Tasks

Start here:

1. Fix `fintrack-web` lint failures.
2. Add backend tests for auth and transaction balance updates.
3. Add Prisma migration workflow.
4. Update auth storage to production-safe cookies or a backend-for-frontend session route.
5. Wire the frontend recurring page to `/api/recurring`.
