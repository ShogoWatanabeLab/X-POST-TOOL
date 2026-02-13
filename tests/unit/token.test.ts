import { describe, expect, it } from "vitest";

import {
  extractAccessTokenFromCookieHeader,
  extractAccessTokenFromCookieStore,
  extractBearerToken,
  getCookieValueFromHeader,
} from "@/lib/auth/token";

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("auth token parsers", () => {
  it("extracts bearer token", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("extracts token from sb-access-token cookie", () => {
    const header = "foo=bar; sb-access-token=token-1";
    expect(extractAccessTokenFromCookieHeader(header)).toBe("token-1");
  });

  it("extracts token from base64-encoded supabase auth cookie", () => {
    const payload = JSON.stringify(["jwt-token-2", "refresh-token"]);
    const header = `sb-abc-auth-token=base64-${toBase64Url(payload)}`;
    expect(extractAccessTokenFromCookieHeader(header)).toBe("jwt-token-2");
  });

  it("gets named cookie value from header", () => {
    const header = "x_oauth_state=hello%20world; other=value";
    expect(getCookieValueFromHeader(header, "x_oauth_state")).toBe("hello world");
    expect(getCookieValueFromHeader(header, "missing")).toBeNull();
  });

  it("extracts token from cookie store object", () => {
    const store = {
      get(name: string) {
        if (name === "sb-access-token") {
          return { name, value: "store-token" };
        }
        return undefined;
      },
      getAll() {
        return [] as Array<{ name: string; value: string }>;
      },
    };

    expect(extractAccessTokenFromCookieStore(store)).toBe("store-token");
  });
});
