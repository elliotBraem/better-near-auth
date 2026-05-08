import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.AUTH_DATABASE_URL || "pglite:./auth-local.db",
  },
  verbose: true,
  strict: true,
});
