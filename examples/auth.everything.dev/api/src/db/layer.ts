import { Context, Effect, Layer } from "every-plugin/effect";
import { createDatabase, type Database } from "./index";

export class DatabaseTag extends Context.Tag("Database")<DatabaseTag, Database>() {}

export const DatabaseLive = (url: string) =>
  Layer.scoped(
    DatabaseTag,
    Effect.acquireRelease(
      Effect.promise(() => createDatabase(url)),
      (driver) => Effect.promise(() => driver.close()),
    ).pipe(Effect.map((driver) => driver.db)),
  );
