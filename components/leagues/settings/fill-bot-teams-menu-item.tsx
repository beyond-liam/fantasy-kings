"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AddTeamIcon,
  Cancel01Icon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

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
};

export function FillBotTeamsMenuItem({ slug }: FillBotTeamsMenuItemProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledCount, setFilledCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFill = () => {
    setError(null);
    setFilledCount(null);
    startTransition(async () => {
      const result = await fillEmptySlotsWithBotTeams(slug);
      if (!result.success) {
        setError(result.error ?? "Could not fill empty slots.");
        return;
      }
      setFilledCount(result.filledCount ?? 0);
      router.refresh();
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setFilledCount(null);
        }
      }}
    >
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
          icon={AddTeamIcon}
          strokeWidth={1.75}
          data-icon="inline-start"
          className="text-muted-foreground transition-colors duration-150 group-hover/settings-item:text-foreground group-hover/button:text-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-left text-pretty">
          Fill Empty Slots
        </span>
        <SettingsMenuChevron />
      </AlertDialogTrigger>
      <AlertDialogContent>
                <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">
            {filledCount != null ? "Slots filled" : "Fill empty slots?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {filledCount != null ? (
              <>
                Added{" "}
                <span className="tabular-nums">{filledCount}</span> bot team
                {filledCount === 1 ? "" : "s"}. You can set draft order and
                pick for them.
              </>
            ) : (
              "Creates placeholder managers and teams for every open slot. Use this to test draft order and commissioner picks."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-pretty text-destructive" role="alert">
            {error}
          </p>
        ) : null}
                <AlertDialogFooter>
          {filledCount != null ? (
            <AlertDialogCancel>
              <HugeiconsIcon
                icon={TickDouble02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Done
            </AlertDialogCancel>
          ) : (
            <>
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
                  icon={AddTeamIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Fill empty slots
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
