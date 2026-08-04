import { ORPCError } from "every-plugin/orpc";
import type { PluginServices } from "./service-types";
import { createHeaders } from "./utils";

export function createRequireAuth(builder: any, services: PluginServices) {
  return builder.middleware(async ({ context, next }: { context: any; next: any }) => {
    const headers = createHeaders(context.reqHeaders);
    const session = await services.auth.api.getSession({ headers });

    if (!session?.user) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    return next({
      context: {
        userId: session.user.id,
        user: session.user,
        reqHeaders: context.reqHeaders,
      },
    });
  });
}
