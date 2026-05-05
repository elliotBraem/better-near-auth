import { type Client } from "@libsql/client";
import { type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
type Schema = typeof schema;
export type AuthDatabase = LibSQLDatabase<Schema>;
interface DatabaseWithClient {
    db: AuthDatabase;
    client: Client;
}
export declare const createAuthDatabase: (url: string, authToken?: string) => DatabaseWithClient;
export type Database = AuthDatabase;
export {};
