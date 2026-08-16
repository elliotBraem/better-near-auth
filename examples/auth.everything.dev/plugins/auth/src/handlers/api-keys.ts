import { ORPCError } from "every-plugin/orpc";
import { API_KEY_CONFIG_IDS } from "../config-schemas";
import type { PluginServices } from "../service-types";
import { createHeaders, safeAuthApi } from "../utils";

export function createApiKeyHandlers(services: PluginServices, builder: any, requireAuth: any) {
  return {
    listApiKeys: builder.listApiKeys
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const queryParams = ["organizationId", "limit", "offset", "sortBy", "sortDirection"];
        const query: Record<string, string | number> = {};
        for (const key of queryParams) {
          if (input?.[key] !== undefined) {
            query[key] = input[key] as string | number;
          }
        }

        const result = await safeAuthApi(() =>
          services.auth.api.listApiKeys({
            headers: createHeaders(context.reqHeaders),
            query: Object.keys(query).length > 0 ? query : undefined,
          }),
        );
        return result.apiKeys ?? [];
      }),

    createApiKey: builder.createApiKey
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const configId = input.configId ?? (input.organizationId ? "org-keys" : "user-keys");
        const result = await safeAuthApi(() =>
          services.auth.api.createApiKey({
            body: {
              userId: context.userId,
              configId,
              name: input.name,
              prefix: input.prefix,
              expiresIn: input.expiresIn,
              permissions: input.permissions,
              metadata: input.metadata,
              organizationId: input.organizationId,
              rateLimitEnabled: input.rateLimit?.enabled,
              rateLimitMax: input.rateLimit?.max,
              rateLimitTimeWindow: input.rateLimit?.timeWindow,
            },
          }),
        );
        return result;
      }),

    updateApiKey: builder.updateApiKey
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const configId = input.configId ?? (input.organizationId ? "org-keys" : "user-keys");
        const result = await safeAuthApi(() =>
          services.auth.api.updateApiKey({
            body: {
              userId: context.userId,
              configId,
              keyId: input.id,
              name: input.name,
              enabled: input.enabled,
              permissions: input.permissions,
              metadata: input.metadata,
              expiresIn: input.expiresIn,
              rateLimitEnabled: input.rateLimit?.enabled,
              rateLimitMax: input.rateLimit?.max,
              rateLimitTimeWindow: input.rateLimit?.timeWindow,
            },
          }),
        );
        return result;
      }),

    deleteApiKey: builder.deleteApiKey
      .use(requireAuth)
      .handler(async ({ input, context }: { input: any; context: any }) => {
        const configId = input.configId ?? (input.organizationId ? "org-keys" : "user-keys");
        try {
          await safeAuthApi(() =>
            services.auth.api.deleteApiKey({
              headers: createHeaders(context.reqHeaders),
              body: { keyId: input.id, configId },
            }),
          );
          return { success: true };
        } catch (firstError) {
          if (firstError instanceof ORPCError && firstError.code !== "NOT_FOUND") {
            throw firstError;
          }
          for (const fallbackConfigId of API_KEY_CONFIG_IDS) {
            if (fallbackConfigId === configId) continue;
            try {
              await safeAuthApi(() =>
                services.auth.api.deleteApiKey({
                  headers: createHeaders(context.reqHeaders),
                  body: { keyId: input.id, configId: fallbackConfigId },
                }),
              );
              return { success: true };
            } catch {}
          }
          throw new ORPCError("NOT_FOUND", { message: "API key not found" });
        }
      }),

    verifyApiKey: builder.verifyApiKey.handler(
      async ({ input, context }: { input: any; context: any }) => {
        if (input.configId) {
          const result = await safeAuthApi(() =>
            services.auth.api.verifyApiKey({
              headers: createHeaders(context.reqHeaders),
              body: {
                key: input.key,
                configId: input.configId,
                permissions: input.permissions,
              },
            }),
          );
          return {
            valid: result.valid,
            error: result.error
              ? {
                  code: result.error.code ?? "UNKNOWN",
                  message:
                    typeof result.error.message === "string" ? result.error.message : undefined,
                }
              : null,
            key: result.key ? { ...result.key, permissions: result.key.permissions ?? null } : null,
          };
        }

        for (const configId of API_KEY_CONFIG_IDS) {
          const result = await safeAuthApi(() =>
            services.auth.api.verifyApiKey({
              headers: createHeaders(context.reqHeaders),
              body: { key: input.key, configId, permissions: input.permissions },
            }),
          );
          if (result.valid) {
            return {
              valid: true,
              error: null,
              key: result.key
                ? { ...result.key, permissions: result.key.permissions ?? null }
                : null,
            };
          }
        }
        return {
          valid: false,
          error: { code: "KEY_NOT_FOUND", message: "Invalid API key" },
          key: null,
        };
      },
    ),
  };
}
