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
import { getAccount, getHostUrl, getNetworkId, getRuntimeConfig } from "@/app";
import type { createAuthInstance } from "../auth-types.gen";

export function isAuthAvailable(): boolean {
  return getRuntimeConfig().authAvailable !== false;
}

function createAuthClient() {
  return createBetterAuthClient({
    baseURL: getHostUrl(),
    fetchOptions: { credentials: "include" },
    plugins: [
      inferAdditionalFields<typeof createAuthInstance>(),
      siwnClient({
        recipient: getAccount(),
        networkId: getNetworkId(),
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

export function getAuthClient() {
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
