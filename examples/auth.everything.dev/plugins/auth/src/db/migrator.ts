import type { Migration } from "virtual:drizzle-migrations.sql";
import { sql } from "drizzle-orm";
import type { AuthDatabase } from "./driver";

function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

/**
 * Run bundled migrations against the PostgreSQL database.
 * Uses a standard `drizzle_migrations` tracking table compatible with Drizzle Kit.
 */
export async function migrate(db: AuthDatabase, migrations: Migration[]): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  interface MigrationRow {
    hash: string;
  }

  const rawResult = await db.execute(sql`SELECT hash FROM "drizzle_migrations"`);
  const appliedRows = normalizeRows<MigrationRow>(rawResult);
  const appliedHashes = new Set(appliedRows.map((r) => r.hash));

  for (const migration of migrations) {
    if (appliedHashes.has(migration.hash)) continue;
    console.log(`[Auth] Applying migration: ${migration.tag}`);

    await db.transaction(async (tx) => {
      for (const statement of migration.sql) {
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(
        sql`INSERT INTO "drizzle_migrations" (hash, created_at) VALUES (${migration.hash}, ${Date.now()})`,
      );
    });
  }
}
