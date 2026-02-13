import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuthFromRequest } from "@/lib/auth/require-auth";

export async function POST(request: Request) {
  const auth = await requireAuthFromRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const { error: deleteError } = await auth.context.supabase
    .from("x_tokens")
    .delete()
    .eq("user_id", auth.context.user.id);

  if (deleteError) {
    return errorResponse(500, "Failed to disconnect X account", deleteError.message);
  }

  const { error: logError } = await auth.context.supabase.from("audit_logs").insert({
    user_id: auth.context.user.id,
    action: "x_disconnected",
    resource_type: "x_token",
  });

  if (logError) {
    return errorResponse(500, "Disconnected but failed to write audit log", logError.message);
  }

  return successResponse({ disconnected: true }, { message: "Disconnected successfully" });
}
