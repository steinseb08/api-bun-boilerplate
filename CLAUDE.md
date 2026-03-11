# CLAUDE.md

Concise contributor/agent rules for this API boilerplate.

## Stack

- Runtime/tooling: Bun
- HTTP server: Express
- Validation: Zod
- Database: Postgres via Bun SQL
- Cache: in-memory or Redis via provider abstraction

## Conventions

1. Use strict env from `src/provider/config.ts`.
2. Keep features split across:
   - `src/request/<feature>.ts`
   - `src/repo/<feature>.ts`
   - `src/routes/<feature>.ts`
3. Build repos as OO + DI (`I*Repo` + `class *Repo`).
4. Keep routes thin and focused on HTTP mapping.
5. Return Problem Details for errors.

## SQL and security

- Parameterize all runtime SQL with tagged templates.
- Never concatenate user input into SQL.
- `unsafe()` only for trusted migration file execution.
- Do not log secrets or credentials.

## Quality gates

Run before opening PR:

```bash
bun run ci:check
bun run migrate:smoke
```

## Documentation entrypoints

- `README.md`
- `docs/INDEX.md`
