import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { auth } from "@/auth";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const geistInter = Inter({
  variable: "--font-geist-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DSE Exchange — Spot Trading Platform",
  description:
    "Trade BTC, ETH, DOGE, and DIDE against USDT on a polished exchange interface with live order books, real-time charts, and instant settlement.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? null;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistInter.variable} ${geistMono.variable} antialiased bg-zinc-50 text-zinc-900`}
      >
        <div className="min-h-screen bg-zinc-50">
          <Navbar isSignedIn={Boolean(session?.user)} userLabel={userLabel} />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
