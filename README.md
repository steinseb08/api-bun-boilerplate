# API Bun Express Boilerplate

Production-oriented API boilerplate using Bun runtime, framework-pluggable app composition (Express/Elysia), Zod validation, Bun SQL for Postgres, and RFC 9457-style Problem Details.

## What this gives you

- Strict, typed environment validation at startup
- Consistent error model with `application/problem+json`
- Object-oriented repositories with dependency injection
- Session-based auth baseline (opaque bearer token, token hash in DB)
- Global + auth-focused rate limiting middleware
- Cache provider abstraction (`noop`, `memory`, `redis`)
- Security headers + JSON content-type enforcement for write endpoints
- Cursor + offset pagination support for users list endpoint
- SQL-first migration flow
- Documentation and templates for fast feature delivery

## Architecture overview

Code is organized by responsibility:

- `src/provider/*`:
  - `config.ts`: env parsing/validation
  - `db.ts`: Bun SQL client
  - `http.ts`: outbound HTTP client abstraction
  - `cache.ts`: cache abstraction and implementations
  - `logger.ts`: structured logging
- `src/request/*`: Zod schemas for request parsing/normalization
- `src/repo/*`: data/integration layer (`I*Repo` + `class *Repo`)
- `src/routes/*`: route handlers/factories for framework integrations
- `src/middleware/*`: auth, rate limit, request logging
- `src/utils/*`: Problem Details + reusable helpers
- `src/migrations/*`: SQL migration files + migration runner
- `src/app.express.ts` and `src/app.elysia.ts`: framework-specific app wiring

## API endpoints

- `GET /healthz` (liveness)
- `GET /healthz/readyz` (readiness)
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout` (Bearer)
- `GET /api/v1/users?limit=20&offset=0` (Bearer)
- `GET /api/v1/users?limit=20&cursor=<token>` (Bearer)
- `GET /api/v1/users/:id` (Bearer)
- `POST /api/v1/users` (Bearer)
- `GET /api/v1/example` (feature template route)

## Quick start (local)

### 1) Install dependencies

```bash
bun install
```

### 2) Start dependencies

```bash
docker compose up -d
```

### 3) Configure environment

```bash
cp .env.example .env
```

### 4) Run migrations

```bash
bun run migrate
```

### 5) Start API

```bash
bun run dev
```

Choose framework explicitly:

```bash
bun run start:express
bun run start:elysia
```

## Docker hardened image (DHI)

### Build

```bash
docker login dhi.io
docker build -f Dockerfile.dhi -t api-bun-express:dhi .
```

### Build with private npm token

```bash
docker build -f Dockerfile.dhi -t api-bun-express:dhi \
  --secret id=NPM_TOKEN,env=NPM_TOKEN .
```

### Run

```bash
docker run --rm -p 3000:3000 \
  -e NODE_ENV=production \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e DATABASE_URL='postgres://app:app@host.docker.internal:5432/app' \
  -e CACHE_MODE=redis \
  -e REDIS_URL='redis://host.docker.internal:6379' \
  api-bun-express:dhi
```

## Error handling standard (RFC 9457 style)

All errors should return `application/problem+json` with:

- `type`
- `title`
- `status`
- `detail`
- `instance`

Project helper: `src/utils/problem.ts`.

## SQL safety rule

- Runtime SQL must be parameterized with Bun tagged templates.
- No string-concatenated SQL.
- `unsafe()` is only allowed for trusted migration file execution.

## Env highlights

See `.env.example` for full list.

Common keys:

- `NODE_ENV`, `APP_FRAMEWORK`, `HOST`, `PORT`
- `TRUST_PROXY`
- `DATABASE_URL`
- `CACHE_MODE`, `REDIS_URL`
- `SESSION_TTL_SECONDS`
- `AUTH_RATE_LIMIT_*`, `GLOBAL_RATE_LIMIT_*`

## Testing and quality gates

Run these before commit/PR:

```bash
bun run typecheck
bun run test:coverage
bun run migrate:smoke
```

Or combined:

```bash
bun run ci:check
```

Contract tests only:

```bash
bun run test:contract
```

## Feature development workflow

1. Define request schemas in `src/request/<feature>.ts`
2. Implement repo in `src/repo/<feature>.ts`
3. Implement router in `src/routes/<feature>.ts`
4. Mount route in `src/app.ts`
5. Add tests in `test/*`

Use starter templates:

- `src/request/example.ts`
- `src/repo/example.ts`
- `src/routes/example.ts`

## Documentation map

- `docs/INDEX.md`
- `docs/IMPLEMENTATION_GUIDE.md`
- `docs/FEATURE_TEMPLATE.md`
- `openapi.json`
- `docs/SECURITY.md`
- `docs/RATE_LIMITING_AND_CACHING.md`
- `docs/TEST_BASELINE.md`
- `docs/OBSERVABILITY.md`
- `docs/DATA_API_QUALITY.md`
- `docs/OPERATIONS.md`
- `docs/API_VERSIONING.md`
- `docs/PAGINATION.md`
