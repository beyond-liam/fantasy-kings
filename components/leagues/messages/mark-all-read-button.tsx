"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { TickDouble02Icon } from "@hugeicons/core-free-icons";
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

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
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
        icon={TickDouble02Icon}
        strokeWidth={2}
        data-icon="inline-start"
      />
      {isPending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
