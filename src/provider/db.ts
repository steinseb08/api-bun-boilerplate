import { SQL } from "bun";
import { env } from "./config";

export const db = env.DATABASE_URL ? new SQL(env.DATABASE_URL) : Bun.sql;
