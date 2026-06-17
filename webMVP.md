# FinTrack Web Product Specification

Repo: `../fintrack-web`

Backend API: `http://localhost:5001`

Last reviewed: 2026-06-17

## Current Frontend State

The web app is implemented as a Next.js 16 App Router application. It is no longer only an MVP design note.

Implemented routes:

- Public/setup: `/`, `/onboarding`
- Auth: `/login`, `/register`, `/forgot-password`, `/verify-otp`, `/reset-password`
- App: `/dashboard`, `/transactions`, `/accounts`, `/budget-goals`, `/reports`, `/savings`, `/recurring`, `/settings`

Current stack:

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- TanStack Query
- Zustand
- Axios
- React Hook Form
- Zod
- Recharts
- Sonner
- Lucide React

## Current Product Coverage

- Auth uses short-lived bearer access tokens and a backend-set httpOnly `fintrack_refresh` cookie for refresh rotation.
- New users are routed through onboarding for currency, first account, starter budgets, savings goal, and first transaction.
- Dashboard, transactions, accounts, budgets, savings, recurring, reports, and settings are API-backed.
- Transactions support reusable tags, tag assignment per transaction, search by tag name, and tag filtering.
- Settings includes profile, password, notification preferences, active sessions, CSV imports, onboarding rerun, and tag management.
- Navbar notification inbox/history is implemented for in-app notifications.
- OpenAPI is available at `/openapi.json`, and frontend generated types live at `../fintrack-web/src/types/api.generated.ts`.

## Known Gaps

- Audit log UI is not implemented yet, although `/api/audit` exists.
- App-wide command/search palette is not implemented; topbar search targets transaction search.
- Transfer detail/filter/reversal workflows are still limited.
- Recurring needs skip, run-now, execution history, failure states, and calendar view.
- Manual savings bucket funding/withdrawal is not implemented.
- Cross-browser/mobile Playwright coverage, broader component tests, and deeper accessibility checks are still needed.
- Production CSRF/session hardening and cookie verification still need a dedicated pass.

## Maintained Planning Sources

- Backend roadmap: `future-task.md`
- Backend API summary: `API_DOCS.md`
- Canonical API contract: `openapi.json`
- Frontend status: `../fintrack-web/FRONTEND_TASKS.md`
- Frontend product spec: `../fintrack-web/webMVP.md`

Use `future-task.md` as the current cross-repo planning baseline.
