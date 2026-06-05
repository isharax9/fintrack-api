# Task 02: Frontend Design System

Goal: replace the existing frontend UI with a premium, production-grade finance workspace design system.

Target maturity: UI/product foundation 8/10 before building feature pages.

## Decision

Chosen style: **Option C: professional finance workspace with premium consumer polish**.

Working name for the visual system: **Sovereign Ledger**.

This should feel like a serious money-control product: dense enough for repeat daily use, polished enough to feel premium, and calm enough that financial data is easy to scan.

## Current Frontend Assessment

Repo: `../fintrack-web`

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

What is worth keeping:

- Next.js App Router project structure.
- TanStack Query for server state.
- React Hook Form and Zod for forms.
- Recharts for first charting pass.
- Lucide icons.
- Existing API hook ideas, after types are corrected.

What should be replaced:

- Current visual language.
- Current root header from `src/app/layout.tsx`.
- Current sidebar/navbar styling.
- Current dashboard composition and hardcoded finance values.
- Current untyped icon lookup patterns.
- Current auth storage approach when auth architecture is rebuilt.
- Page-specific one-off UI classes that should become reusable primitives.

## Inspiration Mapping

Use these references from `web-designs-to-inspire/`:

- `obsidian_deep/DESIGN.md`: creative north star, palette, hierarchy, component tone.
- `financial_dashboard_overview_2`: dashboard layout, left navigation, data module rhythm.
- `detailed_transaction_ledger_1`: table density, filters, pagination, transaction ledger style.
- `quick_add_transaction_modal_2`: quick-add transaction modal and large amount input behavior.
- `category_budget_planner_1`: budget status cards, month controls, progress visualizations.
- `savings_goals_tracker_2`: savings goal cards, status badges, add-goal affordance.
- `manage_recurring_transactions`: recurring list and schedule management patterns.
- `financial_analytics_insights_2`: report/insight layout and chart hierarchy.
- `settings&notifications`: settings forms, toggles, save/discard flow.
- `login_page` and `signup_page`: auth surfaces.
- `onboarding_set_initial_goals`: onboarding flow.

Do not copy generated HTML directly. Translate the patterns into reusable React components.

## Visual Direction

### Palette

Dark-first, mineral finance palette:

- Canvas: deep obsidian, near `#0B1115` / `#101A1D`.
- Sidebar: slightly darker than content canvas.
- Surface 1: card/module backgrounds around `#171C22`.
- Surface 2: interactive fields/hover backgrounds around `#1E2B31`.
- Border: low-contrast blue-green/steel strokes.
- Primary: teal/cyan for navigation, primary CTAs, progress emphasis.
- Success: green for inflow and positive movement.
- Danger: red/coral for outflow, over-budget, destructive action.
- Warning: amber/gold for due soon, low remaining, paced/attention states.
- Info: blue for neutral system/status signals.

Avoid making the whole UI a single teal theme. Teal is the brand accent, not the whole palette.

### Typography

Recommended:

- Keep Manrope for app UI and data readability, or use Plus Jakarta Sans for headings plus Manrope for body.
- Page titles: 32-40px desktop, 26-30px mobile.
- Card figures: 30-36px desktop, 26-30px mobile.
- Table/body: 14-15px.
- Labels/meta: 11-12px uppercase with modest tracking.

Rules:

- No viewport-scaled font sizes.
- Letter spacing must not be negative.
- Use tabular numbers for financial figures.
- Reserve huge type for money entry and main financial totals only.

### Layout

Primary app layout:

- Fixed/sticky left sidebar on desktop.
- Mobile sidebar as drawer.
- Sticky top command bar with global search, quick actions, notifications, and user/session menu.
- Main content max width per page, but dashboards/tables should use the available width.
- Use full-width page bands and unframed page sections; cards are for repeated items, data modules, dialogs, and tools.

Core desktop grid:

- Dashboard: 12-column grid.
- Ledger/tables: full-width table surface with filter toolbar above.
- Settings: stacked full-width panels.
- Savings/budgets: responsive card grids plus summary modules.

### Shape And Depth

- Cards and panels: 8-12px radius, with 8px preferred for dense operational surfaces.
- Icon buttons: square or circular, stable dimensions.
- Primary CTA: teal with subtle glow only when it is the main page action.
- Avoid decorative blobs/orbs/background gradients.
- Use borders and tonal contrast for hierarchy; avoid nesting cards inside cards.

