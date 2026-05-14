import { createPlugin } from "every-plugin";
import { Effect } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import type { PluginsClient } from "./lib/plugins-types.gen";
import { contract } from "./contract";
import { createDatabase } from "./db";
import { migrate } from "./db/migrator";

type ApiPluginsClient = PluginsClient;

export interface AuthContext {
  userId: string;
  user: {
    id: string;
    role?: string;
    email?: string;
    name?: string;
  };
  organizationId?: string;
  reqHeaders?: Record<string, string>;
}

function _createHeaders(reqHeaders?: Record<string, string>): Headers {
  return new Headers(Object.entries(reqHeaders ?? {}) as [string, string][]);
}

export default createPlugin.withPlugins<ApiPluginsClient>()({
  variables: z.object({}),

  secrets: z.object({
    API_DATABASE_URL: z.string().default("pglite:.bos/api/:memory:"),
  }),

  context: z.object({
    userId: z.string().optional(),
    user: z
      .object({
        id: z.string(),
        role: z.string().optional(),
        email: z.string().optional(),
        name: z.string().optional(),
      })
      .optional(),
    organizationId: z.string().optional(),
    reqHeaders: z.custom<Record<string, string>>().optional(),
  }),

  contract,

  initialize: (config, plugins) =>
    Effect.gen(function* () {
      const driver = yield* Effect.acquireRelease(
        Effect.promise(() => createDatabase(config.secrets.API_DATABASE_URL)),
        (driver) => Effect.promise(() => driver.close()),
      );

      const migrations = yield* Effect.promise(() => import("virtual:drizzle-migrations.sql"));
      yield* Effect.promise(() => migrate(driver.db, migrations.default));
      console.log("[API] Migrations applied");

      const { auth, ...restPlugins } = plugins;
      console.log("[API] Services Initialized");
      console.log("[API] Auth client available:", Boolean(auth));
      console.log("[API] Plugins available:", Object.keys(restPlugins).join(", ") || "none");
      return { auth, plugins: restPlugins, db: driver.db, driver };
    }),

  shutdown: () => Effect.log("[API] Shutdown"),

  createRouter: (_services, builder) => {
    const requireAuth = builder.middleware(async ({ context, next }) => {
      if (!context.user || !context.userId) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "Authentication required",
          data: {
            authType: "session",
            hint: "Sign in with NEAR, passkey, email, phone, or anonymous",
          },
        });
      }
      return next({
        context: {
          userId: context.userId,
          user: context.user,
          organizationId: context.organizationId,
          reqHeaders: context.reqHeaders,
        } as AuthContext,
      });
    });

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
          message: "This data is only accessible to authenticated users via your server session",
          userId: context.userId,
          sessionId: null,
          expiresAt: null,
        };
      }),
    };
  },
});
