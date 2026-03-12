# Real API Benchmark Plan

Goal: benchmark framework/runtime impact on the **actual API behavior**, not only synthetic micro endpoints.

## Preconditions

1. Run dependencies:
```bash
docker compose up -d
```

2. Start API locally.

Recommended for benchmark runs:
- Set `CACHE_MODE=noop` to effectively disable in-memory rate-limit state.
- Keep the same env/config for both frameworks under comparison.

3. Ensure DB schema is migrated.

## Benchmarked endpoints

Current script benchmarks:
- `GET /healthz`
- `GET /api/v1/users?limit=20&offset=0` (authenticated)
- `GET /api/v1/users?limit=20&cursor=<token>` (authenticated, optional follow-up benchmark)
- `POST /api/v1/users` (authenticated)

Auth setup in script:
- registers benchmark user (`201` or `409` accepted)
- logs in and extracts bearer token

## Run

```bash
bun run bench:real
```

Optional tuning:

```bash
BENCH_BASE_URL=http://127.0.0.1:3000 \
BENCH_CONNECTIONS=50 \
BENCH_DURATION_SEC=30 \
BENCH_PIPELINING=1 \
bun run bench:real
```

## Comparison method (Express vs Elysia)

For each framework version:
1. Start the API with the same env and DB.
2. Run benchmark 3 times.
3. Record median values for:
- req/sec
- latency p50/p95/p99
- error rate

## Decision criteria

Only consider migration if improvements are meaningful on real endpoints and not offset by higher complexity.

Suggested threshold:
- >= 20% p95 latency improvement on key endpoints
- no regression in error contract, logging, security behavior
