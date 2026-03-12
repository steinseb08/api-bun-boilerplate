# Security Baseline

## Authentication and sessions

- Passwords are never stored in plaintext
- Session model uses opaque bearer token
- Only token hash is stored in DB (`user_sessions.token_hash`)
- Auth middleware resolves active, non-expired, non-revoked sessions

## Input validation

- All request inputs are validated via Zod schemas in `src/request/*`
- Validation failures return Problem Details with status `400` or `422`
- Write endpoints enforce `Content-Type: application/json` and return `415` otherwise

## Error handling standard

- API errors return `application/problem+json`
- Response uses RFC 9457 style fields:
  - `type`, `title`, `status`, `detail`, `instance`
- Include request correlation fields when available (`requestId`)

## Logging baseline

- Use structured logging from `src/provider/logger.ts`
- Include `requestId` on request and error events
- Never log secrets, raw bearer tokens, or passwords

## Transport and header hardening

- `x-powered-by` is disabled
- Security headers are set globally (nosniff, frame deny, strict referrer policy)
- `TRUST_PROXY` must be explicitly configured for reverse-proxy deployments

## Security checks for new features

1. Auth-required routes must use `createAuthMiddleware`
2. Ownership must be derived from auth context, never client-supplied user id
3. External HTTP failures must be mapped to safe API errors (no internal leakage)
4. DB writes must be parameterized; no string-concatenated SQL
5. Dependency audit (`bun audit`) must pass in CI

## SQL safety

Use parameterized SQL with placeholders for **all runtime values**.

Allowed (parameterized):

```ts
await appDb.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
await appDb.exec("INSERT INTO users (email, full_name) VALUES (?, ?)", [email, fullName]);
```

Forbidden (string-concatenated SQL):

```ts
await appDb.query(`SELECT id FROM users WHERE email = '${email}'`);
const sql = "INSERT INTO users (email) VALUES ('" + email + "')";
await appDb.exec(sql);
```

Guardrail for `unsafe()`:
- `unsafe()` is allowed only for trusted static SQL files in migration execution.
- `unsafe()` must never receive request data, headers, query params, or other untrusted input.
- Runtime API queries must always use parameterized placeholders.

## Dependency hardening

- Dependabot is enabled for dependency/security update PRs.
- `bunfig.toml` sets `minimumReleaseAge = 604800` (7 days) to reduce supply-chain risk from freshly published versions.
