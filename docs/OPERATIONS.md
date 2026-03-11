# Operations Runbook

## Startup sequence

1. Ensure Postgres and Redis/Valkey availability
2. Start API process/container
3. Verify:
- `GET /healthz` returns 200
- `GET /healthz/readyz` returns 200

## Health model

- `/healthz`: process liveness
- `/healthz/readyz`: dependency readiness (DB, optional cache)

## Common incidents

### High 429 (rate limited)

Checks:
- inspect request traffic spikes by `path` and `ip`
- verify `AUTH_RATE_LIMIT_*` and `GLOBAL_RATE_LIMIT_*` env values

Actions:
- temporarily increase limits for affected routes if safe
- investigate abusive clients and add upstream protections

### Elevated 5xx

Checks:
- review `request.failed` logs with `requestId`
- review DB connectivity and latency
- verify recent migration/deploy changes

Actions:
- rollback recent deploy if regression detected
- scale DB/app resources if saturation is observed

### Readiness failing

Checks:
- DB availability (`DATABASE_URL` correctness)
- cache availability when readiness cache check is enabled

Actions:
- disable cache readiness check temporarily (`READINESS_CHECK_CACHE=false`) if cache is optional
- restore dependency and redeploy/restart

## Safe deploy checklist

1. `bun run ci:check`
2. `bun run migrate:smoke`
3. apply migrations in target environment
4. deploy application
5. verify health and smoke test key endpoints

## Recovery checklist

1. capture failing request IDs
2. inspect logs and dependency status
3. rollback if needed
4. confirm health endpoints are green
5. communicate incident summary and follow-up actions
