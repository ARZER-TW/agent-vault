import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suistody | Policy-Controlled AI Trading on Sui",
  description:
    "Don't give your AI agent the keys. Give it a budget. Policy-enforced custody for autonomous AI trading via DeepBook V3 on Sui.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased relative">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
