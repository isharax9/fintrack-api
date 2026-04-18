# FinTrack Web — Frontend MVP Specification

> **Repo:** `fintrack-web`  
> **Backend API:** `http://localhost:5001` (see `fintrack-api/API_DOCS.md`)

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Server State:** TanStack Query v5
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod
- **HTTP Client:** Axios with interceptors
- **Auth:** Custom JWT (access token in memory, refresh token via httpOnly cookie)
- **Notifications:** Sonner (toast)
- **Icons:** Lucide React

---

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

---

## Folder Structure

```
fintrack-web/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── verify-otp/page.tsx
│   │   └── reset-password/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx              # sidebar + navbar layout
│   │   ├── dashboard/page.tsx
│   │   ├── transactions/page.tsx
│   │   ├── budget-goals/page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   └── auth/
│   │       └── refresh/route.ts    # Next.js route handler for silent refresh
│   ├── layout.tsx
│   └── page.tsx                    # redirects to /dashboard or /login
├── components/
│   ├── ui/                         # shadcn components
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
│   ├── axios.ts                    # Axios instance + interceptors
│   ├── queryClient.ts
│   └── utils.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useTransactions.ts
│   ├── useCategories.ts
│   ├── useBudgetGoals.ts
│   └── useReports.ts
├── store/
│   └── authStore.ts                # Zustand: user, accessToken
├── types/
│   └── index.ts                    # TypeScript types matching backend models
├── .env.example
├── middleware.ts                    # Next.js middleware for route protection
└── tsconfig.json
```

---

## Auth Flow

### Token Storage
- **Access Token:** in Zustand memory (NOT localStorage, NOT cookies)
- **Refresh Token:** sent to/from backend; stored in Redis server-side
- **On app load:** call `POST /api/auth/refresh` silently to restore session
- **On 401:** Axios response interceptor → call refresh → retry original request

### Axios Interceptor Logic
```
Request  → attach accessToken from Zustand to Authorization header
Response → on 401: call refresh → retry original request
         → on refresh failure: clear auth state → redirect /login
```

### Next.js Middleware (`middleware.ts`)
- Protect all `/(dashboard)/*` routes
- Redirect unauthenticated users to `/login`
- Redirect authenticated users away from `/login` and `/register`

---

## Pages

### Auth Pages

| Page             | Route               | Fields                                        |
|------------------|----------------------|-----------------------------------------------|
| Login            | `/login`             | email, password, "Remember me"                |
| Register         | `/register`          | name, email, password, confirm password        |
| Forgot Password  | `/forgot-password`   | email input → sends OTP                       |
| Verify OTP       | `/verify-otp`        | 6-digit OTP input, countdown timer (10 min)   |
| Reset Password   | `/reset-password`    | new password + confirm password               |

---

### Dashboard — `/dashboard`

| Component             | Data Source                          | Notes                                  |
|----------------------|--------------------------------------|----------------------------------------|
| Total Balance Card   | `GET /api/reports/summary`           | income − expense                       |
| Income/Expense Cards | `GET /api/reports/summary`           | monthly totals                         |
| Recent Transactions  | `GET /api/transactions?limit=5`      | last 5, link to full list              |
| Budget Progress Bars | `GET /api/budget-goals` + summary    | % spent of limit per category          |
| Spending Trend Chart | `GET /api/reports/trend`             | Line chart, last 6 months (Recharts)   |
| FAB "Add Transaction"| Opens `TransactionModal`             |                                        |

---

### Transactions — `/transactions`

| Feature           | API Endpoint                          | Notes                                  |
|-------------------|---------------------------------------|----------------------------------------|
| Transaction Table | `GET /api/transactions`               | Searchable, filterable, paginated      |
| Filters           | Query params: `type`, `categoryId`, `from`, `to` | Dropdown + date range picker |
| Add/Edit Modal    | `POST` / `PUT /api/transactions/:id`  | Full form with category dropdown       |
| Delete            | `DELETE /api/transactions/:id`        | Confirm dialog before delete           |
| Pagination        | `?page=N&limit=10`                    | 10 per page                            |

---

### Budget Goals — `/budget-goals`

| Feature        | API Endpoint                           | Notes                                  |
|---------------|----------------------------------------|----------------------------------------|
| Goal Card Grid | `GET /api/budget-goals?month=M&year=Y` | Category icon, name, spent/limit, bar |
| Progress Color | Calculated client-side                  | Green <60%, Yellow 60-80%, Red >80%   |
| Add/Edit Modal | `POST` / `PUT /api/budget-goals/:id`   | Category dropdown, amount input        |
| Delete         | `DELETE /api/budget-goals/:id`          | Confirm dialog                         |

---

### Reports — `/reports`

| Component            | API Endpoint                     | Notes                                  |
|---------------------|----------------------------------|----------------------------------------|
| Month/Year Selector | Client-side                       | Controls all report data               |
| Summary Cards       | `GET /api/reports/summary`        | Income, expense, savings, savings rate |
| Pie Chart           | `GET /api/reports/by-category`    | Spending breakdown by category         |
| Bar Chart           | `GET /api/reports/trend`          | 6-month income vs expense              |
| Top Categories Table| `GET /api/reports/by-category`    | Top 5 spending categories              |

---

### Settings — `/settings`

| Section       | API Endpoint              | Notes                               |
|--------------|---------------------------|---------------------------------------|
| Profile      | `PUT /api/user/me`        | Update name                           |
| Preferences  | `PUT /api/user/me`        | Currency selector (3-char code)       |
| Security     | Password change form       | Uses forgot-password + OTP flow       |
| Danger Zone  | `DELETE /api/user/me`     | Account deletion with confirmation    |

---

## TypeScript Types (matching backend)

```typescript
// types/index.ts

export type TransactionType = 'INCOME' | 'EXPENSE';

export interface User {
  id: string;
  name: string;
  email: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  title: string;
  amount: string;      // Decimal comes as string from Prisma
  type: TransactionType;
  categoryId: string;
  category: Category;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetGoal {
  id: string;
  userId: string;
  categoryId: string;
  category: Category;
  limitAmount: string;  // Decimal comes as string from Prisma
  month: number;
  year: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ReportSummary {
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number;
}

export interface CategoryReport {
  categoryId: string;
  categoryName: string;
  color: string;
  icon: string;
  amount: number;
}

export interface TrendData {
  month: string;
  income: number;
  expense: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
```

---

## Design Requirements

- Match ALL screens from the provided design images exactly
- Use design's color tokens, typography scale, spacing, border radius, shadows
- Dark mode support via Tailwind `dark:` classes
- Fully responsive: mobile 375px → tablet 768px → desktop 1440px
- Smooth page transitions
- Skeleton loaders for all data-fetching states
- Empty states with illustration for all list views
- Toast notifications (Sonner) for all CRUD actions

---

## Build Order

1. Setup Next.js + Tailwind + shadcn/ui
2. Build Axios instance with interceptors + Zustand auth store
3. Build all auth pages (login, register, forgot password, OTP, reset)
4. Build dashboard layout (sidebar + navbar)
5. Build Dashboard page
6. Build Transactions, Budget Goals, Reports, Settings pages in order
