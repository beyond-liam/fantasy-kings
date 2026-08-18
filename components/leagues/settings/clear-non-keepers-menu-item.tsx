"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  UserMinus01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  SETTINGS_MENU_ITEM_CLASS,
  SettingsMenuChevron,
} from "@/components/leagues/settings/settings-menu-section";
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
import { clearNonKeepers } from "@/lib/actions/keepers";
import { countNonKeepers, type NonKeeperClearanceTeam } from "@/lib/leagues/keepers/clearance";
import { cn } from "@/lib/utils";

type ClearNonKeepersMenuItemProps = {
  slug: string;
  teams: NonKeeperClearanceTeam[];
  keepersLocked: boolean;
  keepersMaxConfigured: boolean;
};

export function ClearNonKeepersMenuItem({
  slug,
  teams,
  keepersLocked,
  keepersMaxConfigured,
}: ClearNonKeepersMenuItemProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const playerCount = countNonKeepers(teams);
  const disabled = !keepersMaxConfigured;

  const handleOpenChange = (next: boolean) => {
    if (disabled) return;
    setOpen(next);
    if (!next) setError(null);
  };

  const handleClear = () => {
    setError(null);
    startTransition(async () => {
      const result = await clearNonKeepers(slug);
      if (!result.success) {
        setError(result.error ?? "Could not clear non-keepers.");
        return;
      }
      const cleared = result.clearedCount ?? playerCount;
      toast.success(
        cleared === 0
          ? "Keepers locked until the draft completes."
          : `Cleared ${cleared} non-keeper${cleared === 1 ? "" : "s"}.`,
      );
      setOpen(false);
      router.refresh();
    });
  };

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      className={cn(SETTINGS_MENU_ITEM_CLASS, disabled && "opacity-50")}
      disabled={disabled}
    >
      <HugeiconsIcon
        icon={UserMinus01Icon}
        strokeWidth={1.75}
        data-icon="inline-start"
        className="text-muted-foreground transition-colors duration-150 group-hover/settings-item:text-foreground group-hover/button:text-foreground"
      />
      <span className="min-w-0 flex-1 truncate text-left text-pretty">
        Clear Non-Keepers
      </span>
      <SettingsMenuChevron />
    </Button>
  );

  if (disabled) {
    return (
      <div title="Set keepers max in Dynasty Rules before clearing non-keepers.">
        {trigger}
      </div>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
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
          icon={UserMinus01Icon}
          strokeWidth={1.75}
          data-icon="inline-start"
          className="text-muted-foreground transition-colors duration-150 group-hover/settings-item:text-foreground group-hover/button:text-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-left text-pretty">
          Clear Non-Keepers
        </span>
        <SettingsMenuChevron />
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">
            Clear non-keepers?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">
            {keepersLocked && playerCount === 0
              ? "Non-keepers are already cleared. Keepers stay locked until the draft completes."
              : playerCount === 0
                ? "Every remaining player is already a keeper. Confirm to lock keepers until the draft completes."
                : `Release ${playerCount} non-keeper${playerCount === 1 ? "" : "s"} to free agency. Keepers stay rostered and lock until the draft completes.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {playerCount > 0 ? (
          <ul className="max-h-72 overflow-y-auto rounded-lg border p-3 text-sm">
            {teams.map((team) => (
              <li key={team.teamId} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                <p className="font-medium text-foreground">
                  {team.teamName}
                  <span className="ml-1 font-normal tabular-nums text-muted-foreground">
                    {team.players.length}
                  </span>
                </p>
                <p className="text-pretty text-muted-foreground">
                  {team.players.map((player) => player.playerName).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {error ? (
          <p className="text-sm text-pretty text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          {keepersLocked && playerCount === 0 ? (
            <AlertDialogCancel disabled={isPending}>
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Close
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
              <Button
                type="button"
                variant="destructive"
                disabled={isPending}
                onClick={handleClear}
              >
                <HugeiconsIcon
                  icon={UserMinus01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Clear Non-Keepers
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
