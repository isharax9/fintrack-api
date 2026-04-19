# FinTrack API — Complete Reference

> **Base URL:** `http://localhost:5001`  
> **Content-Type:** `application/json`  
> **Auth:** Bearer token in `Authorization` header (where noted 🔒)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Data Models](#data-models)
- [Endpoints](#endpoints)
  - [Auth](#1-auth)
  - [User](#2-user)
  - [Categories](#3-categories)
  - [Transactions](#4-transactions)
  - [Budget Goals](#5-budget-goals)
  - [Reports](#6-reports)
- [Error Handling](#error-handling)
- [Default Categories](#default-categories)

---

## Quick Start

```bash
# Start everything with Docker
docker compose up --build

# Health check
curl http://localhost:5001/health
# → { "status": "ok", "timestamp": "2026-04-18T17:30:00.000Z" }
```

---

## Authentication

All endpoints marked with 🔒 require a valid **access token** in the `Authorization` header:

```
Authorization: Bearer <accessToken>
```

### Token Strategy

| Token          | Type | Lifetime | Storage                  |
|----------------|------|----------|--------------------------|
| Access Token   | JWT  | 15 min   | Client memory (Zustand)  |
| Refresh Token  | JWT  | 7 days   | Redis (`refresh:{userId}`) |
| Reset Token    | JWT  | 10 min   | Stateless (signed JWT)   |
| OTP            | 6-digit string | 10 min | Redis (`otp:{email}`) |

---

## Data Models

### User

| Field      | Type     | Notes                     |
|------------|----------|---------------------------|
| id         | string   | CUID, auto-generated      |
| name       | string   |                           |
| email      | string   | Unique                    |
| password   | string   | bcrypt hash (never returned) |
| currency   | string   | Default: `"USD"`          |
| createdAt  | datetime |                           |
| updatedAt  | datetime |                           |

### Transaction

| Field      | Type     | Notes                            |
|------------|----------|----------------------------------|
| id         | string   | CUID                             |
| userId     | string   | FK → User                        |
| title      | string   |                                  |
| amount     | decimal  | Decimal(10,2), must be positive  |
| type       | enum     | `"INCOME"` or `"EXPENSE"`        |
| categoryId | string   | FK → Category                    |
| date       | datetime | ISO 8601 string                  |
| notes      | string?  | Optional                         |
| createdAt  | datetime |                                  |
| updatedAt  | datetime |                                  |

### Category

| Field      | Type     | Notes                          |
|------------|----------|--------------------------------|
| id         | string   | CUID                           |
| userId     | string   | FK → User                      |
| name       | string   |                                |
| color      | string   | Hex color code (e.g. `#FF6B6B`)|
| icon       | string   | Lucide icon name               |
| isDefault  | boolean  | `true` for seeded categories   |

### BudgetGoal

| Field       | Type     | Notes                    |
|-------------|----------|--------------------------|
| id          | string   | CUID                     |
| userId      | string   | FK → User                |
| categoryId  | string   | FK → Category            |
| limitAmount | decimal  | Decimal(10,2), positive  |
| month       | int      | 1–12                     |
| year        | int      | 2000–2100                |
| createdAt   | datetime |                          |

---

## Endpoints

---

### 1. Auth

#### `POST /api/auth/register`

Create a new user account. Seeds 10 default categories automatically.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secret123"
}
```

| Field    | Type   | Validation       |
|----------|--------|------------------|
| name     | string | min 2 chars      |
| email    | string | valid email      |
| password | string | min 6 chars      |

**Response `201`:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "clx1234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "currency": "USD",
    "createdAt": "2026-04-18T17:30:00.000Z",
    "updatedAt": "2026-04-18T17:30:00.000Z"
  }
}
```

**Error `400`:** `{ "message": "Email already in use" }`

---

#### `POST /api/auth/login`

Authenticate and receive tokens. Rate limited: **5 req / 15 min**.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "user": {
    "id": "clx1234567890",
    "name": "John Doe",
    "email": "john@example.com",
    "currency": "USD",
    "createdAt": "2026-04-18T17:30:00.000Z",
    "updatedAt": "2026-04-18T17:30:00.000Z"
  }
}
```

**Error `401`:** `{ "message": "Invalid credentials" }`

---

#### `POST /api/auth/refresh`

Issue a new access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbG..."
}
```

**Response `200`:**
```json
{
  "accessToken": "eyJhbG..."
}
```

**Error `401`:** `{ "message": "Invalid token" }`

---

#### `POST /api/auth/logout` 🔒

Invalidate the current refresh token.

**Response `200`:**
```json
{
  "message": "Logged out"
}
```

---

#### `POST /api/auth/forgot-password`

Send a 6-digit OTP to the user's email. Rate limited: **5 req / 15 min**.  
Returns success silently even if email not found (prevents enumeration).

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response `200`:**
```json
{
  "message": "OTP sent"
}
```

---

#### `POST /api/auth/verify-otp`

Verify the OTP and receive a short-lived reset token.

**Request Body:**
```json
{
  "email": "john@example.com",
  "otp": "482917"
}
```

| Field | Type   | Validation        |
|-------|--------|-------------------|
| email | string | valid email       |
| otp   | string | exactly 6 chars   |

**Response `200`:**
```json
{
  "resetToken": "eyJhbG..."
}
```

**Error `400`:** `{ "message": "Invalid or expired OTP" }`

---

#### `POST /api/auth/reset-password`

Reset the password using the reset token from OTP verification. Invalidates all existing refresh tokens.

**Request Body:**
```json
{
  "resetToken": "eyJhbG...",
  "newPassword": "newSecret456"
}
```

| Field       | Type   | Validation  |
|-------------|--------|-------------|
| resetToken  | string | required    |
| newPassword | string | min 6 chars |

**Response `200`:**
```json
{
  "message": "Password reset successful"
}
```

---

### 2. User

All user endpoints require authentication 🔒.

#### `GET /api/user/me` 🔒

Get the authenticated user's profile.

**Response `200`:**
```json
{
  "id": "clx1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "currency": "USD",
  "createdAt": "2026-04-18T17:30:00.000Z",
  "updatedAt": "2026-04-18T17:30:00.000Z"
}
```

---

#### `PUT /api/user/me` 🔒

Update name and/or currency preference.

**Request Body (all fields optional):**
```json
{
  "name": "John Updated",
  "currency": "EUR"
}
```

| Field    | Type   | Validation          |
|----------|--------|---------------------|
| name     | string | min 2 chars, optional |
| currency | string | exactly 3 chars, optional |

**Response `200`:** Updated user object (same shape as GET /me).

---

#### `DELETE /api/user/me` 🔒

Delete the authenticated user's account and all associated data (cascading delete).

**Response `200`:**
```json
{
  "message": "Account deleted successfully"
}
```

---

### 3. Categories

All category endpoints require authentication 🔒.

#### `GET /api/categories` 🔒

List all categories for the authenticated user. Default categories listed first.

**Response `200`:**
```json
[
  {
    "id": "clx...",
    "userId": "clx...",
    "name": "Food & Dining",
    "color": "#FF6B6B",
    "icon": "utensils",
    "isDefault": true
  },
  {
    "id": "clx...",
    "userId": "clx...",
    "name": "Freelance",
    "color": "#8B5CF6",
    "icon": "briefcase",
    "isDefault": false
  }
]
```

---

#### `POST /api/categories` 🔒

Create a custom category. `isDefault` is always `false`.

**Request Body:**
```json
{
  "name": "Freelance",
  "color": "#8B5CF6",
  "icon": "briefcase"
}
```

| Field | Type   | Validation  |
|-------|--------|-------------|
| name  | string | min 1 char  |
| color | string | min 4 chars |
| icon  | string | min 1 char  |

**Response `201`:** The created category object.

---

#### `PUT /api/categories/:id` 🔒

Update a category. All fields are optional.

**Request Body:**
```json
{
  "name": "Updated Name",
  "color": "#FF0000"
}
```

**Response `200`:** Updated category object.

**Error `400`:** `{ "message": "Category not found" }`

---

#### `DELETE /api/categories/:id` 🔒

Delete a category. **Cannot delete default categories.**

**Response `200`:**
```json
{
  "message": "Category deleted"
}
```

**Error `400`:** `{ "message": "Cannot delete default categories" }`

---

### 4. Transactions

All transaction endpoints require authentication 🔒.

#### `GET /api/transactions` 🔒

List transactions with optional filters and pagination.

**Query Parameters:**

| Param      | Type   | Default | Notes                         |
|------------|--------|---------|-------------------------------|
| type       | string | —       | `"INCOME"` or `"EXPENSE"`     |
| categoryId | string | —       | Filter by category (CUID)     |
| from       | string | —       | ISO 8601 datetime             |
| to         | string | —       | ISO 8601 datetime             |
| page       | number | 1       | Min: 1                        |
| limit      | number | 10      | Min: 1, Max: 100              |

**Example:**
```
GET /api/transactions?type=EXPENSE&page=1&limit=10&from=2026-04-01T00:00:00.000Z
```

**Response `200`:**
```json
{
  "data": [
    {
      "id": "clx...",
      "userId": "clx...",
      "title": "Grocery Shopping",
      "amount": "85.50",
      "type": "EXPENSE",
      "categoryId": "clx...",
      "date": "2026-04-15T10:00:00.000Z",
      "notes": "Weekly groceries",
      "createdAt": "...",
      "updatedAt": "...",
      "category": {
        "id": "clx...",
        "name": "Food & Dining",
        "color": "#FF6B6B",
        "icon": "utensils",
        "isDefault": true,
        "userId": "clx..."
      }
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

#### `POST /api/transactions` 🔒

Create a new transaction.

**Request Body:**
```json
{
  "title": "Grocery Shopping",
  "amount": 85.50,
  "type": "EXPENSE",
  "categoryId": "clx...",
  "date": "2026-04-15T10:00:00.000Z",
  "notes": "Weekly groceries"
}
```

| Field      | Type   | Validation                  |
|------------|--------|-----------------------------|
| title      | string | min 1 char                  |
| amount     | number | positive                    |
| type       | enum   | `"INCOME"` or `"EXPENSE"`   |
| categoryId | string | valid CUID, must belong to user |
| date       | string | ISO 8601 datetime           |
| notes      | string | optional                    |

**Response `201`:** Created transaction with `category` included.

---

#### `GET /api/transactions/:id` 🔒

Get a single transaction by ID.

**Response `200`:** Transaction object with `category` included.

**Error `404`:** `{ "message": "Transaction not found" }`

---

#### `PUT /api/transactions/:id` 🔒

Update a transaction. All fields are optional.

**Request Body:** Same as create, but all fields optional.

**Response `200`:** Updated transaction object.

---

#### `DELETE /api/transactions/:id` 🔒

Delete a transaction.

**Response `200`:**
```json
{
  "message": "Transaction deleted"
}
```

---

### 5. Budget Goals

All budget goal endpoints require authentication 🔒.

#### `GET /api/budget-goals?month=4&year=2026` 🔒

List budget goals for a specific month/year.

**Query Parameters (required):**

| Param | Type   | Validation     |
|-------|--------|----------------|
| month | number | 1–12           |
| year  | number | 2000–2100      |

**Response `200`:**
```json
[
  {
    "id": "clx...",
    "userId": "clx...",
    "categoryId": "clx...",
    "limitAmount": "500.00",
    "month": 4,
    "year": 2026,
    "createdAt": "...",
    "category": {
      "id": "clx...",
      "name": "Food & Dining",
      "color": "#FF6B6B",
      "icon": "utensils",
      "isDefault": true,
      "userId": "clx..."
    }
  }
]
```

---

#### `POST /api/budget-goals` 🔒

Create a budget goal. One goal per category per month.

**Request Body:**
```json
{
  "categoryId": "clx...",
  "limitAmount": 500,
  "month": 4,
  "year": 2026
}
```

| Field       | Type   | Validation              |
|-------------|--------|-------------------------|
| categoryId  | string | valid CUID, user's category |
| limitAmount | number | positive                |
| month       | number | 1–12                    |
| year        | number | 2000–2100               |

**Response `201`:** Created goal with `category` included.

**Error `400`:** `{ "message": "Budget goal already exists for this category in this month" }`

---

#### `PUT /api/budget-goals/:id` 🔒

Update the budget limit amount.

**Request Body:**
```json
{
  "limitAmount": 750
}
```

**Response `200`:** Updated goal object.

---

#### `DELETE /api/budget-goals/:id` 🔒

Delete a budget goal.

**Response `200`:**
```json
{
  "message": "Budget goal deleted"
}
```

---

### 6. Reports

All report endpoints require authentication 🔒.

#### `GET /api/reports/summary?month=4&year=2026` 🔒

Get monthly financial summary.

**Query Parameters (required):** `month` (1–12), `year` (2000–2100)

**Response `200`:**
```json
{
  "totalIncome": 5000,
  "totalExpense": 3200,
  "netSavings": 1800,
  "savingsRate": 36
}
```

---

#### `GET /api/reports/by-category?month=4&year=2026` 🔒

Get expense breakdown by category for a given month. Sorted by amount descending.

**Response `200`:**
```json
[
  {
    "categoryId": "clx...",
    "categoryName": "Food & Dining",
    "color": "#FF6B6B",
    "icon": "utensils",
    "amount": 1200
  },
  {
    "categoryId": "clx...",
    "categoryName": "Transport",
    "color": "#4ECDC4",
    "icon": "car",
    "amount": 800
  }
]
```

---

#### `GET /api/reports/trend` 🔒

Get the last 6 months of income vs. expense data for trend charts. No query params needed.

**Response `200`:**
```json
[
  { "month": "2025-11", "income": 4500, "expense": 3100 },
  { "month": "2025-12", "income": 5200, "expense": 3800 },
  { "month": "2026-01", "income": 4800, "expense": 3000 },
  { "month": "2026-02", "income": 5000, "expense": 3500 },
  { "month": "2026-03", "income": 5100, "expense": 3200 },
  { "month": "2026-04", "income": 5000, "expense": 3200 }
]
```

---

## Error Handling

All errors follow this format:

```json
{
  "message": "Human-readable error description"
}
```

| HTTP Code | Meaning                |
|-----------|------------------------|
| 400       | Bad request / validation error |
| 401       | Unauthorized (missing or invalid token) |
| 404       | Resource not found     |
| 429       | Rate limit exceeded    |
| 500       | Internal server error  |

### Rate Limits

| Scope       | Limit              |
|-------------|--------------------|
| Global      | 100 req / minute   |
| Auth routes | 5 req / 15 minutes |

---

## Default Categories

These 10 categories are auto-created when a user registers:

| Name            | Color     | Icon              |
|-----------------|-----------|--------------------|
| Food & Dining   | `#FF6B6B` | `utensils`         |
| Transport       | `#4ECDC4` | `car`              |
| Housing         | `#45B7D1` | `home`             |
| Entertainment   | `#96CEB4` | `film`             |
| Shopping        | `#FFEAA7` | `shopping-bag`     |
| Health          | `#DDA0DD` | `heart`            |
| Education       | `#98D8C8` | `book`             |
| Savings         | `#7EC8E3` | `piggy-bank`       |
| Income          | `#90EE90` | `trending-up`      |
| Other           | `#D3D3D3` | `more-horizontal`  |

---

### 7. Accounts

#### `GET /api/accounts` 🔒
List all accounts.

#### `POST /api/accounts` 🔒
Create an account. Types: `BANK`, `CASH`, `CREDIT`, `WALLET`.

#### `PUT /api/accounts/:id` 🔒
Update account details.

#### `DELETE /api/accounts/:id` 🔒
Delete an account.

---

### 8. Transfers

#### `GET /api/transfers` 🔒
List all transfers.

#### `POST /api/transfers` 🔒
Transfer money from one account to another. Automatically adjusts both account balances.

---

### 9. Tags

#### `GET /api/tags` 🔒
List all tags.

#### `POST /api/tags` 🔒
Create a tag.

#### `PUT /api/tags/:id` 🔒
Update a tag.

#### `DELETE /api/tags/:id` 🔒
Delete a tag.

---

### 10. Savings & Rollover

#### `GET /api/savings/bucket` 🔒
Get the main savings bucket. This bucket accumulates unused budget limits at the end of each month automatically.

#### `GET /api/savings/goals` 🔒
List specific savings goals.

#### `POST /api/savings/goals` 🔒
Create a savings goal.

#### `POST /api/savings/goals/:id/allocate` 🔒
Move funds from the main Savings Bucket into this specific savings goal.

---

### 11. PDF Exports

#### `GET /api/exports/transactions/pdf` 🔒
Streams a downloadable PDF table of your latest transactions.

#### `GET /api/exports/reports/pdf?month=4&year=2026` 🔒
Streams a downloadable PDF monthly report containing basic stats and an account overview.

---

## Default Categories

These 10 categories are auto-created when a user registers:

| Name            | Color     | Icon              |
|-----------------|-----------|--------------------|
| Food & Dining   | `#FF6B6B` | `utensils`         |
| Transport       | `#4ECDC4` | `car`              |
| Housing         | `#45B7D1` | `home`             |
| Entertainment   | `#96CEB4` | `film`             |
| Shopping        | `#FFEAA7` | `shopping-bag`     |
| Health          | `#DDA0DD` | `heart`            |
| Education       | `#98D8C8` | `book`             |
| Savings         | `#7EC8E3` | `piggy-bank`       |
| Income          | `#90EE90` | `trending-up`      |
| Other           | `#D3D3D3` | `more-horizontal`  |

---

## Architecture Overview

```
fintrack-api/
├── src/
│   ├── config/          # env, db (Prisma), redis
│   ├── middleware/       # JWT authentication guard
│   ├── modules/
│   │   ├── accounts/    # account/wallet management
│   │   ├── auth/        # register, login, refresh, logout, OTP flow
│   │   ├── budgetGoals/ # budget goal CRUD
│   │   ├── categories/  # category CRUD
│   │   ├── cron/        # scheduled background jobs
│   │   ├── exports/     # dynamic PDF generation
│   │   ├── reports/     # summary, by-category, trend
│   │   ├── savings/     # rollover logic and savings goals
│   │   ├── tags/        # custom metadata tags
│   │   ├── transactions/# transaction CRUD + filters
│   │   ├── transfers/   # account to account transfers
│   │   └── user/        # profile CRUD
│   ├── plugins/         # cors, helmet, rate-limit
│   ├── utils/           # jwt, hash, email helpers
│   ├── app.ts           # Fastify app builder
│   └── server.ts        # Entry point
├── prisma/
│   ├── schema.prisma    # Database models
│   └── seed.ts          # Seed script
├── package.json
└── docker-compose.yml   # PostgreSQL + Redis + API
```

### Docker Services

| Service | Image              | Internal Port | External Port |
|---------|--------------------|---------------|---------------|
| db      | postgres:15-alpine | 5432          | 5432          |
| redis   | redis:7-alpine     | 6379          | 6379          |
| api     | node:20-alpine     | 5001          | 5001          |
