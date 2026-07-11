import { describe, expect, it } from "vitest";

describe("ping", () => {
  it("returns ok status with valid ISO 8601 timestamp", async () => {
    const handler = async () => ({
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    });

    const result = await handler();

    expect(result.status).toBe("ok");
    expect(result.timestamp).toBeTypeOf("string");
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
