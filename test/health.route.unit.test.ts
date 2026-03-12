import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import { createHealthRouter } from "../src/routes/health";

describe("health routes", () => {
  let server: Server;
  let baseUrl = "";

  beforeEach(() => {
    const app = express();
    app.use(
      "/healthz",
      createHealthRouter({
        pingDb: async () => {},
      }),
    );
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    server.close();
  });

  test("liveness returns ok", async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
  });

  test("readiness returns 503 when db is down", async () => {
    server.close();
    const app = express();
    app.use(
      "/healthz",
      createHealthRouter({
        pingDb: async () => {
          throw new Error("db down");
        },
      }),
    );
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/healthz/readyz`);
    const body = (await response.json()) as { services: { db: string; cache: string } };

    expect(response.status).toBe(503);
    expect(body.services.db).toBe("down");
    expect(body.services.cache).toBe("skipped");
  });

  test("readiness returns 503 when cache check fails", async () => {
    server.close();
    const app = express();
    app.use(
      "/healthz",
      createHealthRouter({
        pingDb: async () => {},
        pingCache: async () => {
          throw new Error("cache down");
        },
      }),
    );
    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/healthz/readyz`);
    const body = (await response.json()) as { services: { db: string; cache: string } };

    expect(response.status).toBe(503);
    expect(body.services.db).toBe("ok");
    expect(body.services.cache).toBe("down");
  });
});

