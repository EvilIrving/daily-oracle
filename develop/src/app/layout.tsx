import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "每日一句工作台",
  description: "本地语料处理工作台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
