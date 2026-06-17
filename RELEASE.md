# FinTrack API Release Checklist

## Required Checks

- Run `npm run prisma:generate`.
- Run `npx prisma validate`.
- Run `npm run build`.
- Run `npm test`.
- Run `npm audit --audit-level=high`.

## Environment

- `DATABASE_URL`, `REDIS_URL`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, and `FRONTEND_URL` must be set.
- `FRONTEND_URL` must match the deployed web origin so credentialed CORS works.
- In production, refresh cookies are sent with `Secure`, `HttpOnly`, `SameSite=Lax`, and path `/`.

## Migration Deployment

- Back up the database before applying migrations.
- Run `npx prisma migrate deploy` before starting the new API version.
- Current committed migrations include notification preferences (`202606160001_user_notification_preferences`) and in-app notification history (`202606170001_notifications`).

## Rollback

- Prefer forward fixes for schema changes once migrations are applied.
- If rollback is unavoidable, restore from backup or apply a reviewed reverse migration.
- Roll back web and API together when auth response shapes or cookie behavior changes.

## Operations

- `/health` verifies process liveness.
- `/ready` verifies PostgreSQL and Redis readiness.
- Preserve structured request logs and request IDs for incident debugging.
- Add production error tracking, metrics, backup automation, and restore drills before public launch.
