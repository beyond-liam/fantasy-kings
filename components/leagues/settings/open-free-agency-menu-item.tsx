"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  GavelIcon,
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
import {
  openFreeAgency,
  type OpenFreeAgencyMode,
} from "@/lib/actions/league-settings";
import { isRosterTransactionsEnabled } from "@/lib/leagues/free-agency";

type OpenFreeAgencyMenuItemProps = {
  slug: string;
  seasonStatus: string;
  freeAgencyOpen: boolean;
};

export function OpenFreeAgencyMenuItem({
  slug,
  seasonStatus,
  freeAgencyOpen,
}: OpenFreeAgencyMenuItemProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const alreadyOpen = isRosterTransactionsEnabled({
    status: seasonStatus,
    freeAgencyOpen,
  });

  const handleOpen = (mode: OpenFreeAgencyMode) => {
    setError(null);
    startTransition(async () => {
      const result = await openFreeAgency(slug, mode);
      if (!result.success) {
        setError(result.error ?? "Could not open free agency.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

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
          icon={GavelIcon}
          strokeWidth={1.75}
          data-icon="inline-start"
          className="text-muted-foreground transition-colors duration-150 group-hover/settings-item:text-foreground group-hover/button:text-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-left text-pretty">
          Open Free Agency
        </span>
        <SettingsMenuChevron />
      </AlertDialogTrigger>
      <AlertDialogContent>
                <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">
            {alreadyOpen ? "Free agency is open" : "Are you sure?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {alreadyOpen
              ? "Managers can already add and drop free agents in this league."
              : "Most leagues don't open free agency before the draft to prevent owners from selecting players outside of the draft. Do you still plan on holding a draft this season?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-pretty text-destructive" role="alert">
            {error}
          </p>
        ) : null}
                <AlertDialogFooter className="sm:flex-col sm:items-stretch sm:justify-stretch">
          {alreadyOpen ? (
            <AlertDialogCancel disabled={isPending}>
              <HugeiconsIcon
                icon={TickDouble02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Close
            </AlertDialogCancel>
          ) : (
            <>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => handleOpen("draft_later")}
              >
                <HugeiconsIcon
                  icon={GavelIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Open free agency and draft later
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => handleOpen("no_draft")}
              >
                <HugeiconsIcon
                  icon={GavelIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Open free agency and no draft
              </Button>
              <AlertDialogCancel variant="ghost" disabled={isPending}>
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Cancel
              </AlertDialogCancel>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
