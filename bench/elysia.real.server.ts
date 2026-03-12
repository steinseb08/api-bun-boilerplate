import { Elysia } from "elysia";
import { ZodError } from "zod";
import { authRepo } from "../src/repo/auth";
import { usersRepo } from "../src/repo/users";
import { env } from "../src/provider/config";
import { LoginSchema, RegisterSchema } from "../src/request/auth";
import { CreateUserSchema, ListUsersQuerySchema } from "../src/request/users";
import { generateOpaqueToken, hashPassword, sha256Hex, verifyPassword } from "../src/utils/security";
import { zodErrorToFieldMap } from "../src/utils/validation";

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
};

function problemFor(req: Request, input: Problem): Response {
  const body = {
    type: input.type ?? RFC_TYPE_BY_STATUS[input.status] ?? "about:blank",
    title: input.title ?? TITLE_BY_STATUS[input.status] ?? "Unknown Error",
    status: input.status,
    detail: input.detail,
    instance: input.instance ?? `${req.method} ${new URL(req.url).pathname}`,
    requestId: input.requestId,
    errors: input.errors,
  };

  return new Response(JSON.stringify(body), {
    status: input.status,
    headers: {
      "content-type": "application/problem+json",
      ...(input.requestId ? { "x-request-id": input.requestId } : {}),
    },
  });
}

function requestId(req: Request): string {
  return req.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}

async function resolveAuthUser(req: Request) {
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

const app = new Elysia()
  .onRequest(({ request, set }) => {
    const rid = requestId(request);
    set.headers["x-request-id"] = rid;
  })
  .get("/healthz", () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: { app: "ok" },
    };
  })
  .post("/api/v1/auth/register", async ({ request }) => {
    const rid = requestId(request);

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return problemFor(request, {
        status: 415,
        detail: "Content-Type must be application/json",
        requestId: rid,
      });
    }

    try {
      const json = await request.json();
      const payload = RegisterSchema.parse(json);
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
        return problemFor(request, {
          status: 422,
          detail: "Validation failed",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      const maybePgError = error as { code?: string };
      if (maybePgError.code === "23505") {
        return problemFor(request, {
          status: 409,
          detail: "User already exists",
          requestId: rid,
        });
      }

      return problemFor(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .post("/api/v1/auth/login", async ({ request }) => {
    const rid = requestId(request);

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return problemFor(request, {
        status: 415,
        detail: "Content-Type must be application/json",
        requestId: rid,
      });
    }

    try {
      const json = await request.json();
      const payload = LoginSchema.parse(json);
      const user = await authRepo.findUserByEmail(payload.email);

      if (!user?.password_hash) {
        return problemFor(request, {
          status: 401,
          detail: "Invalid credentials",
          requestId: rid,
        });
      }

      const valid = await verifyPassword(payload.password, user.password_hash);
      if (!valid) {
        return problemFor(request, {
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
        return problemFor(request, {
          status: 422,
          detail: "Validation failed",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      return problemFor(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .get("/api/v1/users", async ({ request }) => {
    const rid = requestId(request);
    const auth = await resolveAuthUser(request);

    if (!auth) {
      return problemFor(request, {
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
      });

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
        return problemFor(request, {
          status: 400,
          detail: "Invalid query parameters",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      return problemFor(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  })
  .post("/api/v1/users", async ({ request }) => {
    const rid = requestId(request);
    const auth = await resolveAuthUser(request);

    if (!auth) {
      return problemFor(request, {
        status: 401,
        detail: "Invalid or expired token",
        requestId: rid,
      });
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return problemFor(request, {
        status: 415,
        detail: "Content-Type must be application/json",
        requestId: rid,
      });
    }

    try {
      const json = await request.json();
      const payload = CreateUserSchema.parse(json);
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
        return problemFor(request, {
          status: 422,
          detail: "Validation failed",
          requestId: rid,
          errors: zodErrorToFieldMap(error),
        });
      }

      const maybePgError = error as { code?: string };
      if (maybePgError.code === "23505") {
        return problemFor(request, {
          status: 409,
          detail: "User already exists",
          requestId: rid,
        });
      }

      return problemFor(request, {
        status: 500,
        detail: env.NODE_ENV === "production" ? "Unexpected server error" : String(error),
        requestId: rid,
      });
    }
  });

const port = Number(process.env.BENCH_PORT ?? 3301);
const host = process.env.BENCH_HOST ?? "0.0.0.0";

app.listen({ port, hostname: host }, () => {
  console.log(`elysia real bench server running at http://${host}:${port}`);
});
