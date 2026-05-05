import {
  protectedProcedure,
  publicProcedure,
} from "../lib/orpc";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => 'OK'),
  privateData: protectedProcedure.handler(({ context }) => {
    const session = context.session;
    return {
      message: "This data is only accessible to authenticated users via your server session",
      sessionId: session.session.id,
      userId: session.user.id,
      expiresAt: session.session.expiresAt,
    }
  })
}

export type AppRouter = typeof appRouter;
