import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type AuthDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseDriver {
  readonly db: AuthDatabase;
  close(): Promise<void>;
}

export async function createDatabaseDriver(url: string): Promise<DatabaseDriver> {
  if (url.startsWith("pglite:") || url === ":memory:") {
    const { drizzle } = await import("drizzle-orm/pglite");
    const dataDir = url === ":memory:" ? ":memory:" : url.replace("pglite:", "");
    const actualDir = dataDir.endsWith("/:memory:") ? ":memory:" : dataDir;
    if (actualDir !== ":memory:") {
      mkdirSync(dirname(actualDir), { recursive: true });
    }
    const db = drizzle(actualDir, { schema });
    return {
      db,
      close: async () => {},
    };
  }

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.includes("0.0.0.0");
  const pool = new Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  return {
    db: drizzle(pool, { schema }),
    close: async () => {
      await pool.end();
    },
  };
}
