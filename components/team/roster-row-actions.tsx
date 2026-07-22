"use client";

import Link from "next/link";
import {
  MoreVerticalIcon,
  UserMinus01Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CutPlayerDialog } from "@/components/team/cut-player-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cutPlayerFromRoster } from "@/lib/actions/roster";
import { tradeComposerPath } from "@/lib/leagues/utils";

type RosterRowActionsProps = {
  player?: {
    id: string;
    fullName: string;
  } | null;
  leagueSlug: string;
  disabled?: boolean;
  variant?: "mine" | "opponent";
  partnerTeamSlug?: string;
  tradesEnabled?: boolean;
};

export function RosterRowActions({
  player = null,
  leagueSlug,
  disabled = true,
  variant = "mine",
  partnerTeamSlug,
  tradesEnabled = true,
}: RosterRowActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isDisabled = disabled || !player || isPending || !leagueSlug;

  const tradeHref =
    player && tradesEnabled
      ? variant === "opponent" && partnerTeamSlug
        ? tradeComposerPath(leagueSlug, {
            with: partnerTeamSlug,
            want: player.id,
          })
        : tradeComposerPath(leagueSlug, { offer: player.id })
      : null;

  const handleConfirmCut = () => {
    if (!player || isDisabled) return;

    startTransition(async () => {
      const result = await cutPlayerFromRoster(leagueSlug, player.id);
      if (!result.success) {
        toast.error(result.error ?? "Could not cut player.");
        return;
      }

      const name = result.playerName?.trim() || player.fullName;
      toast.success(`${name} cut from your roster`);
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={isDisabled && variant === "mine"}
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Player actions"
              disabled={variant === "mine" ? isDisabled : !player}
            />
          }
        >
          <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {variant === "mine" ? (
            <DropdownMenuItem
              disabled={isDisabled}
              onClick={() => setConfirmOpen(true)}
            >
              <HugeiconsIcon icon={UserMinus01Icon} strokeWidth={2} />
              Cut player
            </DropdownMenuItem>
          ) : null}
          {tradeHref ? (
            <DropdownMenuItem
              nativeButton={false}
              render={<Link href={tradeHref} />}
            >
              <HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2} />
              {variant === "opponent"
                ? "Trade for player"
                : "Offer player for trade"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2} />
              Trades unavailable
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {variant === "mine" ? (
        <CutPlayerDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          playerName={player?.fullName ?? "this player"}
          isPending={isPending}
          onConfirm={handleConfirmCut}
        />
      ) : null}
    </>
  );
}
