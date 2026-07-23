"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserAdd01Icon,
  UserMinus01Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  ClaimPlayerDialog,
  type ClaimPlayerDialogState,
} from "@/components/team/claim-player-dialog";
import { CutPlayerDialog } from "@/components/team/cut-player-dialog";
import {
  CutToAddDialog,
  type CutToAddDialogState,
} from "@/components/team/cut-to-add-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  addPlayerToRoster,
  cutPlayerFromRoster,
  type RosterCutCandidate,
} from "@/lib/actions/roster";
import { getClaimContext } from "@/lib/actions/waivers";
import { tradeComposerPath } from "@/lib/leagues/utils";

export type PlayerActionOwnership = {
  id: string;
  fullName?: string | null;
  fantasyTeamId?: string | null;
  isOwnedByCurrentUser?: boolean;
  fantasyTeamSlug?: string | null;
  onWaivers?: boolean;
  /** Server-computed acquisition for free agents / waiver pool. */
  acquisitionKind?: "add" | "claim" | "owned" | "unavailable";
  /** Current user already has a pending claim on this player. */
  hasPendingClaim?: boolean;
};

type ActionKind = "add" | "cut" | "claim" | "trade";

function getAction(player: PlayerActionOwnership): {
  kind: ActionKind;
  label: string;
  icon: typeof UserAdd01Icon;
  variant: "ghost" | "ghost-destructive";
  actionable: boolean;
} {
  if (player.fantasyTeamId) {
    if (player.isOwnedByCurrentUser) {
      return {
        kind: "cut",
        label: "Cut player",
        icon: UserMinus01Icon,
        variant: "ghost-destructive",
        actionable: true,
      };
    }

    return {
      kind: "trade",
      label: "Trade for player",
      icon: UserSwitchIcon,
      variant: "ghost",
      actionable: true,
    };
  }

  const kind = player.acquisitionKind ?? (player.onWaivers ? "claim" : "add");

  if (kind === "claim") {
    return {
      kind: "claim",
      label: "Claim player",
      icon: UserAdd01Icon,
      variant: "ghost",
      actionable: true,
    };
  }

  if (kind === "unavailable") {
    return {
      kind: "add",
      label: "Unavailable",
      icon: UserAdd01Icon,
      variant: "ghost",
      actionable: false,
    };
  }

  return {
    kind: "add",
    label: "Add player",
    icon: UserAdd01Icon,
    variant: "ghost",
    actionable: true,
  };
}

type PlayerActionButtonProps = {
  player: PlayerActionOwnership;
  leagueSlug: string;
  disabled?: boolean;
  disabledReason?: string;
  /** Blocks add / claim / trade while IR lock is active. Cuts still work. */
  acquisitionsLocked?: boolean;
  acquisitionLockReason?: string;
  tradesEnabled?: boolean;
};

