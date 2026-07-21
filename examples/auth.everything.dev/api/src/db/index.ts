import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Data } from "every-plugin/effect";
import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseDriver {
  readonly db: Database;
  close(): Promise<void>;
}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  stage: "driver" | "migration" | "load" | "close";
  migrationTag?: string;
  statementIndex?: number;
  cause: unknown;
}> {
  override get message() {
    const parts = [`DatabaseError [stage=${this.stage}]`];
    if (this.migrationTag) parts.push(`migration=${this.migrationTag}`);
    if (this.statementIndex !== undefined) parts.push(`statement=${this.statementIndex}`);
    parts.push(unwrapDatabaseError(this.cause));
    return parts.join(": ");
  }
}

export function unwrapDatabaseError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts = [error.message];
  let cause: unknown = error.cause;
  while (cause instanceof Error) {
    parts.push(cause.message);
    cause = cause.cause;
  }
  return parts.join(": ");
}

export async function createDatabaseDriver(url: string): Promise<DatabaseDriver> {
  if (url.startsWith("pglite:") || url === ":memory:") {
    const { drizzle } = await import("drizzle-orm/pglite");
    const { PGlite } = await import("@electric-sql/pglite");
    const rawDir = url === ":memory:" ? ":memory:" : url.replace("pglite:", "");
    const dataDir = rawDir.endsWith("/:memory:") || rawDir === ":memory:" ? ":memory:" : rawDir;
    if (dataDir !== ":memory:") {
      mkdirSync(dirname(dataDir), { recursive: true });
    }
    const pglite = new PGlite(dataDir);
    const db = drizzle(pglite, { schema });
    return {
      db,
      close: async () => {
        await pglite.close();
      },
    };
  }

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: url,
    ssl: isLocal
      ? false
      : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" },
    max: Number(process.env.DB_POOL_MAX) || 10,
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 30_000,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 30_000,
  });
  pool.on("error", (err: Error) => {
    console.error("[Database] Unexpected pool error:", err.message);
  });
  let closed = false;
  return {
    db: drizzle(pool, { schema }),
    close: async () => {
      if (closed) return;
      closed = true;
      pool.removeAllListeners("error");
      console.error(
        "[Database] pool.end() called from:",
        new Error("pool.end() stack trace").stack,
      );
      await pool.end();
    },
  };
}
