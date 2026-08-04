"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";

export function PlayerPageBackButton() {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="-ml-2 gap-1.5 text-current hover:bg-black/10 hover:text-current dark:hover:bg-white/15"
    >
      <HugeiconsIcon
        icon={ArrowLeft01Icon}
        strokeWidth={2}
        data-icon="inline-start"
        className="translate-y-px"
      />
      Back to Players
    </Button>
  );
}
