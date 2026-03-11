# Feature Template

Use this checklist every time you add a new feature.

## Goal

Each feature must follow the same architecture:
- `request/*`: Zod schemas (validation/sanitization)
- `repo/*`: class + interface, business/integration logic
- `routes/*`: HTTP mapping + Problem Details
- `app.ts`: mount router under `/api/v1/...`

## Step 1: Request contract

Create `src/request/<feature>.ts`.

Requirements:
- Parse all query/path/body fields with Zod
- Use coercion for query numbers
- Normalize user-facing string fields (`trim`, lowercase when needed)

Use as base:
- `src/request/example.ts`

## Step 2: Repo contract (OO + DI)

Create `src/repo/<feature>.ts`.

Requirements:
- Define `I<Feature>Repo`
- Implement `class <Feature>Repo implements I<Feature>Repo`
- Constructor-inject dependencies (`HttpClient`, cache, other repos)
- Keep SQL parameterized through Bun SQL template tags

Use as base:
- `src/repo/example.ts`

## Step 3: Route

Create `src/routes/<feature>.ts`.

Requirements:
- Export `create<Feature>Router(deps)` factory for DI
- Parse request using schemas from `request/*`
- Convert validation errors to `application/problem+json`
- Keep route handlers thin; call repo methods

Use as base:
- `src/routes/example.ts`

## Step 4: Composition root

In `src/app.ts`:
- mount the router with a stable versioned path:
- `app.use("/api/v1/<feature>", <feature>Router)`

## Step 5: Tests

Minimum required before merge:
- request schema tests for valid/invalid inputs
- route-level unhappy path behavior (Problem Details)

## Route acceptance criteria

A new route is accepted only if:
1. Request parsing is schema-driven (no ad-hoc parsing)
2. Errors use Problem Details consistently
3. Route contains no inline SQL or raw external HTTP calls
4. Response shape is explicit and stable
