import crypto from "crypto";

import { getRequiredEnv } from "@/lib/env";

export const X_OAUTH_STATE_COOKIE = "x_oauth_state";
export const X_OAUTH_CODE_VERIFIER_COOKIE = "x_oauth_code_verifier";
const X_OAUTH_SCOPE = "tweet.read tweet.write users.read offline.access";

export function createPkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

export function createState() {
  return crypto.randomBytes(16).toString("hex");
}

export function createXAuthorizationUrl(state: string, codeChallenge: string): URL {
  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");

  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", getRequiredEnv("X_CLIENT_ID"));
  authUrl.searchParams.set("redirect_uri", getRequiredEnv("X_REDIRECT_URI"));
  authUrl.searchParams.set("scope", X_OAUTH_SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return authUrl;
}

function createXBasicAuthHeader() {
  const clientId = getRequiredEnv("X_CLIENT_ID");
  const clientSecret = getRequiredEnv("X_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export type XTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
): Promise<XTokenResponse> {
  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: createXBasicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRequiredEnv("X_REDIRECT_URI"),
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed token exchange: ${response.status} ${details}`);
  }

  return (await response.json()) as XTokenResponse;
}

export type XUser = { id: string; username: string };

export async function fetchXMe(accessToken: string): Promise<XUser> {
  const response = await fetch("https://api.twitter.com/2/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Failed user lookup: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as { data?: { id?: string; username?: string } };
  if (!payload.data?.id || !payload.data.username) {
    throw new Error("X user payload is invalid");
  }

  return { id: payload.data.id, username: payload.data.username };
}

export function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  };
}
