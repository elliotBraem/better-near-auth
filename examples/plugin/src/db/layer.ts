import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

type Schema = typeof schema;

export type AuthDatabase = LibSQLDatabase<Schema>;

interface DatabaseWithClient {
  db: AuthDatabase;
  client: Client;
}

export const createAuthDatabase = (url: string, authToken?: string): DatabaseWithClient => {
  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema: { ...schema } });
  return { db, client };
};

export type Database = AuthDatabase;
