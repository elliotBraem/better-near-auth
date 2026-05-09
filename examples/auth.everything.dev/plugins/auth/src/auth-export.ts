import type { Auth } from "better-auth";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type { Auth } from "better-auth";

export type AuthSession = Auth["$Infer"]["Session"];

export interface AuthConfig {
  secret: string;
  baseUrl: string;
  account: string;
  trustedOrigins?: string[];
  githubClientId?: string;
  githubClientSecret?: string;
  fastnearApiKey?: string;
  nearRpcUrl?: string;
  isProduction?: boolean;
}

export type AuthDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

export interface DatabaseDriver {
  readonly db: AuthDatabase;
  close(): Promise<void>;
}

export type createAuthInstance = (config: AuthConfig, db: AuthDatabase) => Auth;

export interface AuthServices {
  auth: Auth;
  db: AuthDatabase;
  driver: DatabaseDriver;
  handler: (req: Request) => Promise<Response>;
}
