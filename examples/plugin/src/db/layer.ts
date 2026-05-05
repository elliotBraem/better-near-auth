import type { DatabaseDriver, AuthDatabase } from "./driver";

// Re-export for backward compatibility
export type { DatabaseDriver, AuthDatabase } from "./driver";

/**
 * @deprecated Use `createDatabaseDriver` from `./driver` instead.
 * This function is kept for backward compatibility with existing code
 * that passes `url` and `authToken` directly.
 */
export function createAuthDatabase(url: string, authToken?: string): { db: AuthDatabase; client: { close(): void } } {
  const { createDatabaseDriver } = require("./driver");
  const driver = createDatabaseDriver(url, { driver: "libsql", authToken });

  return {
    db: driver.db,
    client: {
      close: () => driver.close(),
    },
  };
}
