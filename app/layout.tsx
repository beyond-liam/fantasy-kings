import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { AppChrome } from "@/components/layout/app-chrome";
import { Toaster } from "@/components/ui/sonner";
import { getSessionAccountSummary } from "@/lib/actions/account";
import { cn } from "@/lib/utils";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
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
  const account = await getSessionAccountSummary();

  return (
    <html
      lang="en"
      className={cn("dark h-full antialiased font-sans font-synthesis-none", figtree.variable)}
    >
      <body className="flex h-dvh flex-col overflow-hidden overscroll-none">
        <AppChrome account={account}>{children}</AppChrome>
        <Toaster />
      </body>
    </html>
  );
}
