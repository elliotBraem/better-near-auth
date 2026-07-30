import type { Auth as BetterAuthResult } from "better-auth";
import type { Auth as ConfiguredAuth } from "./auth-instance";
import type { InferInput, InferOutput } from "./contract";
import type { Database as AuthDatabase } from "./db";

export type Auth = BetterAuthResult;
export type { Auth as BaseAuth } from "better-auth";
export type {
  AuthConfig,
  AuthPasskeyConfig,
  AuthSiwnBaseConfig,
  AuthSiwnConfig,
  AuthSiwnRecipientConfig,
  AuthSiwnRecipientsConfig,
} from "./auth-config";

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
export type AuthAllOrganization = InferOutput<"listAllOrganizations">[number];
export type AuthAllOrganizations = InferOutput<"listAllOrganizations">;

export type GetActiveMemberInput = InferInput<"getActiveMember">;
export type GetOrganizationInput = InferInput<"getOrganization">;
export type ListMembersInput = InferInput<"listMembers">;
export type ListInvitationsInput = InferInput<"listInvitations">;
export type ListApiKeysInput = InferInput<"listApiKeys">;

export type { createAuthInstance } from "./auth-instance";
export type { AuthDatabase };

export interface AuthServices {
  auth: ConfiguredAuth;
  db: AuthDatabase;
  handler: (req: Request) => Promise<Response>;
  apiKeyHeaders: string[];
}
