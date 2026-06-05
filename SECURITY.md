# Security Baseline

## Current Gates

CI runs the production-readiness checks for every pull request:

- `npm ci`
- `npm run prisma:generate`
- `npx prisma validate`
- `npm run build`
- `npm test`
- `npm audit --audit-level=high`

The dependency audit must stay at zero high-or-critical vulnerabilities unless a temporary exception is documented in this file with an owner and removal date.

## Secrets

- Do not commit real secrets to source control.
- Use `.env.example` only for variable names and obvious placeholders.
- Docker Compose reads credentials from `.env` and fails fast when required values are missing.
- Access-token and refresh-token secrets must be different high-entropy values.
- SMTP credentials must come from the environment or deployment secret store.

## Dependency Policy

- Prefer non-breaking security updates first.
- If a vulnerability requires a major upgrade, upgrade the affected package family together and run the full CI suite.
- Keep `package-lock.json` committed so CI and deployments resolve the same dependency graph.

## Remaining Security Work

- Move refresh tokens to httpOnly cookies or a backend-for-frontend session model when the new frontend is built.
- Add secret scanning in the repository host.
- Add dependency update automation.
- Add isolated database integration tests for money-moving workflows.
- Add route-level tests for authorization failures and centralized error responses.
