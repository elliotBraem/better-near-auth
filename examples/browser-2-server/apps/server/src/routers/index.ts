import {
  protectedProcedure,
  publicProcedure,
} from "../lib/orpc";

export const appRouter = publicProcedure.router({
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "hello world! this is data coming from a protected procedure on your server",
      user: context.session.user,
    };
  }),
});

export type AppRouter = typeof appRouter;
