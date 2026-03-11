# AGENTS.md

Project-specific guidance for coding agents in this repository.

## Runtime and tooling

- Use Bun commands (`bun install`, `bun run`, `bun test`, `bunx`).
- Bun loads `.env` automatically; do not add dotenv.
- This repository uses **Express** as the HTTP framework.

## Architecture (must follow)

- Object-oriented + DI:
  - Define `I*Repo` interfaces.
  - Implement `class *Repo`.
  - Inject dependencies through constructors.
- Keep separation of concerns:
  - `src/request/*`: Zod schemas for validation/sanitization.
  - `src/repo/*`: DB/HTTP integration and domain data operations.
  - `src/routes/*`: HTTP mapping, no inline SQL or raw external fetch logic.
  - `src/provider/*`: infra composition (`config`, `db`, `http`, `cache`, `logger`).

## Error handling standard

- All API errors must use Problem Details (`application/problem+json`).
- Use `src/utils/problem.ts` helpers for consistency.

## SQL safety (must follow)

- Runtime queries must use Bun SQL tagged templates with placeholders.
- Never build SQL via string concatenation.
- `unsafe()` is only allowed for trusted migration file execution.

## Security baseline

- Never log secrets, bearer tokens, or passwords.
- Protected routes must use auth middleware.
- Ownership checks must come from authenticated context, not user-controlled fields.

## Migrations

- SQL-first migrations in `src/migrations/*.sql`.
- Keep migration files ordered and immutable once shared.
- Development startup may run migrations automatically.

## Required checks before commit

```bash
bun run typecheck
bun run test:coverage
bun run migrate:smoke
```

## Where to find docs

- `README.md` (onboarding)
- `docs/INDEX.md` (documentation map)
- `docs/FEATURE_TEMPLATE.md` (new feature flow)
- `docs/SECURITY.md` (security rules)
- `docs/RATE_LIMITING_AND_CACHING.md` (operational strategy)
- `docs/TEST_BASELINE.md` (test expectations)
