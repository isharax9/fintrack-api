# FinTrack Product Plan

Last reviewed: 2026-06-17

FinTrack is a personal finance product with two repositories:

- `fintrack-api`: Fastify, TypeScript, Prisma, PostgreSQL, Redis, OpenAPI, cron jobs, audit logs, notifications, imports, and PDF exports.
- `fintrack-web`: Next.js, TypeScript, Tailwind CSS, TanStack Query, Zustand, generated OpenAPI types, onboarding, dashboards, and product workflows.

This file is a compact product baseline. Use `future-task.md` for the maintained cross-repo task list.

## Implemented Backend Features

- Auth: register, login, refresh, logout, logout all, logout other sessions, active sessions, forgot password, OTP verification, reset password, bcrypt password hashing, rotating refresh sessions, and httpOnly refresh cookie delivery.
- User: profile, currency, notification preferences, password change, and account deletion.
- Finance core: accounts, transfers, transactions, categories, reusable tags, budget goals, reports, savings bucket/goals, recurring transactions, imports, exports, audit logs, and in-app notifications.
- Operational surface: `/health`, `/ready`, Swagger UI at `/docs`, static OpenAPI at `openapi.json`, structured errors, request IDs, CORS/Helmet/rate-limit plugins, and Vitest coverage.

## Implemented Frontend Features

- Public landing page.
- Auth and password recovery routes.
- First-run onboarding for currency, first account, starter budgets, savings goal, and first transaction.
- App shell with dashboard, transactions, accounts, budgets, savings, recurring, reports, and settings.
- Transaction search, filters, pagination, create/edit/delete, PDF export, reusable tag assignment, and tag filtering.
- Settings flows for profile, password, sessions, notification preferences, CSV imports, tag management, onboarding rerun, and account deletion.
- Notification inbox/history in the navbar.
- Generated OpenAPI types in `fintrack-web/src/types/api.generated.ts`.

## Current Production Gaps

- Audit/security history UI for `/api/audit`.
- CSRF/session hardening and production cookie/CORS/proxy verification.
- Transfer detail, filters, and reversal/delete policy.
- Recurring skip/run-now/execution history/failure visibility/calendar view.
- Manual savings bucket funding and withdrawal workflows.
- Full account export and privacy-oriented export-before-delete flow.
- Cross-browser/mobile smoke tests, broader component coverage, accessibility automation, and responsive visual checks.
- Observability, backup/restore drills, staging parity, incident response, and queue-backed long-running jobs.

## Roadmap Source

Use `future-task.md` for detailed missing tasks, improvements, new features, and suggested execution order.
