import { publicProcedure, protectedProcedure } from "../lib/orpc";
import { plugins } from "../lib/plugins";

export const appRouter = publicProcedure.router({
  health: publicProcedure.handler(() => ({
    status: "ok",
    server: "server-1",
  })),

  federated: protectedProcedure.router(plugins.federated.router),
});

export type AppRouter = typeof appRouter;
