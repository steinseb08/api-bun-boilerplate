import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import { createRateLimitMiddleware } from "../src/middleware/rate-limit";
import type { CacheProvider } from "../src/provider/cache";

class MemoryCacheStub implements CacheProvider {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe("rate-limit middleware", () => {
  let server: Server;
  let baseUrl = "";

  beforeEach(() => {
    const app = express();
    app.use((_, res, next) => {
      res.locals.requestId = "req-rate-limit";
      next();
    });
    app.use(
      createRateLimitMiddleware({
        cache: new MemoryCacheStub(),
        max: 1,
        windowSec: 60,
        keyPrefix: "rl:test",
      }),
    );
    app.get("/limited", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    server.close();
  });

  test("returns 429 and retry-after when limit exceeded", async () => {
    const first = await fetch(`${baseUrl}/limited`, {
      headers: { "x-api-key": "same-client" },
    });
    expect(first.status).toBe(200);

    const second = await fetch(`${baseUrl}/limited`, {
      headers: { "x-api-key": "same-client" },
    });
    const body = (await second.json()) as Record<string, unknown>;

    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("60");
    expect(second.headers.get("content-type")?.startsWith("application/problem+json")).toBe(true);
    expect(body.title).toBe("Too Many Requests");
  });
});

