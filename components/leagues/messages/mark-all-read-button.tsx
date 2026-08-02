"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckmarkSquare04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markLeagueMessagesRead } from "@/lib/actions/messages";

type MarkAllMessagesReadButtonProps = {
  leagueSlug: string;
  disabled?: boolean;
};

export function MarkAllMessagesReadButton({
  leagueSlug,
  disabled,
}: MarkAllMessagesReadButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const label = isPending ? "Marking…" : "Mark all as read";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="md:size-auto md:h-8 md:gap-1 md:px-2.5"
      aria-label={label}
      disabled={disabled || isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await markLeagueMessagesRead(leagueSlug);
          if (!result.success) {
            toast.error(result.error ?? "Could not mark as read.");
            return;
          }
          router.refresh();
        });
      }}
    >
      <HugeiconsIcon
        icon={CheckmarkSquare04Icon}
        strokeWidth={2}
        data-icon="inline-start"
      />
      <span className="hidden md:inline">{label}</span>
    </Button>
  );
}
