import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/placeholder-page";

export const metadata: Metadata = {
  title: "Trade analyzer",
};

export default function TradeAnalyzerPage() {
  return (
    <PlaceholderPage
      title="Trade Analyzer"
      description="Compare trade value across players."
    />
  );
}
