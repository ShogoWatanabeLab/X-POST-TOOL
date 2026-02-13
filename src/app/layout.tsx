import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "X Post Tool",
  description: "X投稿支援ツール",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
