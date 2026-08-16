import type { AuthServices } from "./auth-export";
import type { Auth as ConfiguredAuth } from "./auth-instance";
import type { Database } from "./db";

export type PluginServices = Omit<AuthServices, "auth" | "db"> & {
  auth: ConfiguredAuth;
  db: Database;
};
