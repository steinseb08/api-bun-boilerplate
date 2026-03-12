import type { Server as HttpServer } from "node:http";
import { appExpress } from "./app.express";
import { appElysia } from "./app.elysia";
import { runMigrations } from "./migrations/migrate";
import { cache } from "./provider/cache";
import { env } from "./provider/config";
import { db } from "./provider/db";
import { logger } from "./provider/logger";

if (env.NODE_ENV === "development") {
  try {
    await runMigrations();
  } catch (error) {
    logger.error("server.migrations.failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

const framework = env.APP_FRAMEWORK;
let expressServer: HttpServer | null = null;
let elysiaServer: { stop?: () => void } | null = null;

if (framework === "elysia") {
  elysiaServer = appElysia.listen(
    { port: env.PORT, hostname: env.HOST },
    () => {
      logger.info("server.started", {
        framework,
        host: env.HOST,
        port: env.PORT,
      });
    },
  );
} else {
  expressServer = appExpress.listen(env.PORT, env.HOST, () => {
    logger.info("server.started", {
      framework,
      host: env.HOST,
      port: env.PORT,
    });
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info("server.shutdown", { signal });
  if (expressServer) {
    expressServer.close();
  }

  if (elysiaServer?.stop) {
    elysiaServer.stop();
  }

  if ("close" in db && typeof db.close === "function") {
    await db.close();
  }

  if (cache.close) {
    await cache.close();
  }

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
