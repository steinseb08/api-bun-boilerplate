# syntax=docker/dockerfile:1.7

# ========================================
# Bun API with Docker Hardened Images (DHI)
# ========================================
#
# REQUIRES: docker login dhi.io
#
# Build locally:
#   docker build -f Dockerfile.dhi -t api-bun-express:dhi .
#
# Build with optional private npm token:
#   docker build -f Dockerfile.dhi -t api-bun-express:dhi \
#     --secret id=NPM_TOKEN,env=NPM_TOKEN .
#
# ========================================

ARG BUN_VERSION=1.3.10-alpine3.22

# Base stage for dependency installation and validation.
FROM dhi.io/bun:${BUN_VERSION}-dev AS base
WORKDIR /app

# ========================================
# Dependencies (production-only)
# ========================================
FROM base AS deps

COPY package.json bun.lock ./

RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    --mount=type=secret,id=NPM_TOKEN,required=false \
    sh -eux -c '\
      if [ -f /run/secrets/NPM_TOKEN ]; then export NPM_TOKEN="$(cat /run/secrets/NPM_TOKEN)"; fi; \
      bun install --frozen-lockfile --production \
    '

# ========================================
# Build/verify (full deps + source checks)
# ========================================
FROM base AS build

COPY package.json bun.lock ./

RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    --mount=type=secret,id=NPM_TOKEN,required=false \
    sh -eux -c '\
      if [ -f /run/secrets/NPM_TOKEN ]; then export NPM_TOKEN="$(cat /run/secrets/NPM_TOKEN)"; fi; \
      bun install --frozen-lockfile \
    '

COPY tsconfig.json ./
COPY src ./src

RUN bun run typecheck

# ========================================
# Runtime (minimal DHI image)
# ========================================
FROM dhi.io/bun:${BUN_VERSION} AS production

WORKDIR /app

ENV NODE_ENV=production \
    LOG_LEVEL=info \
    PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=build /app/src ./src

# DHI images are non-root by default; keep explicit for clarity.
USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "start"]
