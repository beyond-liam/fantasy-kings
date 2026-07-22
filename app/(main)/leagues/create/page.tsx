import type { Metadata } from "next";
import { Suspense } from "react";

import { CreateLeagueWizard } from "@/components/leagues/create-wizard/create-wizard";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Create league",
};

export default function CreateLeaguePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner className="size-6" />
        </div>
      }
    >
      <CreateLeagueWizard />
    </Suspense>
  );
}
