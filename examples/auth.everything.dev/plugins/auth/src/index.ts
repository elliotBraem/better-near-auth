import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { z } from "every-plugin/zod";

export type { AuthServices } from "./auth-export";

import { createAuthInstance } from "./auth-instance";
import { normalizeAuthConfig } from "./config";
import { authSecretsSchema, authVariablesSchema } from "./config-schemas";
import { contract } from "./contract";
import { DatabaseLive, DatabaseTag } from "./db/layer";
import { createApiKeyHandlers } from "./handlers/api-keys";
import { createInvitationHandlers } from "./handlers/invitations";
import { createMemberHandlers } from "./handlers/members";
import { createNearHandlers } from "./handlers/near";
import { createOrganizationHandlers } from "./handlers/organizations";
import { createSessionHandlers } from "./handlers/session";
import { createTeamHandlers } from "./handlers/teams";
import type { PluginsClient } from "./lib/plugins-types.gen";
import { createRequireAuth } from "./middleware";
import { toError } from "./utils";

export default createPlugin.withPlugins<PluginsClient>()({
  variables: authVariablesSchema,

  secrets: authSecretsSchema,

  context: z.object({
    reqHeaders: z.record(z.string(), z.string()).optional(),
  }),

  contract,

  initialize: (config, _plugins, tools) =>
    Effect.gen(function* () {
      const db = yield* tools.buildService(
        DatabaseTag,
        DatabaseLive(config.secrets.AUTH_DATABASE_URL),
      );

      const { authConfig, apiKeyHeaders } = normalizeAuthConfig(config.variables, config.secrets);

      const auth = createAuthInstance(authConfig, db, {
        email: { resend: config.secrets.RESEND_API_KEY },
      });

      console.log("[Auth] Better Auth instance created");

      return {
        auth,
        db,
        handler: (req: Request) => auth.handler(req),
        apiKeyHeaders,
      };
    }).pipe(Effect.mapError((e) => toError(e))),

  shutdown: () =>
    Effect.sync(() => {
      console.log("[Auth] Shutdown");
    }),

  createRouter: (services, builder) => {
    const requireAuth = createRequireAuth(builder, services);

    return {
      ...createSessionHandlers(services, builder),
      ...createOrganizationHandlers(services, builder, requireAuth),
      ...createMemberHandlers(services, builder, requireAuth),
      ...createInvitationHandlers(services, builder, requireAuth),
      ...createApiKeyHandlers(services, builder, requireAuth),
      ...createTeamHandlers(services, builder, requireAuth),
      ...createNearHandlers(services, builder, requireAuth),
    };
  },
});
