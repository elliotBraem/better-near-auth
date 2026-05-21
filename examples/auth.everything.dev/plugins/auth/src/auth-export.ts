import type { Auth } from "better-auth";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { InferInput, InferOutput } from "./contract";

export type { Auth } from "better-auth";

export type AuthSession = Auth["$Infer"]["Session"];
export type AuthSessionData = InferOutput<"getSession">;
export type AuthSessionUser = NonNullable<AuthSessionData["user"]>;
export type AuthRequestContext = InferOutput<"getContext">;
export type AuthActiveMember = InferOutput<"getActiveMember">;
export type AuthOrganizationContext = AuthRequestContext["organization"];
export type AuthOrganization = NonNullable<InferOutput<"getOrganization">>;
export type AuthOrganizationSummary = NonNullable<AuthOrganizationContext["organization"]>;
export type AuthOrganizationMember = InferOutput<"listMembers">[number];
export type AuthApiKey = InferOutput<"listApiKeys">[number];
export type AuthInvitation = InferOutput<"listInvitations">[number];

export type GetActiveMemberInput = InferInput<"getActiveMember">;
export type GetOrganizationInput = InferInput<"getOrganization">;
export type ListMembersInput = InferInput<"listMembers">;
export type ListInvitationsInput = InferInput<"listInvitations">;
export type ListApiKeysInput = InferInput<"listApiKeys">;

export interface AuthConfig {
  secret: string;
  baseUrl: string;
  account: string;
  testnetAccount?: string;
  trustedOrigins?: string[];
  githubClientId?: string;
  githubClientSecret?: string;
  passkeyRpId?: string;
  passkeyRpName?: string;
  passkeyOrigin?: string;
  fastnearApiKey?: string;
  nearRpcUrl?: string;
  isProduction?: boolean;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
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
