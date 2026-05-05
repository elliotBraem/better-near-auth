import type { DatabaseDriver } from "./driver";
import type { Migration } from "virtual:drizzle-migrations.sql";

/**
 * Run migrations against any database driver.
 *
 * Uses the driver's `execute` and `query` methods so it works with
 * libsql, better-sqlite3, bun:sqlite, and node:sqlite.
 */
export async function migrate(driver: DatabaseDriver, migrations: Migration[]): Promise<void> {
  await driver.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  const appliedRows = await driver.query("SELECT hash FROM __drizzle_migrations");
  const appliedHashes = new Set(appliedRows.map((r: any) => r.hash as string));

  for (const migration of migrations) {
    if (appliedHashes.has(migration.hash)) continue;
    console.log(`[Auth] Applying migration: ${migration.tag}`);

    const statements = [
      ...migration.sql,
      `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('${migration.hash}', ${Date.now()})`,
    ];

    if (driver.batch) {
      await driver.batch(statements);
    } else {
      for (const sql of statements) {
        await driver.execute(sql);
      }
    }
  }
}
