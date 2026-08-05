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

/** League Players table / search — draft replaces add/trade while underway. */
export type LeagueDraftTableActions = {
  draftLive: boolean;
  isMyTurn: boolean;
  isCommissioner: boolean;
  draftedPlayerIds: string[];
};

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
      router.refresh();
    });
  };

  if (canDraft) {
    return (
      <Button
        type="button"
        size="icon-sm"
        className="md:h-8 md:w-auto md:gap-1 md:px-2.5"
        aria-label="Draft"
        disabled={isPending}
        onClick={() => pick(false)}
      >
        <HugeiconsIcon
          icon={UserAdd01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        <span className="hidden md:inline">Draft</span>
      </Button>
    );
  }

  if (canCommissionerPick) {
    return (
      <Button
        type="button"
        size="icon-sm"
        variant="outline"
        className="md:h-8 md:w-auto md:gap-1 md:px-2.5"
        aria-label="Commish pick"
        disabled={isPending}
        onClick={() => pick(true)}
      >
        <HugeiconsIcon
          icon={GavelIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        <span className="hidden md:inline">Commish Pick</span>
      </Button>
    );
  }

  const button = (
    <Button
      type="button"
      size="icon-sm"
      className="md:h-8 md:w-auto md:gap-1 md:px-2.5"
      aria-label="Draft"
      disabled
    >
      <HugeiconsIcon
        icon={UserAdd01Icon}
        strokeWidth={2}
        data-icon="inline-start"
      />
      <span className="hidden md:inline">Draft</span>
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
