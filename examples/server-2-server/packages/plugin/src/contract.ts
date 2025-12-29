import { CommonPluginErrors } from "every-plugin";
import { oc } from "every-plugin/orpc";
import { z } from "every-plugin/zod";

export const contract = oc.router({
  ping: oc
    .route({
      method: "GET",
      path: "/ping",
      summary: "Health check",
      tags: ["Health"],
    })
    .output(
      z.object({
        status: z.literal("ok"),
        server: z.string(),
        accountId: z.string(),
        timestamp: z.string().datetime(),
      })
    )
    .errors(CommonPluginErrors),

  callTarget: oc
    .route({
      method: "POST",
      path: "/call-target",
      summary: "Call the target server",
      description: "Makes an authenticated call to the configured target server",
      tags: ["Federation"],
    })
    .input(
      z.object({
        endpoint: z.string().default("/ping"),
      })
    )
    .output(
      z.object({
        calledFrom: z.string(),
        targetResponse: z.any(),
      })
    )
    .errors(CommonPluginErrors),

  getIdentity: oc
    .route({
      method: "GET",
      path: "/identity",
      summary: "Get this server's NEAR identity",
      tags: ["Identity"],
    })
    .output(
      z.object({
        accountId: z.string(),
        publicKey: z.string(),
        networkId: z.string(),
      })
    )
    .errors(CommonPluginErrors),
});
