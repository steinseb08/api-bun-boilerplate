# Pagination

The users list endpoint supports two modes:

- Offset mode: `GET /api/v1/users?limit=20&offset=0`
- Cursor mode: `GET /api/v1/users?limit=20&cursor=<token>`

`offset` and `cursor` are mutually exclusive.

## Offset mode

Request:
- `limit` (1-100)
- `offset` (>= 0)

Response meta:
- `mode: "offset"`
- `limit`
- `offset`
- `count`

Use for simple admin/internal use cases.

## Cursor mode

Request:
- `limit` (1-100)
- `cursor` (opaque base64url token)

Response meta:
- `mode: "cursor"`
- `limit`
- `count`
- `nextCursor` (string or `null`)

Cursor mode is preferred for high-volume pagination because it avoids expensive large offsets.

## Ordering guarantee

Users are ordered by:
1. `created_at DESC`
2. `id DESC`

The cursor is based on `(created_at, id)`.
