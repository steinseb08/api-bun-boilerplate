# Rate Limiting and Caching Strategy

## Rate limiting

Current model:
- Global limiter on `/api/v1/*`
- Additional stricter limiter on `/api/v1/auth/*`
- Client key priority:
  1. `x-api-key`
  2. `x-forwarded-for` first IP
  3. `req.ip`

Response headers:
- `x-ratelimit-limit`
- `x-ratelimit-remaining`
- `x-ratelimit-window-sec`
- `retry-after` when blocked

Failure response:
- `429` with Problem Details (`application/problem+json`)

## Limit tuning guidance

- Keep auth lower than global limits
- Keep window small (e.g. 60s) to reduce lockout time
- Raise/lower max based on observed traffic

Recommended starting values:
- `AUTH_RATE_LIMIT_MAX=20`, `AUTH_RATE_LIMIT_WINDOW_SEC=60`
- `GLOBAL_RATE_LIMIT_MAX=300`, `GLOBAL_RATE_LIMIT_WINDOW_SEC=60`

## Caching provider model

`src/provider/cache.ts` supports:
- `noop`: disabled cache
- `memory`: local in-memory cache
- `redis`: shared cache via Bun Redis client

Selection:
- `CACHE_MODE` controls mode
- If mode is `redis`, `REDIS_URL` must be set

## Caching strategy guidance

When adding cached endpoints:
1. Canonicalize key input (round numeric values when relevant)
2. Use explicit TTL per endpoint
3. Never cache auth-sensitive user responses under non-user keys
4. Add `x-cache: HIT|MISS` when useful for debugging

Example key pattern:
- `<feature>:<normalized-params>`
