# FinTrack Web Product Specification

Repo: `../fintrack-web`

Backend API: `http://localhost:5001`

Last reviewed: 2026-06-05

## Current Frontend State

The web app already exists and builds successfully with Next.js.

Implemented routes:

- `/login`
- `/register`
- `/forgot-password`
- `/verify-otp`
- `/reset-password`
- `/dashboard`
- `/transactions`
- `/budget-goals`
- `/reports`
- `/savings`
- `/recurring`
- `/settings`

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

## Verification Results

From `../fintrack-web`:

- `npm run build` passes.
- `npm run lint` fails with 11 errors and 26 warnings.

Lint issues to fix:

- Replace `any` icon lookup patterns with typed `Record<string, LucideIcon>` helpers.
- Fix `ThemeToggle` state initialization and function declaration order.
- Remove unused imports and unused variables.
- Review React Hook Form `watch` warning in `TransactionModal`.

## Auth Reality Check

The old spec said:

- Access token in memory.
- Refresh token in httpOnly cookie.

Current implementation:

- Access token, refresh token, and user are persisted in Zustand localStorage under `fintrack-auth`.
- Axios reads the refresh token from the client store.
- Route protection is client-side in dashboard layout.
- There is no Next.js middleware and no API refresh proxy route.

Production target:

- Store refresh token in a secure, httpOnly, same-site cookie or use a backend-for-frontend session.
- Keep access token in memory where possible.
- Add refresh token rotation.
- Add logout-all-sessions support.
- Add CSRF protection if cookie auth is used.
- Add route protection that does not flash private UI before auth state resolves.

## Core Web Experience

The first production-grade web version should be a working financial workspace, not a marketing page.

Primary navigation:

- Dashboard
- Transactions
- Accounts
- Budgets
- Savings
- Recurring
- Reports
- Settings

## Required Screens

### Auth

- Login
- Register
- Forgot password
- OTP verification
- Reset password

Required improvements:

- Password strength guidance.
- Form-level and field-level API errors.
- Resend OTP with cooldown.
- Expired token recovery.
- Accessible input labels and focus states.

### Onboarding

Add this before broad release:

1. Confirm name and currency.
2. Create first account.
3. Choose starter budget categories.
4. Add first monthly budget.
5. Add optional savings goal.
6. Land on dashboard with useful empty states.

### Dashboard

Should show:

- Total account balance.
- Monthly income.
- Monthly expenses.
- Net savings and savings rate.
- Spending by category.
- Recent transactions.
- Budget progress.
- Upcoming recurring bills.
- Quick add transaction action.

Current gaps:

- Some comparison values and upcoming bills are hardcoded.
- Dashboard balance currently comes from income minus expenses, not account balances.
- No account list summary yet.

### Transactions

Should support:

- List, filter, search, pagination.
- Create, edit, delete.
- Category, account, date, tags, notes.
- Income/expense toggle.
- CSV import later.
- Export filtered transactions.

Current gaps:

- Frontend types do not include account and tag fields on transaction requests.
- Search is not wired to the backend.
- Bulk actions are missing.

### Accounts

This screen should be added.

Features:

- List accounts by type.
- Create/edit/delete account.
- Account balances.
- Account detail with transactions.
- Transfer between accounts.
- Balance correction flow.

Backend support exists for basic account CRUD and transfer create/list.

### Budgets

Should support:

- Month selector.
- Category budgets.
- Spent, remaining, percent used.
- Over-budget state.
- Duplicate prevention.
- Budget rollover visibility.

Current gaps:

- Needs clearer rollover history from backend.
- Needs database unique constraint on category/month/year.

### Savings

Should support:

- Savings bucket balance.
- Savings goals.
- Allocate bucket funds to goals.
- Return funds to bucket when a goal is deleted.
- Add money to bucket manually or through budget rollover.

Current gap:

- Backend has allocation from bucket to goal, but no explicit user-facing flow for funding the bucket outside rollover.

### Recurring

Should support:

- Create recurring transaction.
- Edit/pause/delete recurring transaction.
- Frequency: daily, weekly, monthly, yearly.
- Next run date.
- Upcoming bill calendar.

Current gap:

- Backend has the Prisma model and cron processor but no CRUD API routes.

### Reports

Should support:

- Monthly summary.
- Category breakdown.
- Six-month trend.
- Budget variance.
- Account balance trend.
- Cashflow forecast using recurring transactions.
- PDF and CSV exports.

Current gaps:

- PDF summary period filtering bug in backend.
- No advanced reports yet.

### Settings

Should support:

- Profile update.
- Currency preference.
- Password reset/change.
- Notification preferences.
- Export all data.
- Delete account.
- Session management.

Current gaps:

- Notification preferences are not backed by API.
- Session management does not exist yet.

## Frontend Production Checklist

- Fix lint errors.
- Add unit tests for hooks and utilities.
- Add component tests for forms and modals.
- Add Playwright smoke tests for auth, dashboard, transaction CRUD, budget CRUD, and settings.
- Add typed API client generated from OpenAPI or shared schemas.
- Remove hardcoded finance data.
- Add robust loading, empty, error, and retry states.
- Add accessibility checks: keyboard nav, focus traps, color contrast, aria labels.
- Add responsive screenshot checks for mobile, tablet, and desktop.
- Add analytics events only after privacy policy is defined.
- Add error tracking and user-safe error messages.

## Recommended Design Direction

Use a dense, work-focused finance dashboard style:

- Clear tables and filters.
- Compact summary cards.
- Strong number hierarchy.
- Calm neutral background.
- Category color accents only where they carry meaning.
- Avoid decorative hero sections.
- Avoid marketing-page layout inside the app.

The `web-designs-to-inspire` and `stitch_financial_dashboard_overview` folders provide useful visual direction, but the production UI should be implemented as typed reusable React components rather than copied HTML.

## Next Build Order

1. Fix frontend lint errors.
2. Add Accounts page.
3. Add recurring transaction backend CRUD, then wire `/recurring`.
4. Fix auth token storage.
5. Add onboarding.
6. Replace hardcoded dashboard data.
7. Add tests and Playwright smoke coverage.
