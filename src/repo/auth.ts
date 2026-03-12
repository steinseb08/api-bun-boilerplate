import { appDb } from "../provider/db";

export type AuthUserRecord = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string | null;
};

export type SessionUser = {
  id: string;
  email: string;
  full_name: string;
};

export type SessionRecord = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
};

export interface IAuthRepo {
  createUserWithPassword(input: { email: string; fullName: string; passwordHash: string }): Promise<SessionUser>;
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createSession(input: { userId: string; tokenHash: string; expiresAtIso: string }): Promise<void>;
  findActiveSessionUserByTokenHash(tokenHash: string): Promise<SessionUser | null>;
  revokeSessionByTokenHash(tokenHash: string): Promise<boolean>;
}

export class AuthRepo implements IAuthRepo {
  async createUserWithPassword(input: { email: string; fullName: string; passwordHash: string }): Promise<SessionUser> {
    const rows = await appDb.query<SessionUser>(
      "INSERT INTO users (email, full_name, password_hash) VALUES (?, ?, ?) RETURNING id, email, full_name",
      [input.email, input.fullName, input.passwordHash],
    );

    if (rows.length === 0) throw new Error("Failed to create user");
    return rows[0] as SessionUser;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const rows = await appDb.query<AuthUserRecord>(
      "SELECT id, email, full_name, password_hash FROM users WHERE email = ? LIMIT 1",
      [email],
    );

    return rows[0] ?? null;
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAtIso: string }): Promise<void> {
    await appDb.exec(
      "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
      [input.userId, input.tokenHash, input.expiresAtIso],
    );
  }

  async findActiveSessionUserByTokenHash(tokenHash: string): Promise<SessionUser | null> {
    const now = new Date().toISOString();
    const rows = await appDb.query<SessionUser>(
      "SELECT u.id, u.email, u.full_name FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? LIMIT 1",
      [tokenHash, now],
    );

    return rows[0] ?? null;
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<boolean> {
    const now = new Date().toISOString();
    const rows = await appDb.query<{ id: string }>(
      "UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? RETURNING id",
      [now, tokenHash, now],
    );

    return rows.length > 0;
  }
}

export const authRepo: IAuthRepo = new AuthRepo();
