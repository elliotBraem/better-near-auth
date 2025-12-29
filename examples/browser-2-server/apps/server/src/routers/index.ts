import {
  protectedProcedure,
  publicProcedure,
} from "../lib/orpc";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => 'OK'),
  privateData: protectedProcedure.handler(({ context }) => {
    return {
      message: "hello world! this is data coming from a protected procedure on your server"
    }
  })
}

export type AppRouter = typeof appRouter;
