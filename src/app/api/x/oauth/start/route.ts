import { NextResponse } from "next/server";

import { requireAuthFromRequest } from "@/lib/auth/require-auth";
import {
  createPkcePair,
  createState,
  createXAuthorizationUrl,
  oauthCookieOptions,
  X_OAUTH_CODE_VERIFIER_COOKIE,
  X_OAUTH_STATE_COOKIE,
} from "@/lib/x/oauth";

export async function GET(request: Request) {
  const auth = await requireAuthFromRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const state = createState();
  const { codeVerifier, codeChallenge } = createPkcePair();
  const authUrl = createXAuthorizationUrl(state, codeChallenge);

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set(X_OAUTH_STATE_COOKIE, state, oauthCookieOptions());
  response.cookies.set(
    X_OAUTH_CODE_VERIFIER_COOKIE,
    codeVerifier,
    oauthCookieOptions(),
  );

  return response;
}
