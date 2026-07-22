import type { Metadata } from "next";

import { MockDraftSettings } from "@/components/mock-draft/mock-draft-settings";

export const metadata: Metadata = {
  title: "Mock Draft",
};

export default function MockDraftSettingsPage() {
  return (
    <div className="flex flex-1 flex-col p-6">
      <MockDraftSettings />
    </div>
  );
}
