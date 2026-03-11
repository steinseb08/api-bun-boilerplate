# API (Bun + Express + Zod + Postgres)

Enkel API-struktur med fokus på Problem Details-standard for feil:
- `src/provider/config.ts`
- `src/provider/db.ts`
- `src/provider/cache.ts` (stubber / interfaces)
- `src/repo/*.ts`
- `src/request/*.ts` (validering/sanitering)
- `src/routes/*.ts`
- `src/utils/*.ts`
- `src/app.ts` (Express-oppsett)
- `src/index.ts` (server bootstrap)
- `src/migrations/*.sql`
- `src/migrations/migrate.ts`

## Kjøring

```bash
bun install
docker compose up -d
cp .env.example .env
bun run migrate
bun run dev
```

## Endepunkter

- `GET /healthz`
- `GET /api/v1/users?limit=20&offset=0`
- `GET /api/v1/users/:id`
- `POST /api/v1/users`

## Feilformat

Alle API-feil returneres som `application/problem+json` (Problem Details).
