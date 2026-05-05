import type {} from "@simplewebauthn/server";
import type {} from "better-auth";
import type {} from "zod/v4/core";

export type { Auth, AuthSession, createAuthInstance } from "./auth-instance";
export type { ContractType } from "./contract";
export type { DatabaseDriver, AuthDatabase } from "./db/driver";

export interface AuthServices {
  auth: import("./auth-instance").Auth;
  db: import("./db/driver").AuthDatabase;
  driver: import("./db/driver").DatabaseDriver;
  handler: (req: Request) => Promise<Response>;
}
