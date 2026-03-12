import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import { createAuthRouter } from "../src/routes/auth";
import type { AuthUserRecord, IAuthRepo, SessionUser } from "../src/repo/auth";

class AuthRepoStub implements IAuthRepo {
  createUserError: unknown = null;
  userByEmail: AuthUserRecord | null = null;

  async createUserWithPassword(input: { email: string; fullName: string; passwordHash: string }): Promise<SessionUser> {
    if (this.createUserError) {
      throw this.createUserError;
    }

    return {
      id: "ec8c9ef2-7166-40f3-a84e-4c16d7c44614",
      email: input.email,
      full_name: input.fullName,
    };
  }

  async findUserByEmail(_email: string): Promise<AuthUserRecord | null> {
    return this.userByEmail;
  }

  async createSession(_input: { userId: string; tokenHash: string; expiresAtIso: string }): Promise<void> {}

  async findActiveSessionUserByTokenHash(_tokenHash: string): Promise<SessionUser | null> {
    return null;
  }

  async revokeSessionByTokenHash(_tokenHash: string): Promise<boolean> {
    return true;
  }
}

describe("auth router", () => {
  let server: Server;
  let baseUrl = "";
  let repo: AuthRepoStub;

  beforeEach(() => {
    repo = new AuthRepoStub();
    const app = express();
    app.use(express.json());
    app.use((_, res, next) => {
      res.locals.requestId = "req-auth";
      next();
    });
    app.use("/auth", createAuthRouter({ repo }));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: String(error) });
    });

    server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind test server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    server.close();
  });

  test("register returns 422 on invalid payload", async () => {
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nope", fullName: "X", password: "short" }),
    });

    expect(response.status).toBe(422);
  });

  test("register returns 409 on duplicate email", async () => {
    repo.createUserError = { code: "23505" };
    const response = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "dup@example.com", fullName: "Dup User", password: "very-strong-password" }),
    });

    expect(response.status).toBe(409);
  });

  test("login returns 422 on invalid payload", async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "invalid", password: "x" }),
    });

    expect(response.status).toBe(422);
  });

  test("login returns 401 when user does not exist", async () => {
    repo.userByEmail = null;
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "missing@example.com", password: "very-strong-password" }),
    });

    expect(response.status).toBe(401);
  });

  test("login returns 401 on wrong password", async () => {
    const passwordHash = await Bun.password.hash("correct-password");
    repo.userByEmail = {
      id: "8f97edce-bcc6-47f0-81cf-4567f7b8f1d7",
      email: "user@example.com",
      full_name: "User Example",
      password_hash: passwordHash,
    };

    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "wrong-password" }),
    });

    expect(response.status).toBe(401);
  });
});

