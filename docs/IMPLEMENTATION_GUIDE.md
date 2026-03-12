# Implementation Guide

This repository is a Bun API boilerplate with framework-specific app wiring (Express/Elysia) and strict conventions.

## Core rules

1. Object oriented repos
- New repo modules must expose `I*Repo` + `class *Repo`.
- Constructor DI is required for external dependencies.

2. Thin routes
- Routes only do HTTP mapping + request parsing + response mapping.
- SQL and external HTTP logic belongs in repos.

3. Schema-first input handling
- All path/query/body inputs go through Zod schemas in `src/request/*`.

4. Problem Details by default
- All errors must be returned as `application/problem+json`.
5. Keep API contract updated
- Update `openapi.json` when endpoint request/response contracts change.

## Where to start

Use these docs in order:
1. `docs/FEATURE_TEMPLATE.md`
2. `docs/SECURITY.md`
3. `docs/RATE_LIMITING_AND_CACHING.md`
4. `docs/TEST_BASELINE.md`
5. `openapi.json`

## Boilerplate starter files

- `src/request/example.ts`
- `src/repo/example.ts`
- `src/routes/example.ts`

Copy these to bootstrap a new feature and then mount the route in the active app composition file (`src/app.express.ts` or `src/app.elysia.ts`).