## Component System Scope

Build primitives first:

- `Button`: primary, secondary, ghost, danger, icon, loading.
- `IconButton`: stable square size, tooltip support.
- `Input`, `AmountInput`, `Textarea`.
- `Select`, `Combobox`, `DatePicker`.
- `SegmentedControl`.
- `Tabs`.
- `Switch`, `Checkbox`.
- `Dialog`, `ConfirmDialog`, `Drawer`.
- `Toast`.
- `Tooltip`.
- `Badge`, `StatusBadge`, `CategoryBadge`.
- `Card`, `MetricCard`, `DataPanel`.
- `ProgressBar`, `ProgressRing`.
- `Table`, `DataToolbar`, `Pagination`.
- `EmptyState`, `Skeleton`, `ErrorState`.
- `PageHeader`, `PageActions`.
- `AppShell`, `Sidebar`, `Topbar`.

Domain components:

- `MoneyValue`.
- `CategoryIcon`.
- `TransactionTypeToggle`.
- `TransactionQuickAddDialog`.
- `AccountSelector`.
- `CategorySelector`.
- `TagSelector`.
- `MonthPicker`.
- `BudgetStatusCard`.
- `SavingsGoalCard`.
- `RecurringRuleBadge`.
- `SessionListItem`.

## Data And API Direction

Backend now exposes OpenAPI at `/openapi.json`.

Frontend should use generated or contract-derived API types instead of hand-maintained stale types.

Required type fixes before/while rebuilding:

- `Transaction` must include `accountId`, optional account relation, tags, notes nullability.
- `CreateTransactionRequest` must include optional `accountId` and `tagIds`.
- `TransactionFilters` must include `accountId`.
- Add `Account`, `Transfer`, `SavingsBucket`, `SavingsGoal`, `RecurringTransaction`, `AuditLog`, `RefreshSession`.
- Align auth refresh response with backend: refresh returns both `accessToken` and `refreshToken`.

Auth target:

- Short term: keep current token model only while rebuilding screens.
- Production target: move refresh token into httpOnly cookie or backend-for-frontend session.
- Use `GET /api/auth/sessions` for settings/session management UI.
- Route protection must avoid flashing private content.

## Page Direction

### Auth

Use centered auth panels inspired by `login_page` and `signup_page`.

Screens:

- Login
- Register
- Forgot password
- Verify OTP
- Reset password

Requirements:

- Clear field-level errors.
- Password strength and requirements.
- OTP resend cooldown.
- Form loading and disabled states.
- No fake social login buttons unless backed by real auth.

### App Shell

Primary nav:

- Dashboard
- Transactions
- Accounts
- Budgets
- Savings
- Recurring
- Reports
- Settings

Topbar:

- Global search placeholder initially, then wire to transactions/search later.
- Quick add transaction.
- Notifications placeholder only if clearly disabled or backed by state.
- User menu with sessions/logout.

### Dashboard

Use `financial_dashboard_overview_2` as the base composition, but remove hardcoded values.

Modules:

- Total account balance.
- Monthly income.
- Monthly expenses.
- Net savings/savings rate.
- Spending breakdown.
- Recent transactions.
- Budget progress.
- Upcoming recurring transactions.
- Savings progress.
- Financial tip/insight only if computed or clearly static educational content.

### Transactions

Use `detailed_transaction_ledger_1`.

Requirements:

- Search input, date filter, category filter, account filter, type filter.
- Server pagination.
- Create/edit/delete.
- Tags and notes.
- Export action.
- Empty state and loading skeleton.

### Accounts

New screen.

Requirements:

- Account cards grouped by type.
- Create/edit/delete.
- Transfer between accounts.
- Account transaction drilldown.
- Guard deletion when backend rejects linked account.

### Budgets

Use `category_budget_planner_1`.

Requirements:

- Month selector.
- Summary metrics.
- Budget cards with spent/limit/remaining/over-budget states.
- Create/edit/delete budget goal.
- Category selection.

### Savings

Use `savings_goals_tracker_2`.

Requirements:

- Savings bucket balance.
- Active/completed tabs.
- Goal cards.
- Create/edit/delete goals.
- Allocate bucket funds to goal.
- Explain empty bucket clearly.

### Recurring

Use `manage_recurring_transactions`.

Requirements:

