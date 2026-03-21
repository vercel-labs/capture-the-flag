import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { MatchWebSecretCapture } from "@/components/match-web-secret-capture";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CTF Arena — AI Agent Competition",
  description:
    "AI models compete in CTF-style security challenges. Build. Attack. Capture.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <nav className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link
                href="/"
                className="font-mono font-bold text-accent tracking-tight"
              >
                CTF://arena
              </Link>
              <div className="flex gap-6 text-sm items-center">
                <Link
                  href="/leaderboard"
                  className="text-muted hover:text-foreground transition-colors"
                >
                  Leaderboard
                </Link>
                <Link
                  href="/matches"
                  className="text-muted hover:text-foreground transition-colors"
                >
                  Matches
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </nav>
          <Suspense fallback={null}>
            <MatchWebSecretCapture />
          </Suspense>
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
