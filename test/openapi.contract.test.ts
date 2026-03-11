import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import { app } from "../src/app";

let server: Server;
let baseUrl = "";

beforeAll(() => {
  server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

describe("OpenAPI contract", () => {
  test("spec includes required public paths", async () => {
    const raw = await Bun.file("openapi.json").text();
    const spec = JSON.parse(raw) as { paths?: Record<string, unknown> };

    expect(spec.paths).toBeDefined();
    const paths = Object.keys(spec.paths ?? {});

    expect(paths.includes("/healthz")).toBe(true);
    expect(paths.includes("/healthz/readyz")).toBe(true);
    expect(paths.includes("/api/v1/auth/register")).toBe(true);
    expect(paths.includes("/api/v1/auth/login")).toBe(true);
    expect(paths.includes("/api/v1/users")).toBe(true);
  });

  test("unknown route returns Problem Details with expected content-type", async () => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")?.startsWith("application/problem+json")).toBe(true);
    expect(typeof body.type).toBe("string");
    expect(body.title).toBe("Not Found");
    expect(body.instance).toBe("GET /does-not-exist");
  });

  test("write endpoint enforces application/json content type", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not-json",
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(415);
    expect(response.headers.get("content-type")?.startsWith("application/problem+json")).toBe(true);
    expect(body.title).toBe("Unsupported Media Type");
  });

  test("validation failure returns 422 Problem Details", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid", password: "x" }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")?.startsWith("application/problem+json")).toBe(true);
    expect(body.title).toBe("Unprocessable Entity");
    expect(body.errors).toBeDefined();
  });

});
