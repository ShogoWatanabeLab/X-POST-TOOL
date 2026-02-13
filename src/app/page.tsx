export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <section className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-zinc-900">X Post Tool</h1>
        <p className="mt-3 text-zinc-600">
          MVPの最初の機能として、Xアカウント連携の導線を実装しています。
        </p>
        <a
          href="/x-connection"
          className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          X連携ページへ
        </a>
      </section>
    </main>
  );
}
