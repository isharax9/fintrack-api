# FinTrack Future Tasks

Last updated: 2026-06-18

This file is the forward-looking task list for the full FinTrack project. It is aligned with the current backend API, generated OpenAPI contract, and frontend documentation as of the date above.

## Current Baseline

- Backend: Fastify, TypeScript, Prisma, PostgreSQL, Redis, JWT access tokens, httpOnly refresh cookie rotation, audit logs, notifications, imports, exports, cron jobs, OpenAPI/Swagger, and Vitest coverage.
- Frontend: Next.js App Router, React 19, Tailwind CSS 4, TanStack Query, Zustand, Axios, generated OpenAPI types, landing page, onboarding flow, auth/dashboard/product routes, notification inbox, CSV import UI, tag management, unit tests, and Playwright smoke tests.
- Main product areas already exist: auth, dashboard, transactions, accounts, transfers, categories, tags, budgets, savings, recurring transactions, reports, settings, imports, exports, audit, and notifications.

## Missing Tasks

### Backend

1. ✅ Refreshed API documentation, generated OpenAPI, frontend API types, backend docs, and frontend docs to match the current cookie-backed auth flow, notification endpoints, preferences endpoints, tags, onboarding, and implemented frontend coverage.
2. Add frontend-facing audit log hooks and UI. The backend exposes `/api/audit`, but the web app does not yet present audit history as a first-class settings/security view.
3. ✅ Expanded transfer APIs beyond create/list with get-one detail, filtered/paginated history, and an explicit reversal workflow. Update/delete remains intentionally unsupported; reversals preserve audit history.
4. Add recurring execution history, skip-next-run, run-now, retry/failure visibility, and user-facing next-run audit details.
5. ✅ Added explicit savings bucket funding and withdrawal workflows, not only rollover credits and allocation from bucket to goals.
6. Add data export for the full account, including transactions, accounts, budgets, tags, savings, audit logs, and notifications.
7. Add a complete account deletion/export privacy flow with confirmation, export-before-delete option, and retention notes.
8. Add onboarding APIs for first account, first categories/budgets, first savings goal, and empty-state setup progress.
9. Add notification delivery channels beyond in-app history: email alerts first, then optional push/web notifications.
10. Add admin/maintenance scripts for expired refresh-session cleanup, old audit log retention, and notification retention.

### Frontend

1. Build an audit/security history screen from `/api/audit`.
2. ✅ Added onboarding screens for currency, first account, starter budgets, savings goal, and first transaction.
3. ✅ Added transfer history filters, transfer detail, and reversal UI after adding the backend reversal policy.
4. ✅ Added richer recurring controls: skip, run now, execution history, failure states, and calendar view.
5. ✅ Added manual savings bucket funding and withdrawal UI.
6. Migrate more hooks from hand-maintained domain types to generated OpenAPI operation types.
7. Add cross-browser and mobile Playwright coverage beyond the current Chromium smoke suite.
8. Add accessibility checks for dialogs, tables, filters, keyboard navigation, focus order, color contrast, and screen-reader names.
9. Add responsive visual verification for dashboard, transactions, accounts, budgets, savings, recurring, reports, settings, and the new landing page.
10. Add app-wide command/search behavior. Current topbar search focuses transaction search, and transaction tag badges can filter the ledger by tag.

## Improvements Needed

### Security

1. Add CSRF protection or an equivalent same-site cookie threat model for cookie-backed refresh and authenticated state-changing requests.
2. Verify production CORS, cookie `secure`, same-site behavior, proxy settings, and refresh/logout behavior behind the intended deployment host.
3. Re-check route-level rate limits against Redis in production-like conditions, especially auth, OTP, imports, exports, and notification endpoints.
4. Add secret scanning and dependency update automation in repository hosting.
5. Add session anomaly signals for refresh-token reuse, suspicious IP/user-agent changes, and repeated auth failures.

### Data Integrity

1. Replace remaining money calculations that convert Prisma `Decimal` values to JavaScript `number` where precision matters.
2. Make report and budget date windows timezone-aware per user or per request.
3. Add stronger concurrency tests for account balance changes across transactions, transfers, imports, and recurring jobs.
4. Ensure cron jobs are single-runner safe across multi-instance deployments, not just `node-cron` no-overlap inside one process.
5. Add idempotency or duplicate guards for recurring execution and CSV import commit retries.
6. Review cascade behavior for accounts, transfers, transactions, savings, notifications, and audit logs so deletion outcomes match product expectations.

### Reliability And Operations

1. Add structured metrics, traces, and dashboards for request latency, error rates, auth failures, cron runs, import results, and notification generation.
2. Add production error tracking with request IDs and user-safe error messages.
3. Document backup, restore, migration rollback, and incident response drills.
4. Add staging deployment documentation and environment parity checks.
5. Add load and soak tests for transaction-heavy flows and PDF/CSV export endpoints.
6. Add queue-backed background work for long-running imports, exports, emails, and scheduled processing.

### Frontend Quality

1. Continue replacing one-off page styling with shared primitives where useful.
2. Add component tests for transaction, recurring, budget, savings, and confirmation modals.
3. Add hook tests for accounts, budget goals, savings, recurring, reports, imports, notifications, and user preferences.
4. Add better API error presentation for field-level validation errors.
5. Add optimistic or progress feedback where actions can take longer, especially imports, exports, and recurring schedule updates.
6. Add robust empty states for brand-new users after onboarding.

## New Features To Add

### Product Features

1. ✅ Guided onboarding with setup progress and starter templates.
2. Merchant/title rules for auto-categorization and tag assignment.
3. Budget variance reports and month-over-month comparisons.
4. Cashflow forecast using recurring income, recurring bills, savings goals, and account balances.
5. Net worth tracking across accounts and manual assets/liabilities.
6. Account reconciliation and balance correction ledger entries.
7. CSV export plus richer PDF export for transactions, monthly reports, budgets, and account statements.
8. Advanced recurring calendar with due-soon reminders and projected balance impact.
9. Savings goal funding plans and milestone timelines.
10. Multi-currency support with exchange-rate snapshots per transaction.
11. Household/shared workspace support with roles and permissions.
12. Receipt attachment support for transactions.
13. Category and budget templates by lifestyle or region.
14. App-wide command palette for quick add, search, navigation, and common actions.
15. In-app financial insights: overspending patterns, subscription drift, savings opportunities, and unusual transaction alerts.

### Integrations

1. Email notifications for budget pressure, recurring bills, import completion, and monthly summaries.
2. Bank connection integration through a provider such as Plaid or a region-appropriate alternative.
3. Calendar export for recurring bills.
4. Webhook/event system for integrations and future mobile clients.
5. Mobile app or PWA install experience with push notifications.

## Suggested Execution Order

1. ✅ Refresh stale documentation and make `future-task.md`, OpenAPI, backend docs, and frontend docs agree.
2. Add audit log UI and generated-type migration for the highest-use hooks.
3. Add CSRF/session hardening and production cookie verification.
4. ✅ Add onboarding plus first-run empty states.
5. ✅ Expand transfers with filtered history, detail, and reversal operations; recurring operations already include skip, run now, history, failure states, and calendar view.
6. ✅ Add manual savings bucket funding and richer savings history.
7. Add accessibility, responsive, and cross-browser verification.
8. Add observability, backup/restore docs, staging deployment, and production monitoring.
9. Add advanced reporting, forecasts, and auto-categorization.
10. Add notification delivery channels and bank/integration work.
