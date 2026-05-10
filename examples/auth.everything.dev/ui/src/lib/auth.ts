import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { useRouter } from "@tanstack/react-router";
import {
  adminClient,
  anonymousClient,
  inferAdditionalFields,
  organizationClient,
  phoneNumberClient,
} from "better-auth/client/plugins";
import { createAuthClient as createBetterAuthClient } from "better-auth/react";
import { siwnClient } from "better-near-auth/client";
import type { ClientRuntimeConfig } from "everything-dev/types";
import { getAccount, getHostUrl, getNetworkId } from "everything-dev/ui/runtime";
import type { Auth } from "./auth-types.gen";

export function createAuthClient(config?: Partial<ClientRuntimeConfig>) {
  return createBetterAuthClient({
    baseURL: getHostUrl(config),
    fetchOptions: { credentials: "include" },
    plugins: [
      inferAdditionalFields<Auth>(),
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
