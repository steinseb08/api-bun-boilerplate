import { Elysia } from "elysia";
import { ZodError } from "zod";
import { cache } from "./provider/cache";
import { env } from "./provider/config";
import { db } from "./provider/db";
import { logger } from "./provider/logger";
import { authRepo } from "./repo/auth";
import { exampleRepo } from "./repo/example";
import { usersRepo } from "./repo/users";
import { LoginSchema, RegisterSchema } from "./request/auth";
import { ExampleQuerySchema } from "./request/example";
import { CreateUserSchema, ListUsersQuerySchema, UserIdParamsSchema } from "./request/users";
import { decodeUsersCursor, encodeUsersCursor } from "./utils/pagination";
import { generateOpaqueToken, hashPassword, sha256Hex, verifyPassword } from "./utils/security";
import { zodErrorToFieldMap } from "./utils/validation";

type Problem = {
  status: number;
  title?: string;
  detail?: string;
  type?: string;
  instance?: string;
  requestId?: string;
  errors?: Record<string, string[]>;
};

const RFC_TYPE_BY_STATUS: Record<number, string> = {
  400: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  401: "https://tools.ietf.org/html/rfc9110#section-15.5.2",
  403: "https://tools.ietf.org/html/rfc9110#section-15.5.4",
  404: "https://tools.ietf.org/html/rfc9110#section-15.5.5",
  409: "https://tools.ietf.org/html/rfc9110#section-15.5.10",
  413: "https://tools.ietf.org/html/rfc9110#section-15.5.14",
  415: "https://tools.ietf.org/html/rfc9110#section-15.5.16",
  422: "https://tools.ietf.org/html/rfc9110#section-15.5.21",
  429: "https://tools.ietf.org/html/rfc6585#section-4",
  500: "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  503: "https://tools.ietf.org/html/rfc9110#section-15.6.4",
};

const TITLE_BY_STATUS: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

function buildProblem(req: Request, input: Problem): Response {
  const path = new URL(req.url).pathname;
  const payload = {
    type: input.type ?? RFC_TYPE_BY_STATUS[input.status] ?? "about:blank",
    title: input.title ?? TITLE_BY_STATUS[input.status] ?? "Unknown Error",
    status: input.status,
    detail: input.detail,
    instance: input.instance ?? `${req.method} ${path}`,
    requestId: input.requestId,
    errors: input.errors,
  };

  return new Response(JSON.stringify(payload), {
    status: input.status,
    headers: {
      "content-type": "application/problem+json",
      ...(input.requestId ? { "x-request-id": input.requestId } : {}),
    },
  });
}

function requestId(req: Request): string {
  const header = req.headers.get("x-request-id")?.trim();
  return header && header.length > 0 ? header : crypto.randomUUID();
}

function clientKey(req: Request): string {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (apiKey) return `apikey:${apiKey}`;

  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return `ip:${xff}`;

  return "ip:unknown";
}

async function applyRateLimit(req: Request, keyPrefix: string, max: number, windowSec: number) {
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const key = `${keyPrefix}:${clientKey(req)}:${bucket}`;

  const currentRaw = await cache.get(key);
  const current = currentRaw ? Number(currentRaw) : 0;
  const nextCount = current + 1;

  await cache.set(key, String(nextCount), windowSec);

  return {
    limit: max,
    remaining: Math.max(0, max - nextCount),
    windowSec,
    blocked: nextCount > max,
  };
}

async function ensureJson(req: Request, rid: string): Promise<Response | null> {
  if (!WRITE_METHODS.has(req.method)) return null;

  const hasBody =
    (req.headers.get("content-length") ?? "0") !== "0" ||
    req.headers.has("transfer-encoding");

  if (!hasBody) return null;

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return buildProblem(req, {
      status: 415,
      detail: "Content-Type must be application/json",
      requestId: rid,
    });
  }

  return null;
}

async function resolveAuth(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }

  const token = auth.slice(7).trim();
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const user = await authRepo.findActiveSessionUserByTokenHash(tokenHash);
  if (!user) return null;

  return { user, tokenHash };
}

