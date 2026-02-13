const SUPABASE_ACCESS_TOKEN_COOKIE = "sb-access-token";
const SUPABASE_AUTH_TOKEN_COOKIE_PATTERN = /^sb-.*-auth-token$/;

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function parseAuthTokenCookie(value: string): string | null {
  const decoded = decodeCookieValue(value);

  if (decoded.startsWith("base64-")) {
    const payload = decodeBase64Url(decoded.slice("base64-".length));
    if (!payload) {
      return null;
    }
    return parseAuthTokenCookie(payload);
  }

  try {
    const parsed = JSON.parse(decoded) as unknown;
    if (typeof parsed === "string") {
      return parsed;
    }
    if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      return parsed[0];
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "access_token" in parsed &&
      typeof (parsed as { access_token?: unknown }).access_token === "string"
    ) {
      return (parsed as { access_token: string }).access_token;
    }
  } catch {
    // Not JSON; try raw token.
  }

  return decoded || null;
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const pairs = cookieHeader.split(";");
  const cookieMap = new Map<string, string>();

  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split("=");
    if (!name || rest.length === 0) {
      continue;
    }
    cookieMap.set(name, rest.join("="));
  }

  return cookieMap;
}

export function getCookieValueFromHeader(
  cookieHeader: string | null | undefined,
  name: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookieMap = parseCookieHeader(cookieHeader);
  const value = cookieMap.get(name);
  return value ? decodeCookieValue(value) : null;
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export function extractAccessTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookieMap = parseCookieHeader(cookieHeader);
  const directToken = cookieMap.get(SUPABASE_ACCESS_TOKEN_COOKIE);
  if (directToken) {
    return decodeCookieValue(directToken);
  }

  for (const [name, value] of cookieMap.entries()) {
    if (!SUPABASE_AUTH_TOKEN_COOKIE_PATTERN.test(name)) {
      continue;
    }

    const parsed = parseAuthTokenCookie(value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

type CookieReader = {
  get(name: string): { name: string; value: string } | undefined;
  getAll(): Array<{ name: string; value: string }>;
};

export function extractAccessTokenFromCookieStore(cookieStore: CookieReader): string | null {
  const direct = cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE);
  if (direct?.value) {
    return decodeCookieValue(direct.value);
  }

  for (const cookie of cookieStore.getAll()) {
    if (!SUPABASE_AUTH_TOKEN_COOKIE_PATTERN.test(cookie.name)) {
      continue;
    }
    const parsed = parseAuthTokenCookie(cookie.value);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
