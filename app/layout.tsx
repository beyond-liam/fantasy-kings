import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import "./globals.css";
import { AppAccountSlot } from "@/components/layout/app-account-slot";
import { AppChrome } from "@/components/layout/app-chrome";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { ViewportProvider } from "@/components/layout/viewport-provider";
import { Toaster } from "@/components/ui/sonner";
import { isMobileUserAgent } from "@/lib/viewport";
import { cn } from "@/lib/utils";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Fantasy Kings",
    template: "%s | Fantasy Kings",
  },
  description: "Fantasy football for your friend group",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialIsMobile = isMobileUserAgent(
    (await headers()).get("user-agent"),
  );

  return (
    <html
      lang="en"
      className={cn("dark h-full antialiased font-sans font-synthesis-none", figtree.variable)}
    >
      <body className="relative flex min-h-dvh flex-col">
        <ViewportProvider initialIsMobile={initialIsMobile}>
          <AppChrome
            accountSlot={
              <Suspense
                fallback={
                  <AppTopNav initialAccount={null} initialLeagues={[]} />
                }
              >
                <AppAccountSlot />
              </Suspense>
            }
          >
            {children}
          </AppChrome>
        </ViewportProvider>
        <Toaster />
      </body>
    </html>
  );
}
