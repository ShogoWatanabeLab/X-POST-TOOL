import type { User } from "@supabase/supabase-js";

import { errorResponse } from "@/lib/api/response";
import { extractAccessTokenFromCookieHeader, extractBearerToken } from "@/lib/auth/token";
import { createServerSupabaseClient, createUserSupabaseClient } from "@/lib/supabase/server";

type AuthContext = {
  user: User;
  accessToken: string;
  supabase: ReturnType<typeof createUserSupabaseClient>;
};

type AuthResult = { ok: true; context: AuthContext } | { ok: false; response: Response };

export async function requireAuthFromRequest(request: Request): Promise<AuthResult> {
  const accessToken =
    extractBearerToken(request.headers.get("authorization")) ??
    extractAccessTokenFromCookieHeader(request.headers.get("cookie"));

  if (!accessToken) {
    return { ok: false, response: errorResponse(401, "Unauthorized") };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return { ok: false, response: errorResponse(401, "Unauthorized") };
  }

  return {
    ok: true,
    context: {
      user,
      accessToken,
      supabase: createUserSupabaseClient(accessToken),
    },
  };
}
