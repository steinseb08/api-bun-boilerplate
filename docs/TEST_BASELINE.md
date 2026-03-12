# Test Baseline

## Required test categories

1. Request schema tests
- validate accepted and rejected payloads
- verify normalization (trim/lowercase/coercion)

2. Problem Details behavior
- verify defaults and explicit overrides
- verify extension members are preserved

3. Route behavior tests (minimum for new modules)
- happy path
- invalid input path
- auth failure path for protected routes

4. Contract tests
- OpenAPI spec path coverage checks
- Problem Details/content-type checks on critical failure paths

5. Integration + E2E tests
- run with SQLite in-memory in test/CI
- cover auth/session flow, protected endpoints, pagination traversal, and filter/sort behavior

## Current commands

- Run all tests:
```bash
NODE_ENV=test DB_DRIVER=sqlite bun test --preload ./test/setup.ts
```

- Run suite by type:
```bash
bun run test:unit
bun run test:integration
bun run test:e2e
```

- Run with coverage:
```bash
NODE_ENV=test DB_DRIVER=sqlite bun test --coverage --preload ./test/setup.ts
```

- Run coverage gate (CI style):
```bash
bun run test:coverage:gate
```

Coverage policy:
- global line coverage >= 85% on production-focused files (excluding template/bootstrap-heavy infra files)
- critical files >= 90% lines:
  - `src/routes/auth.ts`
  - `src/routes/health.ts`
  - `src/routes/users.ts`
  - `src/middleware/*`
  - `src/provider/express.ts`
  - `src/utils/problem.ts`

- Run contract tests only:
```bash
NODE_ENV=test DB_DRIVER=sqlite bun test test/openapi.contract.test.ts --preload ./test/setup.ts
```

- CI local check:
```bash
bun run ci:check
```

## Merge gate recommendation

For each feature PR:
1. add/update tests in `test/*`
2. ensure `bun run ci:check` passes
3. ensure migration smoke check passes when schema changed
