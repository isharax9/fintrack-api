# Task 05: Transactions And Accounts

Goal: build the core ledger and account management experience.

## Transactions Scope

- Detailed ledger table.
- Search.
- Filters: date, type, category, account, tag.
- Pagination.
- Create/edit/delete.
- Export current view.
- Bulk selection later if useful.

## Accounts Scope

- Account list.
- Account detail.
- Create/edit account.
- Transfer between accounts.
- Account transaction history.
- Balance correction workflow.

## Acceptance Criteria

- All money-changing operations use API responses, not local-only mutation.
- Cross-user data never appears.
- Account balances stay consistent after transaction and transfer actions.
- Ledger has professional table density and strong scanability.

## Dependencies

- Task 01 API maturity.
- Task 04 quick add patterns.

