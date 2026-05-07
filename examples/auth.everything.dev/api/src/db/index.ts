import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export const createDatabase = (url: string, authToken?: string) => {
  const client = createClient({
    url,
    authToken,
  });

  return { db: drizzle({ client, schema }), client };
};

export type Database = ReturnType<typeof createDatabase>["db"];
