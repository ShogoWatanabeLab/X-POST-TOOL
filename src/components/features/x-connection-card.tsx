"use client";

import { useCallback, useMemo, useState } from "react";

export type XStatus = {
  connected: boolean;
  x_username: string | null;
  x_user_id: string | null;
  expires_at: string | null;
};

type ErrorResponse = {
  error?: string;
};

type XConnectionCardProps = {
  status: XStatus;
  statusError?: string | null;
};

export default function XConnectionCard({ status, statusError }: XConnectionCardProps) {
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = useCallback(() => {
    window.location.href = "/api/x/oauth/start";
  }, []);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    setError(null);

    const response = await fetch("/api/x/disconnect", {
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ErrorResponse | null;
      setError(payload?.error ?? "Failed to disconnect X account.");
      setDisconnecting(false);
      return;
    }

    window.location.reload();
  }, []);

  const expiresLabel = useMemo(() => {
    if (!status.expires_at) {
      return null;
    }
    return new Date(status.expires_at).toLocaleString("ja-JP");
  }, [status.expires_at]);

  return (
    <section className="mx-auto mt-16 w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">X連携</h1>
      <p className="mt-2 text-sm text-zinc-600">
        連携すると、今後の投稿機能からXへ直接送信できるようになります。
      </p>

      {statusError ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {statusError}
        </p>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? "エラーが発生しました。"}
        </p>
      ) : null}

      <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-700">
          接続状態:{" "}
          <span className="font-medium text-zinc-900">
            {status.connected ? "接続済み" : "未接続"}
          </span>
        </p>
        {status.connected ? (
          <>
            <p className="mt-2 text-sm text-zinc-700">
              ユーザー名: <span className="font-medium text-zinc-900">@{status.x_username}</span>
            </p>
            {expiresLabel ? (
              <p className="mt-1 text-sm text-zinc-700">
                トークン期限: <span className="font-medium text-zinc-900">{expiresLabel}</span>
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-6 flex gap-3">
        {!status?.connected ? (
          <button
            type="button"
            onClick={handleConnect}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Xと連携する
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {disconnecting ? "解除中..." : "連携を解除する"}
          </button>
        )}
      </div>
    </section>
  );
}
