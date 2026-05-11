import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  adminClient,
  anonymousClient,
  inferAdditionalFields,
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient as createBetterAuthClient } from "better-auth/react";
import type { RelayedTransactionT } from "better-near-auth";
import { siwnClient } from "better-near-auth/client";
import type { ClientRuntimeConfig } from "everything-dev/types";
import { getRuntimeConfig } from "everything-dev/ui/runtime";
import type { Auth } from "./auth-types.gen";

function readRuntimeConfig(config?: Partial<ClientRuntimeConfig>) {
  if (config) return config;
  if (typeof window === "undefined") return undefined;
  try {
    return getRuntimeConfig();
  } catch {
    return undefined;
  }
}

function getAccountId(config?: Partial<ClientRuntimeConfig>) {
  return readRuntimeConfig(config)?.account ?? "every.near";
}

function getNetworkId(config?: Partial<ClientRuntimeConfig>): "mainnet" | "testnet" {
  return (
    readRuntimeConfig(config)?.networkId ??
    (getAccountId(config).endsWith(".testnet") ? "testnet" : "mainnet")
  );
}

function getHostUrl(config?: Partial<ClientRuntimeConfig>) {
  const runtimeConfig = readRuntimeConfig(config);
  if (runtimeConfig?.hostUrl) return runtimeConfig.hostUrl;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function createAuthClient(config?: Partial<ClientRuntimeConfig>) {
  return createBetterAuthClient({
    baseURL: getHostUrl(config),
    fetchOptions: { credentials: "include" },
    plugins: [
      inferAdditionalFields<Auth>(),
      siwnClient({
        recipient: getAccountId(config),
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

export type AuthClient = ReturnType<typeof createAuthClient>;
type OrganizationListResult = Awaited<ReturnType<AuthClient["organization"]["list"]>>;
type PasskeyListResult = Awaited<ReturnType<AuthClient["passkey"]["listUserPasskeys"]>>;

export type SessionData = AuthClient["$Infer"]["Session"];
export type Organization = NonNullable<OrganizationListResult["data"]>[number];
export type Passkey = NonNullable<PasskeyListResult["data"]>[number];

export function useAuthClient(): AuthClient {
  return useRouter().options.context.authClient;
}

export const sessionQueryKey = ["session"] as const;

export function sessionQueryOptions(authClient: AuthClient, initialSession?: SessionData | null) {
  const baseOptions = {
    queryKey: sessionQueryKey,
    queryFn: async () => {
      const { data: session } = await authClient.getSession();
      return session ?? null;
    },
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  };

  return initialSession === undefined
    ? baseOptions
    : { ...baseOptions, initialData: initialSession };
}

export function useRelayHistory(session: SessionData | null | undefined, authClient: AuthClient) {
  return useQuery({
    queryKey: ["relay-history"],
    queryFn: async () => {
      const res = await authClient.near.relayHistory();
      return (res?.data?.transactions ?? []) as RelayedTransactionT[];
    },
    enabled: !!session,
    refetchInterval: 2000,
  });
}
