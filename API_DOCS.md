# FinTrack API Reference

Base URL: `http://localhost:5001`

All protected endpoints require:

```http
Authorization: Bearer <accessToken>
```

The API currently returns JSON except PDF export endpoints.

## Quick Start

```bash
npm install
npm run prisma:generate
npm run build
npm run dev
```

With Docker:

```bash
docker compose up --build
curl http://localhost:5001/health
```

OpenAPI:

- Swagger UI: `http://localhost:5001/docs`
- OpenAPI JSON: `http://localhost:5001/openapi.json`
- `/openapi.json` is the source of truth for request bodies, params, querystrings, responses, auth requirements, and PDF export media types.

## Environment

See `.env.example`.

Required services:

- PostgreSQL via `DATABASE_URL`.
- Redis via `REDIS_URL` for OTPs and rate limiting.
- Resend API credentials for password reset OTP emails.

Deployment/runtime notes:

- See `DEPLOYMENT.md` for production startup and rollback guidance.
- `NODE_ENV=production` enables fail-fast environment validation.
- `ENABLE_CRON=true` should be enabled for exactly one running API worker.
- `TRUST_PROXY=true` should only be used behind a trusted proxy/load balancer.

## Auth Model

Current implementation:

- Access token: JWT, default `15m`.
- Refresh token: JWT, default `7d`, bound to a `RefreshSession`.
- Refresh sessions are stored in PostgreSQL with hashed refresh tokens.
- Refresh tokens are delivered in the httpOnly `fintrack_refresh` cookie.
- Refresh token calls rotate the refresh token and invalidate the previous token.
- Logout clears the refresh cookie and invalidates the current refresh session when a session is present.
- OTP Redis key: `otp:{email}`, 10 minute TTL.
- Password reset token: short-lived JWT signed with `ACCESS_TOKEN_SECRET`.

Production hardening still required:

- Add CSRF protection or document the final same-site cookie threat model for state-changing requests.
- Verify `Secure`, `HttpOnly`, `SameSite=Lax`, domain, proxy, and CORS behavior in the production hosting environment.
- Use cryptographic OTP generation.

## Data Models

Main Prisma models:

- `User`: profile, auth credentials, currency.
- `Account`: bank/cash/credit/wallet account and current balance.
- `Transaction`: income or expense, optional account, category, tags.
- `Transfer`: movement between two accounts.
- `Category`: user-owned spending/income category.
- `Tag`: user-owned transaction label.
- `BudgetGoal`: category budget for a month/year.
- `SavingsBucket`: unallocated saved money.
- `SavingsGoal`: named savings target.
- `RecurringTransaction`: scheduled transaction template.
- `RefreshSession`: server-side refresh session with hashed rotating token.
- `AuditLog`: user-visible audit trail for security and money-changing actions.

## Endpoint Summary

### Health

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | No | Liveness check with timestamp, uptime, and request ID |
| GET | `/ready` | No | Readiness check for PostgreSQL and Redis with dependency status and latency; returns `503` when not ready |

### Auth

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | `{ name, email, password }` |
| POST | `/api/auth/login` | No | `{ email, password }` |
| POST | `/api/auth/refresh` | No | httpOnly `fintrack_refresh` cookie |
| POST | `/api/auth/logout` | Yes | none |
| POST | `/api/auth/logout-all` | Yes | none |
| POST | `/api/auth/logout-other` | Yes | none |
| GET | `/api/auth/sessions` | Yes | none |
| POST | `/api/auth/forgot-password` | No | `{ email }` |
| POST | `/api/auth/verify-otp` | No | `{ email, otp }` |
| POST | `/api/auth/reset-password` | No | `{ resetToken, newPassword }` |

### User

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/api/user/me` | Yes | none |
| PUT | `/api/user/me` | Yes | `{ name?, currency? }` |
| GET | `/api/user/me/preferences` | Yes | none |
| PUT | `/api/user/me/preferences` | Yes | `{ budgetAlerts?, monthlyReports?, billReminders? }` |
| POST | `/api/user/me/change-password` | Yes | `{ currentPassword, newPassword }` |
| DELETE | `/api/user/me` | Yes | none |

### Accounts

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/api/accounts` | Yes | none |
| POST | `/api/accounts` | Yes | `{ name, type, balance? }` |
| PUT | `/api/accounts/:id` | Yes | `{ name?, type?, balance? }` |
| DELETE | `/api/accounts/:id` | Yes | none |

`type` is one of `BANK`, `CASH`, `CREDIT`, `WALLET`.

### Transactions

| Method | Path | Auth | Body / Query |
| --- | --- | --- | --- |
| GET | `/api/transactions` | Yes | `search?`, `type?`, `categoryId?`, `accountId?`, `tagId?`, `from?`, `to?`, `page?`, `limit?` |
| POST | `/api/transactions` | Yes | `{ title, amount, type, categoryId, date, notes?, accountId?, tagIds? }` |
| GET | `/api/transactions/:id` | Yes | none |
| PUT | `/api/transactions/:id` | Yes | partial transaction body |
| DELETE | `/api/transactions/:id` | Yes | none |

`type` is `INCOME` or `EXPENSE`. Dates must be ISO datetime strings.

### Imports

| Method | Path | Auth | Body / Query |
| --- | --- | --- | --- |
| POST | `/api/imports/transactions` | Yes | multipart `file`, query `dryRun?` |

CSV transaction imports support preview and commit:

