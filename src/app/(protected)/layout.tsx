import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { extractAccessTokenFromCookieStore } from "@/lib/auth/token";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProtectedLayoutProps = {
  children: React.ReactNode;
};

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const cookieStore = await cookies();
  const accessToken = extractAccessTokenFromCookieStore(cookieStore);

  if (!accessToken) {
    redirect("/");
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);

  if (!user) {
    redirect("/");
  }

  return <>{children}</>;
}
