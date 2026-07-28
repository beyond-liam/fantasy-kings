import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppAccountSlot } from "@/components/layout/app-account-slot";
import { AppChrome } from "@/components/layout/app-chrome";
import { AppTopNav } from "@/components/layout/app-top-nav";
import { Toaster } from "@/components/ui/sonner";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("dark h-full antialiased font-sans font-synthesis-none", figtree.variable)}
    >
      <body className="flex h-dvh flex-col overflow-hidden overscroll-none">
        <AppChrome
          accountSlot={
            <Suspense fallback={<AppTopNav initialAccount={null} />}>
              <AppAccountSlot />
            </Suspense>
          }
        >
          {children}
        </AppChrome>
        <Toaster />
      </body>
    </html>
  );
}
