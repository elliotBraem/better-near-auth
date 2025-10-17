import {
  protectedProcedure, publicProcedure,
  router,
} from "../lib/trpc";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "hello world! this is data coming from a protected procedure on your server",
      user: ctx.session.user,
    };
  }),
});

export type AppRouter = typeof appRouter;
