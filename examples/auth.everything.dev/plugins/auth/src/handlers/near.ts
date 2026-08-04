import type { PluginServices } from "../service-types";
import { createHeaders, safeAuthApi } from "../utils";

export function createNearHandlers(services: PluginServices, builder: any, requireAuth: any) {
  return {
    nearNonce: builder.nearNonce.handler(async ({ input }: { input: any }) => {
      return safeAuthApi(() =>
        services.auth.api.getSiwnNonce({
          body: { accountId: input.accountId, networkId: input.networkId },
        }),
      );
    }),

    nearVerify: builder.nearVerify.handler(
      async ({ input, context }: { input: any; context: any }) => {
        const req = new Request("http://localhost:3000/api/auth/near/verify", {
          method: "POST",
          headers: createHeaders(context.reqHeaders),
          body: JSON.stringify(input),
        });
        return safeAuthApi(() =>
          services.auth.api.verifySiwnMessage({
            request: req,
            body: {
              signedMessage: input.signedMessage,
              message: input.message,
              recipient: input.recipient,
              nonce: input.nonce,
              accountId: input.accountId,
            },
          }),
        );
      },
    ),

    nearProfile: builder.nearProfile
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.getSiwnProfile({
            headers: createHeaders(context.reqHeaders),
            body: { accountId: input.accountId },
          }),
        );
      }),

    nearLinkAccount: builder.nearLinkAccount
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const reqHeaders = createHeaders(context.reqHeaders);
        const req = new Request("http://localhost:3000/api/auth/near/link", {
          method: "POST",
          headers: reqHeaders,
          body: JSON.stringify(input),
        });
        return safeAuthApi(() =>
          services.auth.api.linkNearAccount({
            request: req,
            headers: reqHeaders,
            body: {
              signedMessage: input.signedMessage,
              message: input.message,
              recipient: input.recipient,
              nonce: input.nonce,
              accountId: input.accountId,
            },
          }),
        );
      }),

    nearUnlinkAccount: builder.nearUnlinkAccount
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.unlinkNearAccount({
            headers: createHeaders(context.reqHeaders),
            body: { accountId: input.accountId, network: input.network },
          }),
        );
      }),

    nearListAccounts: builder.nearListAccounts
      .use(requireAuth)
      .handler(async ({ context }: { context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.listNearAccounts({
            headers: createHeaders(context.reqHeaders),
          }),
        );
      }),

    nearRelay: builder.nearRelay
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.relayNearTransaction({
            headers: createHeaders(context.reqHeaders),
            body: { payload: input.payload },
          }),
        );
      }),

    nearRelayStatus: builder.nearRelayStatus
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.getRelayStatus({
            headers: createHeaders(context.reqHeaders),
            params: { txHash: input.txHash },
          }),
        );
      }),

    nearRelayerInfo: builder.nearRelayerInfo
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.getRelayerInfo({
            headers: createHeaders(context.reqHeaders),
            body: input ?? {},
          }),
        );
      }),

    nearRelayHistory: builder.nearRelayHistory
      .use(requireAuth)
      .handler(async ({ context }: { context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.getRelayHistory({
            headers: createHeaders(context.reqHeaders),
          }),
        );
      }),

    nearView: builder.nearView
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.viewContract({
            headers: createHeaders(context.reqHeaders),
            body: { contractId: input.contractId, methodName: input.methodName, args: input.args },
          }),
        );
      }),

    nearCheckSubAccountAvailability: builder.nearCheckSubAccountAvailability
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.checkSubAccountAvailability({
            headers: createHeaders(context.reqHeaders),
            body: { subAccountName: input.subAccountName, network: input.network },
          }),
        );
      }),

    nearCreateSubAccount: builder.nearCreateSubAccount
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        return safeAuthApi(() =>
          services.auth.api.createSubAccount({
            headers: createHeaders(context.reqHeaders),
            body: {
              subAccountName: input.subAccountName,
              publicKey: input.publicKey,
              network: input.network,
            },
          }),
        );
      }),
  };
}
