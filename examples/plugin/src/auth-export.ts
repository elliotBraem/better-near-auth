import type {} from "@simplewebauthn/server";
import type {} from "better-auth";
import type {} from "zod/v4/core";

export type { Auth, AuthSession, createAuthInstance } from "./auth-instance";

export interface AuthServices {
  auth: import("./auth-instance").Auth;
  db: import("./db/layer").AuthDatabase;
  handler: (req: Request) => Promise<Response>;
}
