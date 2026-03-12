import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Server } from "node:http";
import { attachDefaultErrorHandlers, createExpressApp } from "../src/provider/express";
import type { Logger } from "../src/provider/logger";

function createLoggerStub(): Logger {
  const logger: Logger = {
    child: mock(() => logger),
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };

  return logger;
}

describe("provider/express error handlers", () => {
  let server: Server;
  let baseUrl = "";

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  test("maps entity too large to 413 problem", async () => {
    const logger = createLoggerStub();
    const app = createExpressApp({ bodyLimitBytes: 1024 * 1024, trustProxy: false }, logger);
    app.get("/boom", () => {
      throw { type: "entity.too.large", message: "too large" };
    });
    attachDefaultErrorHandlers(app, { logger, isProduction: true });

    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/boom`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(413);
    expect(body.detail).toBe("Request body exceeds max size");
  });

  test("maps bad json parser status to 400 problem", async () => {
    const logger = createLoggerStub();
    const app = createExpressApp({ bodyLimitBytes: 1024 * 1024, trustProxy: false }, logger);
    app.get("/boom", () => {
      throw { status: 400, message: "bad json" };
    });
    attachDefaultErrorHandlers(app, { logger, isProduction: true });

    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/boom`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.detail).toBe("Invalid JSON payload");
  });

  test("uses detailed 500 message in non-production", async () => {
    const logger = createLoggerStub();
    const app = createExpressApp({ bodyLimitBytes: 1024 * 1024, trustProxy: false }, logger);
    app.get("/boom", () => {
      throw new Error("explode");
    });
    attachDefaultErrorHandlers(app, { logger, isProduction: false });

    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const response = await fetch(`${baseUrl}/boom`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(String(body.detail)).toContain("explode");
    expect(logger.error).toHaveBeenCalled();
  });
});
