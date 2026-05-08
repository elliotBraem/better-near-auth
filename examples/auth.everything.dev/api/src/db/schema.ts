import { pgTable, text } from "drizzle-orm/pg-core";

export const sample = pgTable("sample", {
  id: text("id").primaryKey(),
});
