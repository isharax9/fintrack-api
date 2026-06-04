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

## Environment

See `.env.example`.

Required services:

- PostgreSQL via `DATABASE_URL`.
- Redis via `REDIS_URL` for OTPs and rate limiting.
- SMTP credentials for password reset OTP emails.

## Auth Model

Current implementation:

- Access token: JWT, default `15m`.
- Refresh token: JWT, default `7d`, bound to a `RefreshSession`.
- Refresh sessions are stored in PostgreSQL with hashed refresh tokens.
- Refresh token calls rotate the refresh token and invalidate the previous token.
- OTP Redis key: `otp:{email}`, 10 minute TTL.
- Password reset token: short-lived JWT signed with `ACCESS_TOKEN_SECRET`.

Production change required:

- Move refresh tokens out of browser `localStorage`.
- Add httpOnly-cookie delivery or a backend-for-frontend session once the frontend is rebuilt.
- Add session management UI.
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
| GET | `/health` | No | Service health and timestamp |

### Auth

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | `{ name, email, password }` |
| POST | `/api/auth/login` | No | `{ email, password }` |
| POST | `/api/auth/refresh` | No | `{ refreshToken }` |
| POST | `/api/auth/logout` | Yes | none |
| POST | `/api/auth/logout-all` | Yes | none |
| POST | `/api/auth/forgot-password` | No | `{ email }` |
| POST | `/api/auth/verify-otp` | No | `{ email, otp }` |
| POST | `/api/auth/reset-password` | No | `{ resetToken, newPassword }` |

### User

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| GET | `/api/user/me` | Yes | none |
| PUT | `/api/user/me` | Yes | `{ name?, currency? }` |
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
| GET | `/api/transactions` | Yes | `type?`, `categoryId?`, `accountId?`, `from?`, `to?`, `page?`, `limit?` |
| POST | `/api/transactions` | Yes | `{ title, amount, type, categoryId, date, notes?, accountId?, tagIds? }` |
| GET | `/api/transactions/:id` | Yes | none |
| PUT | `/api/transactions/:id` | Yes | partial transaction body |
| DELETE | `/api/transactions/:id` | Yes | none |

`type` is `INCOME` or `EXPENSE`. Dates must be ISO datetime strings.

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
| PUT | `/api/recurring/:id` | Yes | partial recurring transaction body |
| DELETE | `/api/recurring/:id` | Yes | none |

`frequency` is one of `DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `YEARLY`.

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
| GET | `/api/savings/goals` | Yes | none |
| POST | `/api/savings/goals` | Yes | `{ name, targetAmount?, deadline? }` |
| PUT | `/api/savings/goals/:id` | Yes | `{ name?, targetAmount?, deadline? }` |
| POST | `/api/savings/goals/:id/allocate` | Yes | `{ amount }` |
| DELETE | `/api/savings/goals/:id` | Yes | none |

### Exports

| Method | Path | Auth | Query |
| --- | --- | --- | --- |
| GET | `/api/exports/transactions/pdf` | Yes | none |
| GET | `/api/exports/reports/pdf` | Yes | `month`, `year` |

### Audit Logs

| Method | Path | Auth | Query |
| --- | --- | --- | --- |
| GET | `/api/audit` | Yes | `action?`, `entityType?`, `page?`, `limit?` |

Audit logs include action, entity type, entity id, request id when available, hashed IP/user-agent when available, redacted metadata, and timestamp.

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

## Production TODO

- Add OpenAPI generation.
- Add contract tests against this document.
- Finish migrating existing legacy controller catch blocks to the central error handler.
- Add pagination to all list endpoints.
- Add timezone-aware reporting.
- Add httpOnly-cookie refresh delivery when the frontend auth layer is rebuilt.
- Add richer recurring transaction operations such as skip next run and run now.
