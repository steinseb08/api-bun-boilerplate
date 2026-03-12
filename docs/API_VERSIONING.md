# API Versioning

## Current version

- Active API version: `v1`
- All public routes are versioned under `/api/v1/...`

## Rules

1. Backward-compatible changes in `v1`
- Adding optional response fields is allowed.
- Adding new endpoints under `/api/v1/...` is allowed.

2. Breaking changes require new version
- Renaming/removing fields
- Changing field types
- Changing required request fields

These must ship under a new prefix such as `/api/v2/...`.

## Deprecation policy

When introducing a new version:
1. Keep previous version running during migration window.
2. Mark deprecated endpoints in docs/OpenAPI.
3. Announce timeline for retirement.

## OpenAPI

- `openapi.json` describes the currently supported public contract.
- Any request/response contract change must update `openapi.json`.
