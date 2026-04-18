You are building a production-ready Budget Planning Web Application MVP called "FinTrack".
Split into TWO separate repositories: fintrack-web (frontend) and fintrack-api (backend).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPO 1: fintrack-api (Backend)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Tech Stack
- Runtime: Node.js
- Framework: Fastify
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL (Supabase)
- Auth: Custom JWT (jsonwebtoken library)
- Password Hashing: bcryptjs
- Cache: Redis (Upstash) — for refresh token blacklisting & rate limiting
- Email: Nodemailer + Gmail SMTP (for password reset emails)
- Validation: Zod
- Env Config: dotenv + @fastify/env

## Folder Structure
fintrack-api/
├── src/
│   ├── config/
│   │   ├── env.ts               # Zod-validated env variables
│   │   ├── db.ts                # Prisma client singleton
│   │   └── redis.ts             # Redis client
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts   # Zod schemas
│   │   ├── user/
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── budgetGoals/
│   │   └── reports/
│   ├── plugins/
│   │   ├── jwt.ts               # JWT Fastify plugin
│   │   ├── cors.ts
│   │   └── rateLimit.ts
│   ├── middleware/
│   │   └── authenticate.ts      # JWT guard middleware
│   ├── utils/
│   │   ├── jwt.ts               # sign/verify access + refresh tokens
│   │   ├── hash.ts              # bcrypt helpers
│   │   └── email.ts             # Nodemailer email sender
│   └── app.ts                   # Fastify app entry
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env.example
├── package.json
└── tsconfig.json

## Auth System (Custom JWT)

### Token Strategy
- Access Token: JWT, expires in 15 minutes, signed with ACCESS_TOKEN_SECRET
- Refresh Token: JWT, expires in 7 days, signed with REFRESH_TOKEN_SECRET
- Refresh tokens stored in Redis with key: refresh:{userId} → token
- On logout: delete refresh token from Redis (blacklist)
- On refresh: validate token exists in Redis, issue new access token

### Auth Endpoints
POST /api/auth/register
  Body: { name, email, password }
  - Hash password with bcrypt (saltRounds: 12)
  - Create user in DB
  - Seed default categories for the user
  - Return: { accessToken, refreshToken, user }

POST /api/auth/login
  Body: { email, password }
  - Verify email exists
  - Compare password with bcrypt
  - Issue access + refresh tokens
  - Store refresh token in Redis
  - Return: { accessToken, refreshToken, user }

POST /api/auth/refresh
  Body: { refreshToken }
  - Verify token signature
  - Check token exists in Redis
  - Issue new access token
  - Return: { accessToken }

POST /api/auth/logout
  Headers: Authorization: Bearer <accessToken>
  - Delete refresh token from Redis
  - Return: { message: "Logged out" }

POST /api/auth/forgot-password
  Body: { email }
  - Generate 6-digit OTP, store in Redis with key: otp:{email}, TTL 10 minutes
  - Send OTP to email via Nodemailer
  - Return: { message: "OTP sent" }

POST /api/auth/verify-otp
  Body: { email, otp }
  - Check OTP in Redis
  - If valid: issue a short-lived resetToken (JWT, 10 min)
  - Delete OTP from Redis
  - Return: { resetToken }

POST /api/auth/reset-password
  Body: { resetToken, newPassword }
  - Verify resetToken
  - Hash new password, update DB
  - Invalidate all existing refresh tokens for user in Redis
  - Return: { message: "Password reset successful" }

## Database Schema (Prisma)

model User {
  id           String         @id @default(cuid())
  name         String
  email        String         @unique
  password     String
  currency     String         @default("USD")
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  transactions Transaction[]
  categories   Category[]
  budgetGoals  BudgetGoal[]
}

model Transaction {
  id         String          @id @default(cuid())
  userId     String
  user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String
  amount     Decimal         @db.Decimal(10, 2)
  type       TransactionType
  categoryId String
  category   Category        @relation(fields: [categoryId], references: [id])
  date       DateTime
  notes      String?
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
}