export const appElysia = new Elysia()
  .onRequest(async ({ request, set }) => {
    const rid = requestId(request);

    set.headers["x-request-id"] = rid;
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["x-frame-options"] = "DENY";
    set.headers["referrer-policy"] = "no-referrer";
    set.headers["x-dns-prefetch-control"] = "off";
    set.headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()";
    set.headers["cross-origin-resource-policy"] = "same-origin";

    logger.info("request.started", {
      requestId: rid,
      method: request.method,
      path: new URL(request.url).pathname,
      userAgent: request.headers.get("user-agent") ?? "unknown",
    });

    const ct = await ensureJson(request, rid);
    if (ct) {
      return ct;
    }

    const globalRl = await applyRateLimit(
      request,
      "rl:global",
      env.GLOBAL_RATE_LIMIT_MAX,
      env.GLOBAL_RATE_LIMIT_WINDOW_SEC,
    );

    set.headers["x-ratelimit-limit"] = String(globalRl.limit);
    set.headers["x-ratelimit-remaining"] = String(globalRl.remaining);
    set.headers["x-ratelimit-window-sec"] = String(globalRl.windowSec);

    if (globalRl.blocked) {
      set.headers["retry-after"] = String(globalRl.windowSec);
      return buildProblem(request, {
        status: 429,
        detail: "Rate limit exceeded",
        requestId: rid,
      });
    }

    if (new URL(request.url).pathname.startsWith("/api/v1/auth")) {
      const authRl = await applyRateLimit(
        request,
        "rl:auth",
        env.AUTH_RATE_LIMIT_MAX,
        env.AUTH_RATE_LIMIT_WINDOW_SEC,
      );

      set.headers["x-ratelimit-limit"] = String(authRl.limit);
      set.headers["x-ratelimit-remaining"] = String(authRl.remaining);
      set.headers["x-ratelimit-window-sec"] = String(authRl.windowSec);

      if (authRl.blocked) {
        set.headers["retry-after"] = String(authRl.windowSec);
        return buildProblem(request, {
          status: 429,
          detail: "Rate limit exceeded",
          requestId: rid,
        });
      }
    }

    return undefined;
  })
  .onAfterResponse(({ request }) => {
    logger.info("request.completed", {
      method: request.method,
      path: new URL(request.url).pathname,
    });
  })
  .get("/healthz", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: { app: "ok" },
  }))
  .get("/healthz/readyz", async ({ request }) => {
    const rid = requestId(request);

    let dbOk = false;
    let cacheOk: boolean | "skipped" = "skipped";

    try {
      await db`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    if (env.READINESS_CHECK_CACHE) {
      try {
        const key = `health:cache:${crypto.randomUUID()}`;
        await cache.set(key, "ok", 5);
        const value = await cache.get(key);
        await cache.del(key);
        cacheOk = value === "ok";
      } catch {
        cacheOk = false;
      }
    }

    const ready = dbOk && (cacheOk === true || cacheOk === "skipped");

    if (!ready) {
      return buildProblem(request, {
        status: 503,
        detail: "Service dependencies are not ready",
        requestId: rid,
      });
    }

    return {
      status: "ready",
      timestamp: new Date().toISOString(),
      services: {
        db: dbOk ? "ok" : "down",
        cache: cacheOk === "skipped" ? "skipped" : cacheOk ? "ok" : "down",
      },
    };
  })
  .post("/api/v1/auth/register", async ({ request }) => {
    const rid = requestId(request);
    try {
      const payload = RegisterSchema.parse(await request.json());
      const passwordHash = await hashPassword(payload.password);
      const user = await authRepo.createUserWithPassword({
        email: payload.email,
        fullName: payload.fullName,
        passwordHash,
      });

      return new Response(
        JSON.stringify({
          data: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
          },
        }),
        {
          status: 201,
          headers: {
            "content-type": "application/json",
            "x-request-id": rid,
          },
        },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return buildProblem(request, {
          status: 422,
          detail: "Validation failed",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      const maybePgError = error as { code?: string; message?: string };
      if (maybePgError.code === "23505" || maybePgError.message?.includes("users_email_key")) {
        return buildProblem(request, {
          status: 409,
          detail: "User already exists",
          requestId: rid,
        });
      }

      return buildProblem(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .post("/api/v1/auth/login", async ({ request }) => {
    const rid = requestId(request);
    try {
      const payload = LoginSchema.parse(await request.json());
      const user = await authRepo.findUserByEmail(payload.email);

      if (!user?.password_hash) {
        return buildProblem(request, {
          status: 401,
          detail: "Invalid credentials",
          requestId: rid,
        });
      }

      const valid = await verifyPassword(payload.password, user.password_hash);
      if (!valid) {
        return buildProblem(request, {
          status: 401,
          detail: "Invalid credentials",
          requestId: rid,
        });
      }

      const token = generateOpaqueToken();
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);

      await authRepo.createSession({
        userId: user.id,
        tokenHash,
        expiresAtIso: expiresAt.toISOString(),
      });

      return new Response(
        JSON.stringify({
          data: {
            tokenType: "Bearer",
            accessToken: token,
            expiresAt: expiresAt.toISOString(),
            user: {
              id: user.id,
              email: user.email,
              fullName: user.full_name,
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": rid,
          },
        },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return buildProblem(request, {
          status: 422,
          detail: "Validation failed",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      return buildProblem(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .post("/api/v1/auth/logout", async ({ request }) => {
    const rid = requestId(request);
    const auth = await resolveAuth(request);

    if (!auth) {
      return buildProblem(request, {
        status: 401,
        detail: "Invalid or expired token",
        requestId: rid,
      });
    }

    await authRepo.revokeSessionByTokenHash(auth.tokenHash);
    return new Response(null, {
      status: 204,
      headers: { "x-request-id": rid },
    });
  })
  .get("/api/v1/users", async ({ request }) => {
    const rid = requestId(request);
    const auth = await resolveAuth(request);

    if (!auth) {
      return buildProblem(request, {
        status: 401,
        detail: "Invalid or expired token",
        requestId: rid,
      });
    }

    try {
      const url = new URL(request.url);
      const query = ListUsersQuerySchema.parse({
        limit: url.searchParams.get("limit") ?? undefined,
        offset: url.searchParams.get("offset") ?? undefined,
        cursor: url.searchParams.get("cursor") ?? undefined,
      });

      if (query.cursor !== undefined) {
        const decodedCursor = decodeUsersCursor(query.cursor);
        const users = await usersRepo.listByCursor(query.limit + 1, decodedCursor);
        const hasMore = users.length > query.limit;
        const page = hasMore ? users.slice(0, query.limit) : users;
        const last = page[page.length - 1];

        return new Response(
          JSON.stringify({
            data: page,
            meta: {
              mode: "cursor",
              limit: query.limit,
              count: page.length,
              nextCursor: hasMore && last
                ? encodeUsersCursor({ createdAt: last.created_at, id: last.id })
                : null,
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "x-request-id": rid,
            },
          },
        );
      }

      const offset = query.offset ?? 0;
      const users = await usersRepo.listByOffset(query.limit, offset);

      return new Response(
        JSON.stringify({
          data: users,
          meta: {
            mode: "offset",
            limit: query.limit,
            offset,
            count: users.length,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "x-request-id": rid,
          },
        },
      );
    } catch (error) {
      if (error instanceof ZodError) {
        return buildProblem(request, {
          status: 400,
          detail: "Invalid query parameters",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      if (error instanceof Error && error.message.startsWith("Invalid cursor")) {
        return buildProblem(request, {
          status: 400,
          detail: "Invalid cursor",
          requestId: rid,
        });
      }

      return buildProblem(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .get("/api/v1/users/:id", async ({ request, params }) => {
    const rid = requestId(request);
    const auth = await resolveAuth(request);

    if (!auth) {
      return buildProblem(request, {
        status: 401,
        detail: "Invalid or expired token",
        requestId: rid,
      });
    }

    try {
      const parsed = UserIdParamsSchema.parse({ id: params.id });
      const user = await usersRepo.getById(parsed.id);

      if (!user) {
        return buildProblem(request, {
          status: 404,
          detail: "User not found",
          requestId: rid,
        });
      }

      return new Response(JSON.stringify({ data: user }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": rid,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return buildProblem(request, {
          status: 400,
          detail: "Invalid path parameters",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      return buildProblem(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .post("/api/v1/users", async ({ request }) => {
    const rid = requestId(request);
    const auth = await resolveAuth(request);

    if (!auth) {
      return buildProblem(request, {
        status: 401,
        detail: "Invalid or expired token",
        requestId: rid,
      });
    }

    try {
      const payload = CreateUserSchema.parse(await request.json());
      const user = await usersRepo.create(payload);

      return new Response(JSON.stringify({ data: user }), {
        status: 201,
        headers: {
          "content-type": "application/json",
          "x-request-id": rid,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return buildProblem(request, {
          status: 422,
          detail: "Validation failed",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      const maybePgError = error as { code?: string; message?: string };
      if (maybePgError.code === "23505" || maybePgError.message?.includes("users_email_key")) {
        return buildProblem(request, {
          status: 409,
          detail: "User already exists",
          requestId: rid,
        });
      }

      return buildProblem(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .get("/api/v1/example", async ({ request }) => {
    const rid = requestId(request);
    try {
      const url = new URL(request.url);
      const query = ExampleQuerySchema.parse({
        limit: url.searchParams.get("limit") ?? undefined,
      });

      const data = await exampleRepo.listFromDb(query.limit);
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": rid,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return buildProblem(request, {
          status: 400,
          detail: "Invalid query parameters",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      return buildProblem(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .all("*", ({ request }) => {
    const rid = requestId(request);
    return buildProblem(request, {
      status: 404,
      detail: `Route ${request.method} ${new URL(request.url).pathname} not found`,
      requestId: rid,
    });
  });
