import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "turso",
  dbCredentials: {
    url: process.env.AUTH_DATABASE_URL || "file:./auth.db",
    authToken: process.env.AUTH_DATABASE_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
