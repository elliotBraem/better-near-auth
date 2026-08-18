import type {
  DualNetworkConfig,
  RelayerDualNetworkConfig,
  SubAccountConfig,
} from "better-near-auth";

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
