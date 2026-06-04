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
- Redis via `REDIS_URL` for refresh token checks, OTPs, and rate limiting.
- SMTP credentials for password reset OTP emails.

## Auth Model

Current implementation:

- Access token: JWT, default `15m`.
- Refresh token: JWT, default `7d`.
- Refresh token Redis key: `refresh:{userId}`.
- OTP Redis key: `otp:{email}`, 10 minute TTL.
- Password reset token: short-lived JWT signed with `ACCESS_TOKEN_SECRET`.

Production change required:

- Move refresh tokens out of browser `localStorage`.
- Add refresh token rotation and session records.
- Add device/session logout.
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

Known issue: summary PDF currently accepts `month` and `year`, but income and expense totals are not filtered by that period.

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

Current shape:

```json
{ "message": "Human readable error" }
```

Production target:

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
- Add database migrations and unique constraints.
- Add consistent error codes.
- Add pagination to all list endpoints.
- Add timezone-aware reporting.
- Add session and refresh token hardening.
- Add recurring transaction CRUD routes.
