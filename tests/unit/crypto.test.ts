import { beforeEach, describe, expect, it } from "vitest";

import { decryptToken, encryptToken } from "@/lib/crypto";

const VALID_KEY = Buffer.alloc(32, 1).toString("base64");

describe("crypto token helpers", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = VALID_KEY;
  });

  it("encrypts and decrypts token", () => {
    const source = "x-access-token-123";
    const encrypted = encryptToken(source);

    expect(encrypted).not.toBe(source);
    expect(decryptToken(encrypted)).toBe(source);
  });

  it("throws on malformed encrypted value", () => {
    expect(() => decryptToken("invalid-format")).toThrow(
      "Invalid encrypted token format",
    );
  });

  it("throws when key length is not 32 bytes", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");

    expect(() => encryptToken("token")).toThrow(
      "ENCRYPTION_KEY must decode to 32 bytes",
    );
  });
});
