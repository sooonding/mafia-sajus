import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "AI 사주 분석",
  description: "AI 기반 사주 분석 구독 서비스",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="ko" suppressHydrationWarning>
        <body className="antialiased font-sans" suppressHydrationWarning>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
