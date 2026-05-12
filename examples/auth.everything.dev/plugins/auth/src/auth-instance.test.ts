import { describe, expect, it } from "vitest";
import { resolvePasskeyRelyingPartyOptions } from "./auth-instance";

describe("resolvePasskeyRelyingPartyOptions", () => {
  it("derives localhost relying party options from baseUrl", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
      }),
    ).toEqual({
      rpID: "localhost",
      rpName: "Everything Dev",
      origin: "http://localhost:3000",
    });
  });

  it("drops path segments when deriving production origin", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "https://everything.dev/auth",
      }),
    ).toEqual({
      rpID: "everything.dev",
      rpName: "Everything Dev",
      origin: "https://everything.dev",
    });
  });

  it("normalizes explicit passkey overrides", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkeyOrigin: "https://auth.example.com/passkey",
        passkeyRpId: "https://example.com:443",
        passkeyRpName: "Example Auth",
      }),
    ).toEqual({
      rpID: "example.com",
      rpName: "Example Auth",
      origin: "https://auth.example.com",
    });
  });

  it("treats localhost origins without a protocol as http", () => {
    expect(
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkeyOrigin: "localhost:3000",
      }),
    ).toMatchObject({
      rpID: "localhost",
      origin: "http://localhost:3000",
    });
  });

  it("throws a descriptive error for invalid passkey origin", () => {
    expect(() =>
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkeyOrigin: "https://",
      }),
    ).toThrow('Invalid passkey origin value: "https://"');
  });

  it("throws a descriptive error for invalid passkey RP ID", () => {
    expect(() =>
      resolvePasskeyRelyingPartyOptions({
        baseUrl: "http://localhost:3000",
        passkeyRpId: "https://",
      }),
    ).toThrow('Invalid passkey RP ID value: "https://"');
  });
});
