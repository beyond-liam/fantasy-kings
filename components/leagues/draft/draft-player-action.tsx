"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { GavelIcon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { makeDraftPick } from "@/lib/actions/draft";
import { toastDraftPick } from "@/lib/leagues/draft/pick-toast";

type DraftPlayerActionProps = {
  slug: string;
  playerId: string;
  drafted: boolean;
  canDraft: boolean;
  canCommissionerPick: boolean;
  hideActions?: boolean;
  disabledReason?: string;
  /** Local draft handler (mock drafts) — skips league server actions. */
  onDraft?: () => void;
};

export function DraftPlayerAction({
  slug,
  playerId,
  drafted,
  canDraft,
  canCommissionerPick,
  hideActions = false,
  disabledReason,
  onDraft,
}: DraftPlayerActionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (drafted) {
    return (
      <span className="text-xs text-muted-foreground">Drafted</span>
    );
  }

  if (hideActions) {
    return null;
  }

  const pick = (asCommissioner: boolean) => {
    if (onDraft) {
      onDraft();
      return;
    }

    startTransition(async () => {
      const result = await makeDraftPick(slug, playerId, { asCommissioner });
      if (!result.success) {
        toast.error(result.error ?? "Could not make pick.");
        return;
      }
      if (
        result.overall != null &&
        result.playerFullName &&
        result.teamName
      ) {
        toastDraftPick({
          slug,
          overall: result.overall,
          playerFullName: result.playerFullName,
          teamName: result.teamName,
        });
      }
      router.refresh();
    });
  };

  if (canDraft) {
    return (
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => pick(false)}
      >
        <HugeiconsIcon
          icon={UserAdd01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Draft
      </Button>
    );
  }

  if (canCommissionerPick) {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={() => pick(true)}
      >
        <HugeiconsIcon
          icon={GavelIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Commish pick
      </Button>
    );
  }

  const button = (
    <Button type="button" size="sm" disabled>
      <HugeiconsIcon
        icon={UserAdd01Icon}
        strokeWidth={2}
        data-icon="inline-start"
      />
      Draft
    </Button>
  );

  if (!disabledReason) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
