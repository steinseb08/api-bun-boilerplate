import { appDb } from "../provider/db";

export type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export interface IUsersRepo {
  listByOffset(query: UsersListQuery): Promise<UserRecord[]>;
  listByCursor(query: UsersListQuery, cursor?: { createdAt: string; id: string }): Promise<UserRecord[]>;
  getById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; fullName: string }): Promise<UserRecord>;
}

export type UsersSortBy = "createdAt" | "email" | "fullName";
export type UsersSortOrder = "asc" | "desc";

export type UsersListQuery = {
  limit: number;
  offset?: number;
  q?: string;
  email?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy: UsersSortBy;
  sortOrder: UsersSortOrder;
};

function sortColumn(sortBy: UsersSortBy): string {
  switch (sortBy) {
    case "createdAt":
      return "created_at";
    case "email":
      return "email";
    case "fullName":
      return "full_name";
  }
}

function whereClause(query: UsersListQuery, params: Array<string | number | boolean | null>): string {
  const parts: string[] = [];

  if (query.q) {
    parts.push("(email LIKE ? OR full_name LIKE ?)");
    const pattern = `%${query.q}%`;
    params.push(pattern, pattern);
  }

  if (query.email) {
    parts.push("email = ?");
    params.push(query.email);
  }

  if (query.createdFrom) {
    parts.push("created_at >= ?");
    params.push(query.createdFrom);
  }

  if (query.createdTo) {
    parts.push("created_at <= ?");
    params.push(query.createdTo);
  }

  if (parts.length === 0) {
    return "";
  }

  return `WHERE ${parts.join(" AND ")}`;
}

export class UsersRepo implements IUsersRepo {
  async listByOffset(query: UsersListQuery): Promise<UserRecord[]> {
    const params: Array<string | number | boolean | null> = [];
    const where = whereClause(query, params);
    const direction = query.sortOrder.toUpperCase();
    const primary = sortColumn(query.sortBy);
    const tieBreaker = ", id DESC";
    const offset = query.offset ?? 0;

    params.push(query.limit, offset);

    return appDb.query<UserRecord>(
      `SELECT id, email, full_name, created_at, updated_at FROM users ${where} ORDER BY ${primary} ${direction}${tieBreaker} LIMIT ? OFFSET ?`,
      params,
    );
  }

  async listByCursor(query: UsersListQuery, cursor?: { createdAt: string; id: string }): Promise<UserRecord[]> {
    const params: Array<string | number | boolean | null> = [];
    const where = whereClause(query, params);

    if (!cursor) {
      params.push(query.limit);
      return appDb.query<UserRecord>(
        `SELECT id, email, full_name, created_at, updated_at FROM users ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
        params,
      );
    }

    const cursorPredicate = "(created_at < ? OR (created_at = ? AND id < ?))";
    const whereWithCursor = where ? `${where} AND ${cursorPredicate}` : `WHERE ${cursorPredicate}`;
    params.push(cursor.createdAt, cursor.createdAt, cursor.id, query.limit);

    return appDb.query<UserRecord>(
      `SELECT id, email, full_name, created_at, updated_at FROM users ${whereWithCursor} ORDER BY created_at DESC, id DESC LIMIT ?`,
      params,
    );
  }

  async getById(id: string): Promise<UserRecord | null> {
    const rows = await appDb.query<UserRecord>(
      "SELECT id, email, full_name, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
      [id],
    );

    return rows[0] ?? null;
  }

  async create(input: { email: string; fullName: string }): Promise<UserRecord> {
    const rows = await appDb.query<UserRecord>(
      "INSERT INTO users (email, full_name) VALUES (?, ?) RETURNING id, email, full_name, created_at, updated_at",
      [input.email, input.fullName],
    );

    if (rows.length === 0) {
      throw new Error("Failed to create user");
    }

    return rows[0] as UserRecord;
  }
}

export const usersRepo: IUsersRepo = new UsersRepo();
