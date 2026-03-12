import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import express from "express";
import type { Server } from "node:http";
import { createUsersRouter } from "../src/routes/users";
import type { IUsersRepo, UserRecord, UsersListQuery } from "../src/repo/users";

class UsersRepoStub implements IUsersRepo {
  listResult: UserRecord[] = [];
  getByIdResult: UserRecord | null = null;
  createError: unknown = null;

  async listByOffset(_query: UsersListQuery): Promise<UserRecord[]> {
    return this.listResult;
  }

  async listByCursor(_query: UsersListQuery): Promise<UserRecord[]> {
    return this.listResult;
  }

  async getById(_id: string): Promise<UserRecord | null> {
    return this.getByIdResult;
  }

  async create(_input: { email: string; fullName: string }): Promise<UserRecord> {
    if (this.createError) {
      throw this.createError;
    }

    return {
      id: "e5cefd6d-95b8-45eb-9d7f-dbe4388404ef",
      email: "test@example.com",
      full_name: "Test User",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

describe("users router", () => {
  let server: Server;
  let baseUrl = "";
  let repo: UsersRepoStub;

  beforeEach(() => {
    repo = new UsersRepoStub();
    const app = express();
    app.use(express.json());
    app.use("/users", createUsersRouter({ repo }));
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

  test("returns 400 on invalid cursor", async () => {
    const response = await fetch(`${baseUrl}/users?cursor=invalid-cursor`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.detail).toBe("Invalid cursor");
  });

  test("returns 404 for missing user", async () => {
    const response = await fetch(`${baseUrl}/users/e5cefd6d-95b8-45eb-9d7f-dbe4388404ef`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body.detail).toBe("User not found");
  });

  test("returns 400 for invalid path id", async () => {
    const response = await fetch(`${baseUrl}/users/not-a-uuid`);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.detail).toBe("Invalid path parameters");
  });

  test("returns 409 on duplicate user", async () => {
    repo.createError = { code: "23505" };

    const response = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        fullName: "Test User",
      }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body.detail).toBe("User already exists");
  });
});

