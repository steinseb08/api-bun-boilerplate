import { app } from "./app";
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

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info("server.started", {
    host: env.HOST,
    port: env.PORT,
  });
});

async function shutdown(signal: string): Promise<void> {
  logger.info("server.shutdown", { signal });
  server.close();

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
