/**
 * Effect context bridge — converts Effect errors to ORPCError for handler use.
 *
 * BE CAREFUL MODIFYING THIS FILE — changes will be overwritten by `bos sync` / `bos upgrade`.
 * Prefer upstream changes at https://github.com/nearbuilders/everything-dev
 */

import { Cause, Effect, Exit } from "every-plugin/effect";
import { ORPCError } from "every-plugin/orpc";
import { z } from "every-plugin/zod";
import type { AuthContext } from "./auth";

export const ContextSchema = z.custom<AuthContext>();

export type Context = AuthContext;

export function flattenError(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.message];
    let cause: unknown = error.cause;
    while (cause instanceof Error) {
      parts.push(cause.message);
      cause = cause.cause;
    }
    return parts.join(": ");
  }
  return String(error);
}

export async function runEffect<A>(effect: Effect.Effect<A, unknown>) {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    const squashed = Cause.squash(exit.cause);
    if (squashed instanceof ORPCError) {
      throw squashed;
    }

    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: flattenError(squashed),
    });
  }

  return exit.value;
}
