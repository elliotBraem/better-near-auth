import type { Auth as BetterAuthResult } from "better-auth";
import type {
  DualNetworkConfig,
  RelayerDualNetworkConfig,
  SubAccountConfig,
} from "better-near-auth";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { InferInput, InferOutput } from "./contract";

export type Auth = BetterAuthResult;
export type { Auth as BaseAuth } from "better-auth";

export interface AuthPasskeyConfig {
  rpID?: string;
  rpName?: string;
  origin?: string;
}

export interface AuthSiwnBaseConfig {
  apiKey?: string;
  rpcUrl?: string;
  relayer?: RelayerDualNetworkConfig;
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

export type AuthDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

export type AuthOrganizationContext = InferOutput<"getContext">["organization"];
export type AuthOrganization = NonNullable<InferOutput<"getFullOrganization">>;
export type AuthOrganizationSummary = NonNullable<AuthOrganizationContext["organization"]>;
export type AuthOrganizationMember = InferOutput<"listMembers">["members"][number];
export type AuthApiKey = InferOutput<"listApiKeys">[number];
export type AuthInvitation = InferOutput<"listInvitations">[number];
export type AuthTeam = InferOutput<"listTeams">[number];

export type GetActiveMemberInput = InferInput<"getActiveMember">;
export type GetFullOrganizationInput = InferInput<"getFullOrganization">;
export type ListMembersInput = InferInput<"listMembers">;
export type ListInvitationsInput = InferInput<"listInvitations">;
export type ListApiKeysInput = InferInput<"listApiKeys">;

export type createAuthInstance = (config: AuthConfig, db: AuthDatabase) => Auth;

export interface AuthServices {
  auth: Auth;
  db: AuthDatabase;
  handler: (req: Request) => Promise<Response>;
  apiKeyHeaders: string[];
}