export function PlayerActionButton({
  player,
  leagueSlug,
  disabled = false,
  disabledReason = "Free agency is closed",
  acquisitionsLocked = false,
  acquisitionLockReason = "Move ineligible IR players off IR before free agent adds, claims, or trades.",
  tradesEnabled = true,
}: PlayerActionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cutConfirmOpen, setCutConfirmOpen] = useState(false);
  const [cutDialog, setCutDialog] = useState<CutToAddDialogState | null>(null);
  const [claimDialog, setClaimDialog] = useState<ClaimPlayerDialogState | null>(
    null,
  );
  const action = getAction(player);

  const claimAlreadyFiled =
    action.kind === "claim" && Boolean(player.hasPendingClaim);

  const acquisitionBlocked =
    acquisitionsLocked &&
    (action.kind === "add" ||
      action.kind === "claim" ||
      action.kind === "trade");

  const isDisabled =
    disabled ||
    acquisitionBlocked ||
    claimAlreadyFiled ||
    isPending ||
    !action.actionable ||
    !leagueSlug ||
    (action.kind === "trade" && !tradesEnabled);

  const tradeHref =
    action.kind === "trade" &&
    player.fantasyTeamSlug &&
    tradesEnabled &&
    leagueSlug
      ? tradeComposerPath(leagueSlug, {
          with: player.fantasyTeamSlug,
          want: player.id,
        })
      : null;

  const playerName = player.fullName?.trim() || "this player";

  const tooltip = claimAlreadyFiled
    ? "Claim already made for this player"
    : acquisitionBlocked
      ? acquisitionLockReason
      : disabled
        ? disabledReason
          : !action.actionable
          ? action.kind === "trade" && !tradesEnabled
            ? "Trades are disabled"
            : action.kind === "trade" && !player.fantasyTeamSlug
              ? "Trades are not available yet"
              : action.label
          : action.label;

  const handleAdd = () => {
    startTransition(async () => {
      const result = await addPlayerToRoster(leagueSlug, player.id);

      if (
        !result.success &&
        result.requiresCut &&
        result.cutCandidates &&
        result.pendingPlayerId
      ) {
        setCutDialog({
          open: true,
          reason: result.reason ?? "roster_full",
          pendingPlayerId: result.pendingPlayerId,
          pendingPlayerName:
            result.pendingPlayerName?.trim() || playerName,
          cutCandidates: result.cutCandidates,
        });
        return;
      }

      if (!result.success) {
        toast.error(result.error ?? "Could not update roster.");
        return;
      }

      const name = result.playerName?.trim() || playerName;
      toast.success(`${name} added to your roster`);
      router.refresh();
    });
  };

  const handleClaim = () => {
    startTransition(async () => {
      const context = await getClaimContext(leagueSlug, player.id);
      if (!context.success) {
        toast.error(context.error ?? "Could not open claim.");
        return;
      }

      setClaimDialog({
        open: true,
        playerId: player.id,
        playerName: context.playerName?.trim() || playerName,
        cutCandidates: context.cutCandidates as RosterCutCandidate[],
        requiresDrop: context.requiresDrop,
        waiverType: context.waiverType,
        faabRemaining: context.faabRemaining,
        allowZeroBids: context.allowZeroBids,
      });
    });
  };

  const handleConfirmCut = () => {
    startTransition(async () => {
      const result = await cutPlayerFromRoster(leagueSlug, player.id);
      if (!result.success) {
        toast.error(result.error ?? "Could not cut player.");
        return;
      }

      const name = result.playerName?.trim() || playerName;
      toast.success(`${name} cut from your roster`);
      setCutConfirmOpen(false);
      router.refresh();
    });
  };

  const handleClick = () => {
    if (isDisabled) return;
    if (action.kind === "trade") {
      if (tradeHref) {
        router.push(tradeHref);
      }
      return;
    }
    if (action.kind === "cut") {
      setCutConfirmOpen(true);
      return;
    }
    if (action.kind === "claim") {
      handleClaim();
      return;
    }
    if (action.kind === "add") {
      handleAdd();
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className={
                  isDisabled ? "inline-flex cursor-not-allowed" : "inline-flex"
                }
              />
            }
          >
            <Button
              type="button"
              variant={action.variant}
              size="icon-sm"
              aria-label={tooltip}
              disabled={isDisabled}
              onClick={handleClick}
            >
              <HugeiconsIcon icon={action.icon} strokeWidth={2} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <CutPlayerDialog
        open={cutConfirmOpen}
        onOpenChange={setCutConfirmOpen}
        playerName={playerName}
        isPending={isPending}
        onConfirm={handleConfirmCut}
      />

      <CutToAddDialog
        leagueSlug={leagueSlug}
        state={cutDialog}
        onOpenChange={(open) => {
          if (!open) {
            setCutDialog(null);
            return;
          }
          setCutDialog((current) =>
            current ? { ...current, open: true } : current,
          );
        }}
      />

      <ClaimPlayerDialog
        leagueSlug={leagueSlug}
        state={claimDialog}
        onOpenChange={(open) => {
          if (!open) {
            setClaimDialog(null);
            return;
          }
          setClaimDialog((current) =>
            current ? { ...current, open: true } : current,
          );
        }}
      />
    </>
  );
}