- `dryRun=true` validates rows and returns row-level statuses without writing.
- `dryRun=false` imports valid non-duplicate rows.
- Required CSV columns: `date`, `title`, `amount`, `type`, `category`.
- Optional CSV columns: `account`, `notes`, `tags`.
- `category`, `account`, and `tags` may reference user-owned names or IDs.
- `tags` are separated with `;` or `|`.
- Imports update account balances transactionally and write audit logs.
- Duplicate rows are skipped based on date, title, amount, type, category, and account.

### Categories

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/api/categories` | Yes | none |
| POST | `/api/categories` | Yes | `{ name, color, icon }` |
| PUT | `/api/categories/:id` | Yes | `{ name?, color?, icon? }` |
| DELETE | `/api/categories/:id` | Yes | none |

Default categories cannot be deleted.

### Tags

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/api/tags` | Yes | none |
| POST | `/api/tags` | Yes | `{ name }` |
| PUT | `/api/tags/:id` | Yes | `{ name? }` |
| DELETE | `/api/tags/:id` | Yes | none |

Tag notes:

- Tags are reusable user-owned labels.
- Transaction create/update accepts `tagIds` to attach or detach tags per transaction.
- Transaction search matches tag names; `tagId` filters to transactions attached to one tag.
- Tag names are trimmed, limited to 40 characters, and checked case-insensitively for duplicates.
- Deleting a tag removes that label from transactions; the transactions remain.

### Transfers

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/api/transfers` | Yes | none |
| POST | `/api/transfers` | Yes | `{ fromAccountId, toAccountId, amount, date?, notes? }` |

Missing for production: get one, update/reversal, delete policy, pagination, and date filters.

### Recurring Transactions

| Method | Path | Auth | Body / Query |
| --- | --- | --- | --- |
| GET | `/api/recurring` | Yes | `type?`, `accountId?`, `categoryId?`, `isActive?`, `page?`, `limit?` |
| POST | `/api/recurring` | Yes | `{ accountId, title, amount, type, categoryId, frequency, nextDate, notes?, isActive? }` |
| GET | `/api/recurring/:id` | Yes | none |
| GET | `/api/recurring/:id/executions` | Yes | `page?`, `limit?` |
| POST | `/api/recurring/:id/run-now` | Yes | none |
| POST | `/api/recurring/:id/skip` | Yes | none |
| PUT | `/api/recurring/:id` | Yes | partial recurring transaction body |
| DELETE | `/api/recurring/:id` | Yes | none |

`frequency` is one of `DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `YEARLY`.

Execution history records `SUCCESS`, `SKIPPED`, and `FAILED` outcomes for automatic runs, manual run-now actions, and skip actions.

### Budget Goals

| Method | Path | Auth | Body / Query |
| --- | --- | --- | --- |
| GET | `/api/budget-goals` | Yes | `month`, `year` |
| POST | `/api/budget-goals` | Yes | `{ categoryId, limitAmount, month, year }` |
| PUT | `/api/budget-goals/:id` | Yes | `{ limitAmount }` |
| DELETE | `/api/budget-goals/:id` | Yes | none |

### Reports

| Method | Path | Auth | Query |
| --- | --- | --- | --- |
| GET | `/api/reports/summary` | Yes | `month`, `year` |
| GET | `/api/reports/by-category` | Yes | `month`, `year` |
| GET | `/api/reports/trend` | Yes | none |

### Savings

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/api/savings/bucket` | Yes | none |
| POST | `/api/savings/bucket/deposit` | Yes | `{ amount, note? }` |
| POST | `/api/savings/bucket/withdraw` | Yes | `{ amount, note? }` |
| GET | `/api/savings/goals` | Yes | none |
| POST | `/api/savings/goals` | Yes | `{ name, targetAmount?, deadline? }` |
| PUT | `/api/savings/goals/:id` | Yes | `{ name?, targetAmount?, deadline? }` |
| POST | `/api/savings/goals/:id/allocate` | Yes | `{ amount }` |
| DELETE | `/api/savings/goals/:id` | Yes | none |

### Exports

| Method | Path | Auth | Query |
| --- | --- | --- | --- |
| GET | `/api/exports/transactions/pdf` | Yes | `search?`, `type?`, `categoryId?`, `accountId?`, `tagId?`, `from?`, `to?` |
| GET | `/api/exports/reports/pdf` | Yes | `month`, `year` |

### Audit Logs

| Method | Path | Auth | Query |
| --- | --- | --- | --- |
| GET | `/api/audit` | Yes | `action?`, `entityType?`, `page?`, `limit?` |

Audit logs include action, entity type, entity id, request id when available, hashed IP/user-agent when available, redacted metadata, and timestamp.

### Notifications

| Method | Path | Auth | Body / Query |
| --- | --- | --- | --- |
| GET | `/api/notifications` | Yes | `page?`, `limit?`, `unreadOnly?` |
| GET | `/api/notifications/unread-count` | Yes | none |
| POST | `/api/notifications/:id/read` | Yes | none |
| POST | `/api/notifications/read-all` | Yes | none |
| DELETE | `/api/notifications/read` | Yes | none |

Notifications are in-app history records. Current producers include budget pressure checks, due-soon recurring items, savings milestones, and committed CSV imports. Delivery is in-app only; email/push delivery remains future work.

## Default Categories

These are seeded for each user on registration:

- Food & Dining
- Transport
- Housing
- Entertainment
- Shopping
- Health
- Education
- Savings
- Income
- Other

## Error Format

Centralized error shape:

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

## Product TODO

- Continue migrating frontend hooks from hand-maintained domain types to generated OpenAPI operation types.
- Add pagination to remaining list endpoints.
- Add timezone-aware reporting.
- Add richer recurring transaction operations beyond run/skip, such as retry failed execution and bulk calendar operations.
- Add audit log UI in the frontend.
