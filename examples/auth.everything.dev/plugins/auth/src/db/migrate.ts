import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Migration } from "virtual:drizzle-migrations.sql";
import { sql } from "drizzle-orm";
import { Effect } from "every-plugin/effect";
import {
  extractExpectedTables,
  getMigrationStorage,
  type MigrationStorage,
  toSqlArray,
} from "everything-dev/db";
import { type Database, DatabaseError } from "./index";

function normalizeRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export interface LoadedMigrations {
  migrations: Migration[];
  source: "virtual" | "disk";
}

export interface DriftReport {
  status: "healthy" | "empty" | "untracked-existing-schema" | "drift-safe-repair" | "drift-manual";
  expectedTables: string[];
  missingTables: string[];
  appliedHashes: number;
  localHashes: number;
  storage: MigrationStorage;
}

/**
 * Check which of the given expected tables already exist in the public schema,
 * using a proper PostgreSQL array literal to avoid Drizzle's broken array binding.
 */
function getExistingTables(
  db: Database,
  tables: string[],
): Effect.Effect<Set<string>, DatabaseError> {
  if (tables.length === 0) return Effect.succeed(new Set<string>());
  return Effect.tryPromise({
    try: () =>
      db.execute(sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY(${sql.raw(toSqlArray(tables))})
      `),
    catch: (cause) =>
      new DatabaseError({ stage: "migration", migrationTag: "preflight-table-check", cause }),
  }).pipe(
    Effect.map((result: any) => {
      const existing = new Set(
        normalizeRows<{ table_name: string }>(result).map((r) => r.table_name),
      );
      return existing;
    }),
    Effect.catchAll(() => Effect.succeed(new Set<string>())),
  );
}

/** Read applied hashes from the migration journal, returning an empty set on failure. */
function readAppliedHashes(
  db: Database,
  ref: ReturnType<typeof sql.raw>,
): Effect.Effect<Set<string>, never> {
  return Effect.tryPromise({
    try: () => db.execute(sql`SELECT hash FROM ${ref}`),
    catch: () =>
      new DatabaseError({
        stage: "migration",
        migrationTag: "read-applied",
        cause: new Error("Failed to read applied hashes"),
      }),
  }).pipe(
    Effect.map((result: any) => {
      const hashes = normalizeRows<{ hash: string }>(result).map((r) => r.hash);
      return new Set(hashes);
    }),
    Effect.catchAll(() => Effect.succeed(new Set<string>())),
  );
}

export function loadMigrations(): Effect.Effect<LoadedMigrations, DatabaseError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => import("virtual:drizzle-migrations.sql") as Promise<{ default?: Migration[] }>,
      catch: (cause) => new DatabaseError({ stage: "load", cause }),
    }).pipe(Effect.either);

    if (result._tag === "Right" && result.right?.default?.length) {
      const migrations = result.right.default;
      yield* Effect.logInfo(
        `[Database] Loaded ${migrations.length} migration(s) from virtual module`,
      );
      return { migrations, source: "virtual" as const };
    }

    const reason =
      result._tag === "Left" ? String(result.left.cause) : "no migrations in virtual module";

    if (result._tag === "Left") {
      yield* Effect.logDebug(
        `[Database] Virtual migrations unavailable (${reason}), loading from disk`,
      );
    } else {
      yield* Effect.logInfo("[Database] Virtual migrations empty, loading from disk");
    }

    const diskResult = yield* loadMigrationsFromDisk().pipe(Effect.either);

    if (diskResult._tag === "Right") {
      const migrations = diskResult.right;
      yield* Effect.logInfo(`[Database] Loaded ${migrations.length} migration(s) from disk`);
      return { migrations, source: "disk" as const };
    }

    yield* Effect.logWarning(
      `[Database] No migrations found from virtual or disk: ${diskResult.left.message}`,
    );
    return { migrations: [], source: "disk" as const };
  });
}

function loadMigrationsFromDisk(): Effect.Effect<Migration[], DatabaseError> {
  return Effect.try({
    try: () => {
      const migrationsDir = resolve(import.meta.dirname, "migrations");
      const metaDir = join(migrationsDir, "meta");
      const journalPath = join(metaDir, "_journal.json");

      if (!existsSync(journalPath)) {
        throw new Error(
          `Migrations journal not found at ${journalPath}. Run \`db:generate\` first.`,
        );
      }

      const journal = JSON.parse(readFileSync(journalPath, "utf8"));

      return journal.entries.map((entry: { idx: number; when: number; tag: string }) => {
        const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
        if (!existsSync(sqlPath)) {
          throw new Error(`Migration SQL file not found: ${sqlPath}`);
        }
        const raw = readFileSync(sqlPath, "utf8");
        const sqlStatements = raw.split("--> statement-breakpoint").map((s: string) => s.trim());
        const hash = createHash("sha256").update(raw).digest("hex");

        return {
          idx: entry.idx,
          when: entry.when,
          tag: entry.tag,
          hash,
          sql: sqlStatements,
        };
      });
    },
    catch: (cause) => new DatabaseError({ stage: "load", cause }),
  });
}

function journalRef(s: MigrationStorage): ReturnType<typeof sql> {
  return sql.raw(`"${s.schema}"."${s.table}"`);
}

