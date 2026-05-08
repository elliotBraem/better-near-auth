import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";
import {
  adminClient,
  anonymousClient,
  inferAdditionalFields,
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient as createBetterAuthClient } from "better-auth/react";
import { siwnClient } from "better-near-auth/client";
import type { ClientRuntimeConfig } from "@/app";
import { getAccount, getHostUrl, getNetworkId } from "@/app";
import type { createAuthInstance } from "../auth-types.gen";

function createAuthClient(config?: Partial<ClientRuntimeConfig>) {
  return createBetterAuthClient({
    baseURL: getHostUrl(config),
    fetchOptions: { credentials: "include" },
    plugins: [
      inferAdditionalFields<typeof createAuthInstance>(),
      siwnClient({
        recipient: getAccount(config),
        networkId: getNetworkId(config),
      }),
      adminClient(),
      anonymousClient(),
      phoneNumberClient(),
      passkeyClient(),
      organizationClient(),
      apiKeyClient(),
    ],
  });
}

let _authClient: ReturnType<typeof createAuthClient> | undefined;

export function getAuthClient(config?: Partial<ClientRuntimeConfig>) {
  if (config) {
    return createAuthClient(config);
  }
  if (_authClient === undefined) {
    _authClient = createAuthClient();
  }
  return _authClient;
}

export type AuthClient = ReturnType<typeof createAuthClient>;
export type SessionData = AuthClient["$Infer"]["Session"];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Passkey {
  id: string;
  name?: string;
  createdAt?: Date;
}
