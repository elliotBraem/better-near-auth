import { Context, Effect, Layer } from "every-plugin/effect";
import { getMigrationSlug, getMigrationStorage } from "everything-dev/db";
import { createDatabaseDriver, type Database, DatabaseError } from "./index";
import { detectDrift, loadMigrations, migrate } from "./migrate";

export class DatabaseTag extends Context.Tag("Database")<Database, Database>() {}

export const DatabaseLive = (url: string) =>
  Layer.scoped(
    DatabaseTag,
    Effect.gen(function* () {
      const driver = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () => createDatabaseDriver(url),
          catch: (cause) => new DatabaseError({ stage: "driver", cause }),
        }),
        (driver) =>
          Effect.tryPromise({
            try: () => driver.close(),
            catch: (cause) => new DatabaseError({ stage: "close", cause }),
          }).pipe(Effect.ignore),
      );

      const storage = getMigrationStorage(getMigrationSlug(import.meta.dirname));
      const { migrations, source } = yield* loadMigrations();

      if (migrations.length === 0) {
        yield* Effect.logWarning(
          `[Database] No migrations found (source: ${source}) — schema may be missing`,
        );
      } else {
        const applied = yield* migrate(driver.db, migrations, storage);

        if (applied === 0) {
          yield* Effect.logInfo(
            `[Database] Schema up to date (0 migrations needed, source: ${source})`,
          );
        } else {
          yield* Effect.logInfo(
            `[Database] Applied ${applied}/${migrations.length} migration(s) (source: ${source}, journal: ${storage.schema}.${storage.table})`,
          );
        }

        const drift = yield* detectDrift(driver.db, migrations, storage);
        if (drift.status === "healthy" || drift.status === "untracked-existing-schema") {
          yield* Effect.logInfo(`[Database] Ready`);
        } else if (drift.status === "drift-safe-repair") {
          yield* Effect.logWarning(
            `[Database] ⚠️ Migration drift detected: ${drift.missingTables.length} expected table(s) missing: ${drift.missingTables.join(", ")}`,
          );
          yield* Effect.logWarning(
            `[Database] Run \`bos db doctor ${storage.slug}\` to diagnose and \`bos db repair ${storage.slug}\` to fix.`,
          );
          throw new DatabaseError({
            stage: "migration",
            migrationTag: "drift-safe-repair",
            cause: new Error(
              `Migration journal has ${drift.appliedHashes} applied hashes but all ${drift.expectedTables.length} expected table(s) are missing. ` +
                `Run \`bos db repair ${storage.slug}\` to reset the migration history and reapply migrations. ` +
                `Missing tables: ${drift.missingTables.join(", ")}`,
            ),
          });
        }
        if (drift.status === "drift-manual") {
          yield* Effect.logWarning(
            `[Database] ⚠️ Partial migration drift detected: ${drift.missingTables.length}/${drift.expectedTables.length} expected table(s) missing.`,
          );
          throw new DatabaseError({
            stage: "migration",
            migrationTag: "drift-manual",
            cause: new Error(
              `Partial schema drift — ${drift.missingTables.length}/${drift.expectedTables.length} expected table(s) are missing. ` +
                `Run \`bos db doctor ${storage.slug}\` for details. Manual intervention required. ` +
                `Missing tables: ${drift.missingTables.join(", ")}`,
            ),
          });
        }
      }

      return driver.db;
    }),
  );
