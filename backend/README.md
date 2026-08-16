# DuriSense API

FastAPI service for Phase 1B identity, account activation, server-managed sessions,
RBAC, and tenant isolation.

## Run with Docker

```powershell
Copy-Item .env.example .env
docker compose up --build api db
```

The API is available at `http://127.0.0.1:8000`, with OpenAPI at `/docs`.
Migrations run automatically before the API starts.

For local development, encrypted email messages are delivered from `email_outbox`
to Mailpit at `http://127.0.0.1:8025`. The worker retries transient delivery failures.
One-time tokens are included in API responses only when
`DURISENSE_EXPOSE_DEV_TOKENS=true`; this must remain false in production.

## Test

```powershell
docker compose --profile test run --rm api-test
```

The test profile uses SQLite only as an isolated test database. PostgreSQL is the
runtime database and all production schema changes are managed by Alembic.

## Provision an administrator

```powershell
docker compose exec api python -m app.cli create-admin --email admin@example.ac.th --name "DuriSense Administrator"
```

The command prompts for a password and prints the TOTP secret and recovery codes once.
