"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  TickDouble02Icon,
  UserMultiple03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  SETTINGS_MENU_ITEM_CLASS,
  SettingsMenuChevron,
} from "@/components/leagues/settings/settings-menu-section";
import { fillEmptySlotsWithBotTeams } from "@/lib/actions/league-settings";

type FillBotTeamsMenuItemProps = {
  slug: string;
  vacantSlotCount: number;
};

export function FillBotTeamsMenuItem({
  slug,
  vacantSlotCount,
}: FillBotTeamsMenuItemProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFill = () => {
    setError(null);
    startTransition(async () => {
      const result = await fillEmptySlotsWithBotTeams(slug);
      if (!result.success) {
        setError(result.error ?? "Could not add bot managers.");
        return;
      }
      const count = result.filledCount ?? vacantSlotCount;
      toast.success(
        count === 1
          ? "Added 1 bot manager"
          : `Added ${count} bot managers`,
      );
      setOpen(false);
      router.refresh();
    });
  };

  if (vacantSlotCount <= 0) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={SETTINGS_MENU_ITEM_CLASS}
          />
        }
      >
        <HugeiconsIcon
          icon={UserMultiple03Icon}
          strokeWidth={1.75}
          data-icon="inline-start"
          className="text-muted-foreground transition-colors duration-150 group-hover/settings-item:text-foreground group-hover/button:text-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-left text-pretty">
          Fill empty slots with bots
        </span>
        <SettingsMenuChevron />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">
            Add bot managers?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">
            This fills {vacantSlotCount}{" "}
            {vacantSlotCount === 1 ? "open slot" : "open slots"} with placeholder
            owners and teams. Bots auto-pick during the draft but cannot log in
            to accept trades — use Edit Rosters or a second account to test
            trades.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-pretty text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </AlertDialogCancel>
          <Button type="button" disabled={isPending} onClick={handleFill}>
            <HugeiconsIcon
              icon={TickDouble02Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Add bot managers
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