- List recurring transactions.
- Create/edit/delete.
- Pause/resume via `isActive`.
- Next run date.
- Frequency labels.
- Upcoming schedule view.

### Reports

Use `financial_analytics_insights_2`.

Requirements:

- Monthly summary.
- Category breakdown.
- Six-month trend.
- PDF exports.
- Empty/loading/error states.

### Settings

Use `settings&notifications`.

Requirements:

- Profile.
- Currency.
- Sessions list from `GET /api/auth/sessions`.
- Logout current/all sessions.
- Delete account confirmation.
- Placeholder or disabled notification preferences until backed by API.

## Implementation Phases

### Phase 1: Foundation (Completed ✅)

- [x] Remove old root header.
- [x] Create CSS token system (using Tailwind CSS 4 in `src/app/globals.css`).
- [x] Create AppShell, Sidebar, and Topbar navigation layouts.
- [x] Create primitive component library (`Button`, `IconButton`, `Badge`, `Panel`, `PageHeader`, `ProgressBar`, `EmptyState`, `LoadingSpinner`).
- [x] Add typed icon helpers (`src/lib/categoryIcons.ts` mapping database categories to Lucide icons).
- [x] Fix lint errors introduced by old MVP.

### Phase 2: API Client And Types (Completed ✅)

- [x] Generate or derive API types from `/openapi.json` contract to replace manual stale types in `src/types/index.ts`.
- [x] Normalize API error handling in Axios intercepts and global error states.
- [x] Implement robust TanStack query keys and mutation handlers for remaining entities.


### Phase 3: Auth And Settings (In Progress 🔄)

- [ ] Rebuild auth screens with advanced strength meters, loading states, and OTP resend cooldown timers.
- [x] Rebuild settings profile information forms (Name, Currency fields).
- [ ] Rebuild settings session management (`GET /api/auth/sessions`).
- [ ] Add "logout other sessions" and "logout all sessions" (`POST /api/auth/logout-all`) buttons in the Settings UI.
- [ ] Connect the settings Change Password form to the backend API.

### Phase 4: Core Money Workflows (In Progress 🔄)

- [x] **Dashboard**: Fully overhauled layout, charts, recent transactions, spending breakdown, budget progress, upcoming bills, and balance cards to pull dynamic data.
- [x] **Transactions**: Integrated advanced filters (Search, Date, Category, Type, Account) and server pagination.
- [x] **Accounts**: Grouped account cards by type (Savings, Checking, Credit Cards), full CRUD forms, transfer money flows, and deletion guards.
- [x] **Reports**: Dynamic six-month trend area charts and spending breakdown pie charts connected to the API.
- [ ] **Budgets**: Rebuild and verify Category Budget Planner limit creation, editing, and deletion.
- [ ] **Savings**: Rebuild the Savings Goals page to connect to backend savings APIs (currently uses hardcoded `DEMO_GOALS`).
- [ ] **Recurring**: Rebuild the Recurring Transactions page to connect to backend recurring APIs (currently uses hardcoded `DEMO_RECURRING`).
- [ ] **PDF Exporting**: Wire the download action on the Analytics & Insights page to fetch/generate the PDF report from the API.

### Phase 5: QA

- [ ] Build and lint.
- [ ] Responsive visual review at mobile/tablet/desktop.
- [ ] Keyboard navigation checks for dialogs/forms.
- [ ] Playwright smoke tests for auth, dashboard, transaction CRUD, budget CRUD, and settings.

## Acceptance Criteria

- Existing visual identity is fully replaced.
- New token system exists in CSS.
- App shell is responsive and stable.
- Component primitives have consistent focus, hover, disabled, loading, error, and empty states.
- No visible marketing landing page before the app experience.
- No hardcoded demo finance values in production screens.
- Text never overflows buttons/cards at mobile or desktop widths.
- Tables and filters remain usable on mobile.
- Frontend types match backend OpenAPI contract.
- `npm run build` passes.
- `npm run lint` passes.

## Verification

From `../fintrack-web`:

```bash
npm run build
npm run lint
```

Manual visual QA:

- Mobile: 390px wide.
- Tablet: 768px wide.
- Desktop: 1440px wide.
- Wide desktop: 1600px+.

Check:

- Auth pages.
- App shell.
- Dialog keyboard flow.
- Dashboard data density.
- Transaction table responsiveness.
- Settings/session management.
