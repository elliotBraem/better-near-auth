import { defineConfig } from "drizzle-kit";
import { getDatabaseUrlSecretName, getMigrationSlug, getMigrationStorage } from "everything-dev/db";

const slug = getMigrationSlug(import.meta.dirname);
const databaseSecret = getDatabaseUrlSecretName(slug);
const storage = getMigrationStorage(slug);
const isDrizzleKit = process.argv[1]?.includes("drizzle-kit");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env[databaseSecret] ??
      (process.env.NODE_ENV === "production" && isDrizzleKit
        ? (() => {
            throw new Error(
              `Missing ${databaseSecret} — required in production for drizzle-kit operations`,
            );
          })()
        : `pglite:.bos/${slug}/:memory:`),
  },
  migrations: {
    schema: storage.schema,
    table: storage.table,
  },
  verbose: true,
  strict: true,
});
