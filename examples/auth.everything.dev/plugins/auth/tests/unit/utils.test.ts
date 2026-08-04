import { ORPCError } from "every-plugin/orpc";
import { describe, expect, it } from "vitest";
import {
  createHeaders,
  getActiveOrganizationId,
  safeAuthApi,
  toError,
  toORPCError,
  tryJsonParse,
} from "../../src/utils";

describe("toError", () => {
  it("wraps a string in an Error", () => {
    const err = toError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
  });

  it("extracts message from error-like objects", () => {
    const err = toError({ message: "something failed" });
    expect(err.message).toBe("something failed");
  });

  it("handles null", () => {
    const err = toError(null);
    expect(err.message).toBe("null");
  });

  it("handles undefined", () => {
    const err = toError(undefined);
    expect(err.message).toBe("undefined");
  });

  it("handles numbers", () => {
    const err = toError(42);
    expect(err.message).toBe("42");
  });
});

describe("tryJsonParse", () => {
  it("parses valid JSON", () => {
    expect(tryJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses arrays", () => {
    expect(tryJsonParse("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("returns undefined for invalid JSON", () => {
    expect(tryJsonParse("not json")).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(tryJsonParse(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(tryJsonParse(undefined)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(tryJsonParse("")).toBeUndefined();
  });

  it("preserves typed return", () => {
    interface Foo {
      bar: string;
    }
    const result = tryJsonParse<Foo>('{"bar":"baz"}');
    expect(result?.bar).toBe("baz");
  });
});

describe("createHeaders", () => {
  it("creates Headers from a record", () => {
    const headers = createHeaders({ "content-type": "application/json", "x-api-key": "abc" });
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-api-key")).toBe("abc");
  });

  it("returns empty Headers for undefined", () => {
    const headers = createHeaders();
    expect(headers).toBeInstanceOf(Headers);
    expect([...headers.entries()]).toHaveLength(0);
  });

  it("returns empty Headers for empty object", () => {
    const headers = createHeaders({});
    expect([...headers.entries()]).toHaveLength(0);
  });
});

describe("getActiveOrganizationId", () => {
  it("returns the activeOrganizationId from session", () => {
    expect(getActiveOrganizationId({ activeOrganizationId: "org-123" })).toBe("org-123");
  });

  it("returns null when activeOrganizationId is null", () => {
    expect(getActiveOrganizationId({ activeOrganizationId: null })).toBeNull();
  });

  it("returns null when session is null", () => {
    expect(getActiveOrganizationId(null)).toBeNull();
  });

  it("returns null when session is undefined", () => {
    expect(getActiveOrganizationId(undefined)).toBeNull();
  });

  it("returns null when session has no activeOrganizationId", () => {
    expect(getActiveOrganizationId({ user: { id: "u1" } })).toBeNull();
  });

  it("returns null for non-object primitives", () => {
    expect(getActiveOrganizationId("string")).toBeNull();
    expect(getActiveOrganizationId(42)).toBeNull();
    expect(getActiveOrganizationId(true)).toBeNull();
  });
});

describe("toORPCError", () => {
  it("maps known status codes to ORPC error codes", () => {
    const err400 = toORPCError({ status: 400, message: "bad input" });
    expect(err400).toBeInstanceOf(Error);
    expect((err400 as any).code).toBe("BAD_REQUEST");

    const err401 = toORPCError({ status: 401, message: "no auth" });
    expect((err401 as any).code).toBe("UNAUTHORIZED");

    const err403 = toORPCError({ status: 403, message: "forbidden" });
    expect((err403 as any).code).toBe("FORBIDDEN");

    const err404 = toORPCError({ status: 404, message: "not found" });
    expect((err404 as any).code).toBe("NOT_FOUND");

    const err500 = toORPCError({ status: 500, message: "server error" });
    expect((err500 as any).code).toBe("INTERNAL_SERVER_ERROR");

    const err503 = toORPCError({ status: 503, message: "unavailable" });
    expect((err503 as any).code).toBe("SERVICE_UNAVAILABLE");
  });

  it("falls back to INTERNAL_SERVER_ERROR for unknown status codes", () => {
    const err = toORPCError({ status: 418, message: "I'm a teapot" });
    expect((err as any).code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("uses default message when status object has no message", () => {
    const err = toORPCError({ status: 400 });
    expect((err as any).message).toBe("Auth API error");
  });

  it("passes through ORPCError instances", () => {
    const original = new ORPCError("BAD_REQUEST", { message: "already an ORPCError" });
    const result = toORPCError(original);
    expect(result).toBe(original);
  });

  it("wraps plain Error instances as INTERNAL_SERVER_ERROR", () => {
    const err = toORPCError(new Error("plain error"));
    expect((err as any).code).toBe("INTERNAL_SERVER_ERROR");
    expect((err as any).message).toBe("plain error");
  });

  it("wraps non-Error values as INTERNAL_SERVER_ERROR", () => {
    const err = toORPCError("string error");
    expect((err as any).code).toBe("INTERNAL_SERVER_ERROR");
    expect((err as any).message).toBe("Auth API error");
  });
});

describe("safeAuthApi", () => {
  it("returns the result on success", async () => {
    const result = await safeAuthApi(() => Promise.resolve({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it("throws ORPCError on failure with status-bearing error", async () => {
    await expect(
      safeAuthApi(() => Promise.reject({ status: 401, message: "unauthorized" })),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws ORPCError on failure with plain Error", async () => {
    await expect(safeAuthApi(() => Promise.reject(new Error("oops")))).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
