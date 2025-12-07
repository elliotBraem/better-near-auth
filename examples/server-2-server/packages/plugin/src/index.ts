import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

import { contract } from "./contract";
import { FederatedService } from "./service";

export default createPlugin({
  variables: z.object({
    serverName: z.string().default("server"),
    targetServerUrl: z.string().url().optional(),
    targetRecipient: z.string().optional(),
    networkId: z.enum(["mainnet", "testnet"]).default("testnet"),
  }),

  secrets: z.object({
    accountId: z.string().min(1, "NEAR account ID is required"),
    privateKey: z.string().min(1, "NEAR private key is required"),
  }),

  contract,

  initialize: (config) =>
    Effect.gen(function* () {
      const service = new FederatedService({
        serverName: config.variables.serverName,
        accountId: config.secrets.accountId,
        privateKey: config.secrets.privateKey,
        networkId: config.variables.networkId,
        targetServerUrl: config.variables.targetServerUrl,
        targetRecipient: config.variables.targetRecipient,
      });

      yield* service.ping();
      console.log(`[${config.variables.serverName}] Federated plugin initialized as ${config.secrets.accountId}`);

      return { service };
    }),

  shutdown: () => Effect.void,

  createRouter: (context, builder) => {
    const { service } = context;

    return {
      ping: builder.ping.handler(async () => {
        return await Effect.runPromise(service.ping());
      }),

      getIdentity: builder.getIdentity.handler(async () => {
        return await Effect.runPromise(service.getIdentity());
      }),

      callTarget: builder.callTarget.handler(async ({ input }) => {
        return await Effect.runPromise(service.callTarget(input.endpoint));
      }),
    };
  },
});
