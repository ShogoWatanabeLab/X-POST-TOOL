import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/response";
import { requireAuthFromRequest } from "@/lib/auth/require-auth";
import { getCookieValueFromHeader } from "@/lib/auth/token";
import { encryptToken } from "@/lib/crypto";
import {
  exchangeCodeForToken,
  fetchXMe,
  oauthCookieOptions,
  X_OAUTH_CODE_VERIFIER_COOKIE,
  X_OAUTH_STATE_COOKIE,
} from "@/lib/x/oauth";

function clearOauthCookies(response: NextResponse) {
  const clearOptions = { ...oauthCookieOptions(), maxAge: 0 };
  response.cookies.set(X_OAUTH_STATE_COOKIE, "", clearOptions);
  response.cookies.set(X_OAUTH_CODE_VERIFIER_COOKIE, "", clearOptions);
}

export async function GET(request: Request) {
  const auth = await requireAuthFromRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");

  if (!code || !returnedState) {
    return errorResponse(400, "Missing code or state");
  }

  const cookieHeader = request.headers.get("cookie");
  const cookieState = getCookieValueFromHeader(cookieHeader, X_OAUTH_STATE_COOKIE);
  const codeVerifier = getCookieValueFromHeader(
    cookieHeader,
    X_OAUTH_CODE_VERIFIER_COOKIE,
  );

  if (!cookieState || !codeVerifier || returnedState !== cookieState) {
    return errorResponse(400, "Invalid OAuth state");
  }

  try {
    const tokens = await exchangeCodeForToken(code, codeVerifier);
    const xUser = await fetchXMe(tokens.access_token);

    const { error: upsertError } = await auth.context.supabase.from("x_tokens").upsert(
      {
        user_id: auth.context.user.id,
        x_user_id: xUser.id,
        x_username: xUser.username,
        access_token_encrypted: encryptToken(tokens.access_token),
        refresh_token_encrypted: tokens.refresh_token
          ? encryptToken(tokens.refresh_token)
          : null,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scope: tokens.scope ?? null,
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      return errorResponse(500, "Failed to save X tokens", upsertError.message);
    }

    const { error: auditLogError } = await auth.context.supabase.from("audit_logs").insert({
      user_id: auth.context.user.id,
      action: "x_connected",
      resource_type: "x_token",
    });

    if (auditLogError) {
      console.error("Failed to write audit log for x_connected", {
        userId: auth.context.user.id,
        error: auditLogError.message,
      });
    }

    const redirectResponse = NextResponse.redirect(new URL("/x-connection", request.url));
    clearOauthCookies(redirectResponse);
    return redirectResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OAuth callback error";
    return errorResponse(500, "X OAuth callback failed", message);
  }
}
