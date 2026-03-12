import { createAuthMiddleware } from "./middleware/auth";
import { env } from "./provider/config";
import { attachDefaultErrorHandlers, createExpressApp } from "./provider/express";
import { createAppHealthRouter } from "./provider/health";
import { logger } from "./provider/logger";
import { createAuthRateLimiter, createGlobalRateLimiter } from "./provider/rate-limit";
import { authRepo } from "./repo/auth";
import { authRouter } from "./routes/auth";
import { exampleRouter } from "./routes/example";
import { usersRouter } from "./routes/users";

export const appExpress = createExpressApp(
  {
    bodyLimitBytes: env.BODY_LIMIT_BYTES,
    trustProxy: env.TRUST_PROXY,
  },
  logger,
);

const globalRateLimiter = createGlobalRateLimiter();
const authRateLimiter = createAuthRateLimiter();
const healthRouter = createAppHealthRouter();

appExpress.use("/healthz", healthRouter);
appExpress.use("/api/v1", globalRateLimiter);
appExpress.use("/api/v1/auth", authRateLimiter, authRouter);
appExpress.use("/api/v1/users", createAuthMiddleware({ repo: authRepo }), usersRouter);
appExpress.use("/api/v1/example", exampleRouter);

attachDefaultErrorHandlers(appExpress, {
  logger,
  isProduction: env.NODE_ENV === "production",
});
