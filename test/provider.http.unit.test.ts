import { afterEach, describe, expect, mock, test } from "bun:test";
import { FetchHttpClient, HttpRequestError } from "../src/provider/http";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("FetchHttpClient", () => {
  test("returns parsed json on success", async () => {
    globalThis.fetch = mock(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    ) as typeof fetch;

    const client = new FetchHttpClient();
    const result = await client.getJson<{ ok: boolean }>("https://example.com");

    expect(result.ok).toBe(true);
  });

  test("throws HttpRequestError with status on non-ok response", async () => {
    globalThis.fetch = mock(async () =>
      new Response("bad", {
        status: 503,
      })
    ) as typeof fetch;

    const client = new FetchHttpClient();

    await expect(client.getJson("https://example.com")).rejects.toMatchObject({
      statusCode: 503,
      isTimeout: false,
    } satisfies Partial<HttpRequestError>);
  });

  test("maps timeout errors to isTimeout=true", async () => {
    globalThis.fetch = mock(async () => {
      const error = new Error("timeout");
      (error as { name?: string }).name = "TimeoutError";
      throw error;
    }) as typeof fetch;

    const client = new FetchHttpClient();

    await expect(client.getJson("https://example.com", { timeoutMs: 10 })).rejects.toMatchObject({
      isTimeout: true,
    } satisfies Partial<HttpRequestError>);
  });

  test("maps generic failures to HttpRequestError", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("network down");
    }) as typeof fetch;

    const client = new FetchHttpClient();

    await expect(client.getJson("https://example.com")).rejects.toMatchObject({
      message: "network down",
      isTimeout: false,
    } satisfies Partial<HttpRequestError>);
  });
});

