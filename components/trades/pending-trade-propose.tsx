"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { proposeTrade } from "@/lib/actions/trades";
import { takePendingTradePropose } from "@/lib/trades/pending-propose";

type PendingTradeProposeProps = {
  leagueSlug: string;
};

export function PendingTradePropose({ leagueSlug }: PendingTradeProposeProps) {
  const router = useRouter();

  useEffect(() => {
    const pending = takePendingTradePropose();
    if (!pending || pending.leagueSlug !== leagueSlug) {
      return;
    }

    void proposeTrade(leagueSlug, {
      receivingTeamId: pending.receivingTeamId,
      proposingOfferIds: pending.proposingOfferIds,
      receivingOfferIds: pending.receivingOfferIds,
      proposingDropIds: pending.proposingDropIds,
      receivingDropIds: pending.receivingDropIds,
      comment: pending.comment,
      counterOfTradeId: pending.counterOfTradeId,
    }).then((result) => {
      if (!result.success) {
        toast.error(
          result.errors?.join(" ") ??
            result.error ??
            "Trade could not be submitted.",
        );
        return;
      }

      toast.success(
        pending.counterOfTradeId
          ? "Counter-offer sent"
          : "Trade proposal sent",
      );
      router.refresh();
    });
  }, [leagueSlug, router]);

  return null;
}
