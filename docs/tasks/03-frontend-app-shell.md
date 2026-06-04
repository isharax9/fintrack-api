# Task 03: Frontend App Shell

Goal: rebuild the authenticated application shell around the new design system.

## Scope

- Sidebar navigation.
- Topbar/search area.
- User/session menu.
- Notification entry point.
- Mobile navigation.
- Authenticated route guard.
- Global loading and error surfaces.
- App-level quick action button.

## Navigation

Primary sections:

- Dashboard
- Transactions
- Accounts
- Budgets
- Savings
- Recurring
- Reports
- Imports
- Notifications
- Settings

## Acceptance Criteria

- No private UI flashes before auth state is resolved.
- Sidebar works on desktop and mobile.
- Active route states are correct.
- Layout supports dense tables and right-rail dashboard modules.
- App shell does not contain hardcoded demo finance data.

## Dependencies

- Task 01 auth contract.
- Task 02 design system.

