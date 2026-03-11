# Observability Baseline

## Logging

Structured logging is enabled through `src/provider/logger.ts` and request middleware.

Required fields for request lifecycle logs:
- `requestId`
- `method`
- `path`
- `route` (best-effort route pattern)
- `statusCode`
- `durationMs`

Do not log:
- passwords
- bearer tokens
- secret env values

## Correlation

Request correlation uses `x-request-id`.
- Incoming `x-request-id` is reused when present
- Otherwise a UUID is generated
- Returned in response header for all responses

## Minimum operational dashboards

1. Request rate by route and status code
2. Error rate (4xx/5xx split)
3. p95 latency from log aggregation
4. Auth failure count (`401` / `429` trends)
