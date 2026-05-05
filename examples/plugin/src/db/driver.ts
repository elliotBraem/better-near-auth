import type * as schema from "./schema";

/**
 * Database driver abstraction for the auth plugin.
 *
 * The plugin supports multiple SQLite drivers:
 * - `libsql` (default) — HTTP-based, works with Turso, edge runtimes
 * - `better-sqlite3` — Native Node.js, fastest for local dev
 * - `bun` — Bun's built-in SQLite
 * - `node` — Node.js 22.5+ built-in `node:sqlite`
 *
 * The driver is chosen at runtime via the `AUTH_DATABASE_DRIVER` env var
 * or the `driver` option passed to `createDatabaseDriver()`.
 */

type Schema = typeof schema;

/**
 * Generic database type that works with any Drizzle SQLite driver.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AuthDatabase = any;

export interface DatabaseDriver {
  /** The Drizzle database instance for queries/inserts/updates */
  readonly db: AuthDatabase;

  /** Execute a single SQL statement (CREATE, INSERT, etc.) */
  execute(sql: string): Promise<void>;

  /** Execute a SELECT and return rows */
  query(sql: string): Promise<unknown[]>;

  /** Execute multiple SQL statements in a transaction (optional — falls back to sequential execute) */
  batch?(sqls: string[]): Promise<void>;

  /** Close the underlying database connection */
  close(): void;
}

export interface DriverOptions {
  /** Explicit driver choice. If omitted, inferred from URL or defaults to `libsql` */
  driver?: "libsql" | "better-sqlite3" | "bun" | "node";
  /** Auth token for libsql remote databases */
  authToken?: string;
}

function inferDriver(url: string, explicit?: string): NonNullable<DriverOptions["driver"]> {
  if (explicit) return explicit as NonNullable<DriverOptions["driver"]>;

  // Heuristics based on URL
  if (url.startsWith("libsql://") || url.startsWith("http://") || url.startsWith("https://")) {
    return "libsql";
  }

  if (url.startsWith("file:")) {
    // Check runtime for best local driver
    if (typeof Bun !== "undefined") return "bun";
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require.resolve("better-sqlite3");
      return "better-sqlite3";
    } catch {
      return "libsql";
    }
  }

  return "libsql";
}

/**
 * Create a database driver for the given URL.
 *
 * @example
 * ```ts
 * const driver = createDatabaseDriver("file:./auth.db", { driver: "better-sqlite3" });
 * const db = driver.db;
 * driver.close();
 * ```
 */
export function createDatabaseDriver(url: string, options?: DriverOptions): DatabaseDriver {
  const driverType = inferDriver(url, options?.driver);

  switch (driverType) {
    case "libsql":
      return createLibsqlDriver(url, options?.authToken);
    case "better-sqlite3":
      return createBetterSqlite3Driver(url);
    case "bun":
      return createBunDriver(url);
    case "node":
      return createNodeDriver(url);
    default:
      throw new Error(`Unknown database driver: ${driverType}`);
  }
}

// Lazy-loaded implementations to avoid importing unused drivers at startup

function createLibsqlDriver(url: string, authToken?: string): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/libsql") as typeof import("drizzle-orm/libsql");

  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema: require("./schema") as Schema });

  return {
    db,
    execute: async (sql: string) => {
      await client.execute(sql);
    },
    query: async (sql: string) => {
      const result = await client.execute(sql);
      return result.rows;
    },
    batch: async (sqls: string[]) => {
      await client.batch(sqls.map((sql) => ({ sql })));
    },
    close: () => {
      client.close();
    },
  };
}

function createBetterSqlite3Driver(url: string): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/better-sqlite3") as typeof import("drizzle-orm/better-sqlite3");

  const path = url.replace("file:", "").replace(/^\//, "");
  const sqlite = new Database(path);
  const db = drizzle(sqlite, { schema: require("./schema") as Schema });

  return {
    db,
    execute: async (sql: string) => {
      sqlite.exec(sql);
    },
    query: async (sql: string) => {
      return sqlite.prepare(sql).all() as unknown[];
    },
    close: () => {
      sqlite.close();
    },
  };
}

function createBunDriver(url: string): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Database } = require("bun:sqlite") as typeof import("bun:sqlite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/bun-sqlite") as typeof import("drizzle-orm/bun-sqlite");

  const path = url.replace("file:", "").replace(/^\//, "");
  const sqlite = new Database(path);
  const db = drizzle(sqlite, { schema: require("./schema") as Schema });

  return {
    db,
    execute: async (sql: string) => {
      sqlite.exec(sql);
    },
    query: async (sql: string) => {
      return sqlite.query(sql).all() as unknown[];
    },
    close: () => {
      sqlite.close();
    },
  };
}

function createNodeDriver(url: string): DatabaseDriver {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = require("node:sqlite") as typeof import("node:sqlite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-sqlite") as typeof import("drizzle-orm/node-sqlite");

  const path = url.replace("file:", "").replace(/^\//, "");
  const sqlite = new DatabaseSync(path);
  const db = drizzle(sqlite, { schema: require("./schema") as Schema });

  return {
    db,
    execute: async (sql: string) => {
      sqlite.exec(sql);
    },
    query: async (sql: string) => {
      // DatabaseSync.exec() doesn't return rows; use prepare for SELECTs
      const stmt = sqlite.prepare(sql);
      const rows = [];
      // DatabaseSync statements iterate over rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of stmt.iterate()) {
        rows.push(row);
      }
      return rows;
    },
    close: () => {
      sqlite.close();
    },
  };
}
