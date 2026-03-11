# Data and API Quality

## API response consistency

- Use stable response envelopes:
  - `{ data: ... }` for entity responses
  - `{ data: [...], meta: { ... } }` for paginated list responses
- Use Problem Details for all non-2xx responses.

## Pagination rules

Current list pagination uses `limit` + `offset`.

Required behavior:
- validate with Zod (`limit` min/max, `offset` min)
- include meta in list responses:
  - `meta.limit`
  - `meta.offset`
  - `meta.count` (items in current page)

## Input normalization

- Trim and normalize user-controlled strings where relevant
- Lowercase fields that should be case-insensitive (for example email)

## Backward compatibility

For existing endpoints:
- add fields, do not remove or rename existing fields without versioning plan
- avoid changing field types
- keep error contract stable (`application/problem+json`)

## Data integrity

- Prefer DB constraints (unique/check/fk) for invariant enforcement
- Handle constraint violations by mapping to explicit API errors (for example `409`)
