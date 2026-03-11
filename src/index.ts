import { app } from "./app";
import { env } from "./provider/config";
import { db } from "./provider/db";

const server = app.listen(env.PORT, env.HOST, () => {
  console.log(`API listening on http://${env.HOST}:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down...`);
  server.close();

  if ("close" in db && typeof db.close === "function") {
    await db.close();
  }

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