model Category {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  color        String
  icon         String
  isDefault    Boolean       @default(false)
  transactions Transaction[]
  budgetGoals  BudgetGoal[]
}

model BudgetGoal {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])
  limitAmount Decimal  @db.Decimal(10, 2)
  month       Int
  year        Int
  createdAt   DateTime @default(now())
}

enum TransactionType {
  INCOME
  EXPENSE
}

## All API Endpoints

### Transactions — all protected with JWT middleware
GET    /api/transactions          # list with filters: ?type, ?categoryId, ?from, ?to, ?page, ?limit
POST   /api/transactions          # create
GET    /api/transactions/:id      # get one
PUT    /api/transactions/:id      # update
DELETE /api/transactions/:id      # delete

### Categories
GET    /api/categories            # list user's categories
POST   /api/categories            # create custom category
PUT    /api/categories/:id        # update
DELETE /api/categories/:id        # delete (only non-default)

### Budget Goals
GET    /api/budget-goals          # list by ?month&year
POST   /api/budget-goals          # create
PUT    /api/budget-goals/:id      # update
DELETE /api/budget-goals/:id      # delete

### Reports
GET    /api/reports/summary       # ?month&year → total income, expense, savings
GET    /api/reports/by-category   # ?month&year → spending per category
GET    /api/reports/trend         # last 6 months income vs expense

### User
GET    /api/user/me               # get profile
PUT    /api/user/me               # update name, currency
DELETE /api/user/me               # delete account

## Default Categories (seed on register)
{ name: "Food & Dining",   color: "#FF6B6B", icon: "utensils"     }
{ name: "Transport",       color: "#4ECDC4", icon: "car"          }
{ name: "Housing",         color: "#45B7D1", icon: "home"         }
{ name: "Entertainment",   color: "#96CEB4", icon: "film"         }
{ name: "Shopping",        color: "#FFEAA7", icon: "shopping-bag" }
{ name: "Health",          color: "#DDA0DD", icon: "heart"        }
{ name: "Education",       color: "#98D8C8", icon: "book"         }
{ name: "Savings",         color: "#7EC8E3", icon: "piggy-bank"   }
{ name: "Income",          color: "#90EE90", icon: "trending-up"  }
{ name: "Other",           color: "#D3D3D3", icon: "more-horizontal" }

## Security Requirements
- Helmet plugin for HTTP security headers
- Rate limiting: 100 req/min per IP (global), 5 req/15min on auth routes
- CORS: allow only fintrack-web domain
- All user data queries must filter by authenticated userId (no cross-user access)
- Zod validation on all request bodies
- Never return password field in any response

## Environment Variables (.env.example)
DATABASE_URL=
REDIS_URL=
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
BCRYPT_SALT_ROUNDS=12
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
APP_NAME=FinTrack
FRONTEND_URL=http://localhost:3000
PORT=5000


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPO 2: fintrack-web (Frontend)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Tech Stack
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + shadcn/ui
- State: Zustand
- Server State: TanStack Query v5
- Charts: Recharts
- Forms: React Hook Form + Zod
- HTTP Client: Axios with interceptors
- Auth: Custom JWT stored in httpOnly cookies
- Notifications: Sonner (toast)
- Icons: Lucide React

## Folder Structure
fintrack-web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── verify-otp/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # sidebar + navbar layout
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── budget-goals/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   └── auth/
│   │       └── refresh/route.ts  # Next.js route handler for silent refresh
│   ├── layout.tsx
│   └── page.tsx                  # redirects to /dashboard or /login
├── components/
│   ├── ui/                       # shadcn components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Navbar.tsx
│   ├── dashboard/
│   │   ├── BalanceCard.tsx
│   │   ├── SpendingSummary.tsx
│   │   ├── RecentTransactions.tsx
│   │   ├── BudgetProgressList.tsx
│   │   └── TrendChart.tsx
│   ├── transactions/
│   │   ├── TransactionTable.tsx
│   │   ├── TransactionModal.tsx
│   │   └── TransactionFilters.tsx
│   ├── budget-goals/
│   │   ├── GoalCard.tsx
│   │   └── GoalModal.tsx
│   ├── reports/
│   │   ├── CategoryPieChart.tsx
│   │   └── MonthlyBarChart.tsx
│   └── shared/
│       ├── EmptyState.tsx
│       ├── LoadingSpinner.tsx
│       └── ConfirmDialog.tsx
├── lib/
│   ├── axios.ts                  # Axios instance + interceptors
│   ├── queryClient.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useTransactions.ts
│   ├── useCategories.ts
│   ├── useBudgetGoals.ts
│   └── useReports.ts
├── store/
│   └── authStore.ts              # Zustand: user, accessToken
├── types/
│   └── index.ts                  # shared TS types matching backend
├── .env.example
├── middleware.ts                  # Next.js middleware for route protection
└── tsconfig.json

