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

## Current commands

- Run all tests:
```bash
bun test
```

- Run with coverage:
```bash
bun run test:coverage
```

- Run contract tests only:
```bash
bun run test:contract
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
