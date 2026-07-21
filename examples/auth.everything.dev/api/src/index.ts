import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";
import { contract } from "./contract";
import { DatabaseLive, DatabaseTag } from "./db/layer";
import { createAuthMiddleware } from "./lib/auth";
import { ContextSchema } from "./lib/context";
import type { PluginsClient } from "./lib/plugins-types.gen";

export default createPlugin.withPlugins<PluginsClient>()({
  variables: z.object({}),

  secrets: z.object({
    API_DATABASE_URL: z.string().default("pglite:.bos/api/:memory:"),
  }),

  context: ContextSchema,

  contract,

  initialize: (config, plugins) =>
    Effect.gen(function* () {
      const db = yield* DatabaseTag;
      const { auth, ...restPlugins } = plugins;
      console.log("[API] Services Initialized");
      console.log("[API] Auth client available:", Boolean(auth));
      console.log("[API] Plugins available:", Object.keys(restPlugins).join(", ") || "none");
      return { auth, plugins: restPlugins, db };
    }).pipe(Effect.provide(DatabaseLive(config.secrets.API_DATABASE_URL))),

  shutdown: () => Effect.log("[API] Shutdown"),

  createRouter: (_services, builder) => {
    const { requireAuth } = createAuthMiddleware(builder);

    return {
      ping: builder.ping.handler(async () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
      })),

      authHealth: builder.authHealth.use(requireAuth).handler(async () => ({
        status: "ok",
        emailConfigured: !!process.env.EMAIL_PROVIDER,
        smsConfigured: !!process.env.SMS_PROVIDER,
      })),

      privateData: builder.privateData.use(requireAuth).handler(async ({ context }) => {
        return {
          message: "Authenticated request context resolved",
          userId: context.userId ?? null,
          organizationId: context.organization?.activeOrganizationId ?? null,
          apiKeyId: context.apiKey?.id ?? null,
        };
      }),
    };
  },
});
