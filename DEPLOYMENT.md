# Production Deployment

## Runtime Requirements

- Node.js 20
- PostgreSQL
- Redis
- SMTP provider credentials

## Required Commands

Build and verify:

```bash
npm ci
npm run ci:verify
```

Deploy database migrations:

```bash
npx prisma migrate deploy
```

Start the API:

```bash
npm run start
```

Docker Compose runs migrations before startup. It does not seed data on every boot.

## Environment

Use `.env.example` as the variable checklist. Production must set:

- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASS`
- `FRONTEND_URL`

Set `TRUST_PROXY=true` only when the API is behind a trusted load balancer or platform proxy.

Set `ENABLE_CRON=true` for exactly one API worker/process that should run recurring jobs.

## Health Checks

- `/health`: liveness, no dependency checks.
- `/ready`: readiness, checks PostgreSQL and Redis.

Use `/health` for container liveness and `/ready` for traffic readiness.

## Shutdown

The server handles `SIGTERM` and `SIGINT`, closes Fastify, stops cron tasks, disconnects Prisma, and quits Redis.

## Rollback

- Deployments should run `prisma migrate deploy` before the new API starts.
- Prisma migrations should be backward-compatible across one deployment whenever possible.
- If rollback is needed, roll back application code first and handle database rollback manually only after checking migration impact.
