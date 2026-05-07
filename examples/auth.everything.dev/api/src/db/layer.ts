import { Context, Effect, Layer } from "every-plugin/effect";
import { createDatabase, type Database } from "./index";

export class DatabaseTag extends Context.Tag("Database")<DatabaseTag, Database>() {}

export const DatabaseLive = (url: string, authToken?: string) =>
  Layer.scoped(
    DatabaseTag,
    Effect.acquireRelease(
      Effect.sync(() => createDatabase(url, authToken)),
      (acquired) => Effect.sync(() => acquired.client.close()),
    ).pipe(Effect.map((acquired) => acquired.db)),
  );
