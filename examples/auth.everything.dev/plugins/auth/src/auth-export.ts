import type { Auth as BetterAuthResult } from "better-auth";
import type { DualNetworkConfig, SubAccountConfig } from "better-near-auth";
import type { InferInput, InferOutput } from "./contract";
import type { Database as AuthDatabase } from "./db";

export type Auth = BetterAuthResult;
export type { Auth as BaseAuth } from "better-auth";

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

export interface AuthPasskeyConfig {
  rpID?: string;
  rpName?: string;
  origin?: string;
}

export interface AuthSiwnBaseConfig {
  apiKey?: string;
  rpcUrl?: string;
  relayer?: {
    accountId?: string;
    privateKey?: string;
  };
  subAccount?: SubAccountConfig | DualNetworkConfig<SubAccountConfig>;
  secrets?: {
    parentKey?: string | DualNetworkConfig<string>;
  };
}

export interface AuthSiwnRecipientConfig extends AuthSiwnBaseConfig {
  recipient: string;
  recipients?: never;
}

export interface AuthSiwnRecipientsConfig extends AuthSiwnBaseConfig {
  recipient?: never;
  recipients: {
    mainnet: string;
    testnet: string;
  };
}

export type AuthSiwnConfig = AuthSiwnRecipientConfig | AuthSiwnRecipientsConfig;

export interface AuthConfig {
  secret: string;
  baseUrl: string;
  trustedOrigins?: string[];
  isProduction?: boolean;
  socialProviders?: {
    github?: {
      clientId?: string;
      clientSecret?: string;
    };
    google?: {
      clientId?: string;
      clientSecret?: string;
    };
  };
  passkey?: AuthPasskeyConfig;
  phoneNumber?: {
    twilio?: {
      accountSid: string;
      authToken: string;
      phoneNumber: string;
    };
  };
  siwn: AuthSiwnConfig;
  email?: {
    from: string;
  };
}

export type { AuthDatabase };

export type createAuthInstance = (config: AuthConfig, db: AuthDatabase) => Auth;

export interface AuthServices {
  auth: Auth;
  db: AuthDatabase;
  handler: (req: Request) => Promise<Response>;
}
