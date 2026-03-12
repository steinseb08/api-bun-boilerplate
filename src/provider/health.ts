import { cache } from "./cache";
import { env } from "./config";
import { appDb } from "./db";
import { createHealthRouter } from "../routes/health";

export function createAppHealthRouter() {
  return createHealthRouter({
    pingDb: async () => {
      await appDb.ping();
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
}
