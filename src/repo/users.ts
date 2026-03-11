import { db } from "../provider/db";

export type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export async function listUsers(limit: number, offset: number): Promise<UserRecord[]> {
  return db<UserRecord[]>`
    SELECT id, email, full_name, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const rows = await db<UserRecord[]>`
    SELECT id, email, full_name, created_at, updated_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  fullName: string;
}): Promise<UserRecord> {
  const rows = await db<UserRecord[]>`
    INSERT INTO users (email, full_name)
    VALUES (${input.email}, ${input.fullName})
    RETURNING id, email, full_name, created_at, updated_at
  `;

  if (rows.length === 0) {
    throw new Error("Failed to create user");
  }

  return rows[0] as unknown as UserRecord;
}
