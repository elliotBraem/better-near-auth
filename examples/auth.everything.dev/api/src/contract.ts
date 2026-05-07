import { UNAUTHORIZED } from "every-plugin/errors";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const contract = oc.router({
  ping: oc.route({ method: "GET", path: "/ping" }).output(
    z.object({
      status: z.literal("ok"),
      timestamp: z.iso.datetime(),
    }),
  ),

  authHealth: oc
    .route({ method: "GET", path: "/auth/health" })
    .output(
      z.object({
        status: z.string(),
        emailConfigured: z.boolean(),
        smsConfigured: z.boolean(),
      }),
    )
    .errors({ UNAUTHORIZED }),

  privateData: oc
    .route({ method: "GET", path: "/private" })
    .output(
      z.object({
        message: z.string(),
        userId: z.string(),
        sessionId: z.string().nullable(),
        expiresAt: z.string().nullable(),
      }),
    )
    .errors({ UNAUTHORIZED }),
});

export type ContractType = typeof contract;
