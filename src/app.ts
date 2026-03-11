import express from "express";
import { createAuthMiddleware } from "./middleware/auth";
import { createRateLimitMiddleware } from "./middleware/rate-limit";
import { createRequestLoggingMiddleware } from "./middleware/request-logging";
import { createJsonContentTypeMiddleware, createSecurityHeadersMiddleware } from "./middleware/security";
import { cache } from "./provider/cache";
import { env } from "./provider/config";
import { db } from "./provider/db";
import { logger } from "./provider/logger";
import { authRepo } from "./repo/auth";
import { authRouter } from "./routes/auth";
import { exampleRouter } from "./routes/example";
import { createHealthRouter } from "./routes/health";
import { usersRouter } from "./routes/users";
import { sendProblem } from "./utils/problem";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);

app.use(createRequestLoggingMiddleware(logger));
app.use(createSecurityHeadersMiddleware());
app.use(createJsonContentTypeMiddleware());
app.use(express.json({ limit: env.BODY_LIMIT_BYTES }));

const globalRateLimiter = createRateLimitMiddleware({
  cache,
  max: env.GLOBAL_RATE_LIMIT_MAX,
  windowSec: env.GLOBAL_RATE_LIMIT_WINDOW_SEC,
  keyPrefix: "rl:global",
});

const authRateLimiter = createRateLimitMiddleware({
  cache,
  max: env.AUTH_RATE_LIMIT_MAX,
  windowSec: env.AUTH_RATE_LIMIT_WINDOW_SEC,
  keyPrefix: "rl:auth",
});

const healthRouter = createHealthRouter({
  pingDb: async () => {
    await db`SELECT 1`;
  },
  pingCache: env.READINESS_CHECK_CACHE
    ? async () => {
        const key = `health:cache:${crypto.randomUUID()}`;
        await cache.set(key, "ok", 5);
        const value = await cache.get(key);
        await cache.del(key);
        if (value !== "ok") throw new Error("Cache read/write check failed");
      }
    : undefined,
});

app.use("/healthz", healthRouter);
app.use("/api/v1", globalRateLimiter);
app.use("/api/v1/auth", authRateLimiter, authRouter);
app.use("/api/v1/users", createAuthMiddleware({ repo: authRepo }), usersRouter);
app.use("/api/v1/example", exampleRouter);

app.use((req, res) => {
  return sendProblem(req, res, {
    status: 404,
    detail: `Route ${req.method} ${req.path} not found`,
    requestId: res.locals.requestId,
  });
});

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const typedError = error as { type?: string; status?: number; stack?: string; message?: string };

  logger.error("request.failed", {
    requestId: res.locals.requestId,
    errorType: typedError.type,
    errorStatus: typedError.status,
    errorMessage: typedError.message ?? String(error),
    stack: env.NODE_ENV === "production" ? undefined : typedError.stack,
  });

  if (typedError.type === "entity.too.large") {
    return sendProblem(req, res, {
      status: 413,
      detail: "Request body exceeds max size",
      requestId: res.locals.requestId,
    });
  }

  if (typedError.status === 400) {
    return sendProblem(req, res, {
      status: 400,
      detail: "Invalid JSON payload",
      requestId: res.locals.requestId,
    });
  }

  return sendProblem(req, res, {
    status: 500,
    detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
    requestId: res.locals.requestId,
  });
});