/**
 * Apply pending migrations to the database journal.
 *
 * Pass an explicit `storage` resolved from the caller's workspace
 * (e.g. `getMigrationStorage(getMigrationSlug(import.meta.dirname))`) for
 * reliable slug derivation. The default fallback relies on
 * `process.env.npm_package_name`, which is unreliable under bundlers and
 * Module Federation remotes.
 */
export function migrate(
  db: Database,
  migrations: Migration[],
  storage?: MigrationStorage,
): Effect.Effect<number, DatabaseError> {
  return Effect.gen(function* () {
    const sorted = [...migrations].sort((a, b) => a.idx - b.idx);
    const journal = storage ?? getMigrationStorage();

    yield* ensureMigrationTable(db, journal);

    const ref = journalRef(journal);
    const appliedHashes = yield* readAppliedHashes(db, ref);

    let applied = 0;
    for (const migration of sorted) {
      const isApplied =
        appliedHashes.has(migration.hash) || appliedHashes.has(migration.hash.slice(0, 12));
      if (isApplied) continue;

      // Preflight: if this migration's expected tables already exist, record it
      // as applied rather than crashing on a duplicate DDL error.
      const expectedTables = extractExpectedTables([migration]);
      if (expectedTables.length > 0) {
        const existing = yield* getExistingTables(db, expectedTables);
        const missingTables = expectedTables.filter((t) => !existing.has(t));
        if (missingTables.length === 0) {
          yield* Effect.logWarning(
            `[Database] All tables for migration ${migration.tag} already exist — ` +
              `recording as applied without replaying DDL`,
          );
          yield* Effect.tryPromise({
            try: () =>
              db.execute(
                sql`INSERT INTO ${ref} (hash, created_at) VALUES (${migration.hash}, ${migration.when})`,
              ),
            catch: (cause) =>
              new DatabaseError({
                stage: "migration",
                migrationTag: migration.tag,
                cause,
              }),
          });
          appliedHashes.add(migration.hash);
          applied++;
          continue;
        }
        if (missingTables.length < expectedTables.length) {
          yield* Effect.logWarning(
            `[Database] Partial table overlap for migration ${migration.tag}: ` +
              `${expectedTables.length - missingTables.length} table(s) exist but not all. ` +
              `Applying migration — existing tables: ${expectedTables.filter((t) => existing.has(t)).join(", ")}`,
          );
        }
      }

      yield* Effect.logInfo(`[Database] Applying migration: ${migration.tag}`);

      yield* Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            for (const [i, statement] of migration.sql.entries()) {
              try {
                await tx.execute(sql.raw(statement));
              } catch (cause) {
                throw new DatabaseError({
                  stage: "migration",
                  migrationTag: migration.tag,
                  statementIndex: i,
                  cause,
                });
              }
            }
            await tx.execute(
              sql`INSERT INTO ${ref} (hash, created_at) VALUES (${migration.hash}, ${migration.when})`,
            );
          }),
        catch: (cause) =>
          cause instanceof DatabaseError
            ? cause
            : new DatabaseError({ stage: "migration", migrationTag: migration.tag, cause }),
      });
      applied++;
    }

    return applied;
  });
}

function ensureMigrationTable(
  db: Database,
  storage: MigrationStorage,
): Effect.Effect<void, DatabaseError> {
  const ref = journalRef(storage);
  return Effect.gen(function* () {
    yield* Effect.tryPromise({
      try: () => db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.raw(`"${storage.schema}"`)}`),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "init-schema", cause }),
    });

    yield* Effect.tryPromise({
      try: () =>
        db.execute(sql`
          CREATE TABLE IF NOT EXISTS ${ref} (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          )
        `),
      catch: (cause) =>
        new DatabaseError({ stage: "migration", migrationTag: "init-table", cause }),
    });
  });
}

/**
 * Detect drift between the local migration set and the database journal.
 *
 * Pass an explicit `storage` resolved from the caller's workspace for
 * reliable slug derivation; see {@link migrate} for details.
 */
export function detectDrift(
  db: Database,
  migrations: Migration[],
  storage?: MigrationStorage,
): Effect.Effect<DriftReport, DatabaseError> {
  return Effect.gen(function* () {
    const journal = storage ?? getMigrationStorage();
    const expectedTables = extractExpectedTables(migrations);
    const ref = journalRef(journal);

    const appliedHashes = yield* readAppliedHashes(db, ref);
    const appliedCount = appliedHashes.size;

    if (expectedTables.length === 0) {
      return {
        status: "empty",
        expectedTables: [],
        missingTables: [],
        appliedHashes: appliedCount,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    const existing = yield* getExistingTables(db, expectedTables);
    const missingTables = expectedTables.filter((t) => !existing.has(t));

    if (appliedCount === 0 && missingTables.length === 0) {
      // Journal is empty but all expected public tables already exist.
      return {
        status: "untracked-existing-schema",
        expectedTables,
        missingTables: [],
        appliedHashes: 0,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    if (missingTables.length === 0) {
      return {
        status: "healthy",
        expectedTables,
        missingTables: [],
        appliedHashes: appliedCount,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    if (missingTables.length === expectedTables.length) {
      return {
        status: "drift-safe-repair",
        expectedTables,
        missingTables,
        appliedHashes: appliedCount,
        localHashes: migrations.length,
        storage: journal,
      };
    }

    return {
      status: "drift-manual",
      expectedTables,
      missingTables,
      appliedHashes: appliedCount,
      localHashes: migrations.length,
      storage: journal,
    };
  });
}
