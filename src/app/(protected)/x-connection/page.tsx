import { cookies } from "next/headers";

import XConnectionCard, { type XStatus } from "@/components/features/x-connection-card";
import { extractAccessTokenFromCookieStore } from "@/lib/auth/token";
import { createUserSupabaseClient } from "@/lib/supabase/server";

export default async function XConnectionPage() {
  const cookieStore = await cookies();
  const accessToken = extractAccessTokenFromCookieStore(cookieStore);

  const defaultStatus: XStatus = {
    connected: false,
    x_username: null,
    x_user_id: null,
    expires_at: null,
  };

  if (!accessToken) {
    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-8">
        <XConnectionCard status={defaultStatus} />
      </main>
    );
  }

  const supabase = createUserSupabaseClient(accessToken);
  const { data, error } = await supabase
    .from("x_tokens")
    .select("x_username, x_user_id, expires_at")
    .maybeSingle();

  const status: XStatus = {
    connected: Boolean(data),
    x_username: data?.x_username ?? null,
    x_user_id: data?.x_user_id ?? null,
    expires_at: data?.expires_at ?? null,
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8">
      <XConnectionCard
        status={status}
        statusError={error ? "連携状態の取得に失敗しました。時間をおいて再度お試しください。" : null}
      />
    </main>
  );
}
