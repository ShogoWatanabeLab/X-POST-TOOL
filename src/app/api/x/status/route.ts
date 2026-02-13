import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuthFromRequest } from "@/lib/auth/require-auth";

type XStatusData = {
  connected: boolean;
  x_username: string | null;
  x_user_id: string | null;
  expires_at: string | null;
};

export async function GET(request: Request) {
  const auth = await requireAuthFromRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { data, error } = await auth.context.supabase
    .from("x_tokens")
    .select("x_username, x_user_id, expires_at")
    .eq("user_id", auth.context.user.id)
    .maybeSingle();

  if (error) {
    return errorResponse(500, "Failed to load X connection status", error.message);
  }

  const status: XStatusData = {
    connected: Boolean(data),
    x_username: data?.x_username ?? null,
    x_user_id: data?.x_user_id ?? null,
    expires_at: data?.expires_at ?? null,
  };

  return successResponse(status);
}
