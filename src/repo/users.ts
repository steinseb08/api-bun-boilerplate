import { db } from "../provider/db";

export type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export interface IUsersRepo {
  listByOffset(limit: number, offset: number): Promise<UserRecord[]>;
  listByCursor(limit: number, cursor?: { createdAt: string; id: string }): Promise<UserRecord[]>;
  getById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; fullName: string }): Promise<UserRecord>;
}

export class UsersRepo implements IUsersRepo {
  async listByOffset(limit: number, offset: number): Promise<UserRecord[]> {
    return db<UserRecord[]>`
      SELECT id, email, full_name, created_at, updated_at
      FROM users
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }

  async listByCursor(limit: number, cursor?: { createdAt: string; id: string }): Promise<UserRecord[]> {
    if (!cursor) {
      return db<UserRecord[]>`
        SELECT id, email, full_name, created_at, updated_at
        FROM users
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `;
    }

    return db<UserRecord[]>`
      SELECT id, email, full_name, created_at, updated_at
      FROM users
      WHERE (created_at, id) < (${cursor.createdAt}, ${cursor.id})
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
  }

  async getById(id: string): Promise<UserRecord | null> {
    const rows = await db<UserRecord[]>`
      SELECT id, email, full_name, created_at, updated_at
      FROM users
      WHERE id = ${id}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async create(input: { email: string; fullName: string }): Promise<UserRecord> {
    const rows = await db<UserRecord[]>`
      INSERT INTO users (email, full_name)
      VALUES (${input.email}, ${input.fullName})
      RETURNING id, email, full_name, created_at, updated_at
    `;

    if (rows.length === 0) {
      throw new Error("Failed to create user");
    }

    return rows[0] as UserRecord;
  }
}

export const usersRepo: IUsersRepo = new UsersRepo();