## Auth Flow (Frontend)

### Token Storage Strategy
- Access Token: stored in Zustand memory (NOT localStorage, NOT cookie directly)
- Refresh Token: stored in httpOnly cookie (set by backend via Set-Cookie header)
- On app load: call /api/auth/refresh silently to restore session
- Access token auto-refreshed via Axios response interceptor on 401

### Axios Interceptor Logic
- Request interceptor: attach accessToken from Zustand to Authorization header
- Response interceptor: on 401 → call refresh endpoint → retry original request
- On refresh failure: clear auth state → redirect to /login

### Auth Pages
1. Register: name, email, password, confirm password
2. Login: email, password, "Remember me" checkbox
3. Forgot Password: email input → submit sends OTP
4. Verify OTP: 6-digit OTP input with countdown timer (10 min)
5. Reset Password: new password + confirm password

### Next.js Middleware (middleware.ts)
- Protect all /dashboard/* routes
- Redirect unauthenticated users to /login
- Redirect authenticated users away from /login and /register

## All Pages (match Stitch design: stitch_financial_dashboard_overview)

### Dashboard
- Total balance card (income - expenses)
- Monthly income vs expense summary cards
- Recent transactions list (last 5, click to view all)
- Budget progress bars per category (% spent of limit)
- Spending trend line chart (last 6 months, using Recharts)
- FAB button to add transaction

### Transactions Page
- Searchable, filterable transaction table
- Filters: type (income/expense), category, date range
- Add/Edit transaction modal with full form
- Delete with confirm dialog
- Pagination (10 per page)

### Budget Goals Page
- Grid of category goal cards
- Each card: category icon, name, spent/limit, progress bar
- Visual: green < 60%, yellow 60-80%, red > 80%
- Add/Edit/Delete goal modal

### Reports Page
- Month/Year selector at top
- Summary cards: total income, total expense, net savings, savings rate %
- Pie chart: spending breakdown by category
- Bar chart: 6-month income vs expense trend
- Table: top 5 spending categories with amounts

### Settings Page
- Profile section: update name, email
- Security section: change password form
- Preferences: currency selector
- Danger zone: delete account with confirmation

## Design Requirements
- Match ALL screens from "stitch_financial_dashboard_overview" folder exactly
- Use design's color tokens, typography scale, spacing, border radius, shadows
- Dark mode support via Tailwind dark: classes
- Fully responsive: mobile 375px → tablet 768px → desktop 1440px
- Smooth page transitions
- Skeleton loaders for all data-fetching states
- Empty states with illustration for all list views
- Toast notifications (Sonner) for all CRUD actions

## Environment Variables (.env.example)
NEXT_PUBLIC_API_URL=http://localhost:5000


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUILD ORDER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Start with fintrack-api:
1. Setup Fastify + Prisma + PostgreSQL + Redis
2. Build auth module (register, login, refresh, logout, forgot/reset password)
3. Build all CRUD modules (transactions, categories, budgetGoals)
4. Build reports module
5. Add middleware, validation, rate limiting, CORS

Then fintrack-web:
1. Setup Next.js + Tailwind + shadcn/ui
2. Build Axios instance with interceptors + Zustand auth store
3. Build all auth pages (login, register, forgot password, OTP, reset)
4. Build dashboard layout (sidebar + navbar)
5. Build Dashboard page
6. Build Transactions, Budget Goals, Reports, Settings pages in order