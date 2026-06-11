# Prisma Migrations

This project uses committed Prisma SQL migrations as the only production schema source of truth.

## Local Development

Update the Prisma client after pulling schema or migration changes:

```bash
npm run prisma:generate
```

Create a new migration while developing a schema change:

```bash
npm run prisma:migrate:dev -- --name describe_change
```

Do not use `prisma db push` for production or shared environments.

## Fresh Database Verification

To prove a clean database can be created from committed migrations only:

```bash
docker compose down -v
docker compose up --build
curl http://localhost:5001/health
curl http://localhost:5001/ready
```

The API container runs `npx prisma migrate deploy` before `npm run start`, so a successful boot confirms that the database schema can be created from migrations.

## CI Behavior

GitHub Actions provisions a fresh PostgreSQL service and runs:

```bash
npx prisma migrate deploy
npm run ci:verify
```

This verifies that:

- committed migrations apply cleanly to an empty database
- Prisma schema validation still passes
- TypeScript build and tests still pass after migration application

## Production Rule

Production deploys must run:

```bash
npx prisma migrate deploy
```

before the new API version starts serving traffic.
