import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://dingcad:dingcad_dev@localhost:5432/dingcad",
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
