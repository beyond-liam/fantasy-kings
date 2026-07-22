"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft02Icon, ArrowLeftRightIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import { TradeConfirmDialog } from "@/components/trades/trade-confirm-dialog";
import { TradeRosterTable } from "@/components/trades/trade-roster-table";
import { Button } from "@/components/ui/button";
import {
  FloatingActionBar,
  FloatingActionBarSection,
} from "@/components/ui/floating-action-bar";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listDropCandidates } from "@/lib/leagues/trades/validate";
import { myTeamPath } from "@/lib/leagues/utils";
import { stashPendingTradePropose } from "@/lib/trades/pending-propose";
import type { TradePlayerRow } from "@/lib/queries/trades";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";

export type TradePartnerOption = {
  id: string;
  name: string;
  slug: string;
};

type TradeComposerProps = {
  leagueSlug: string;
  myTeam: { id: string; name: string };
  partner: TradePartnerOption;
  myRoster: TradePlayerRow[];
  partnerRoster: TradePlayerRow[];
  initialWantIds: string[];
  initialOfferIds: string[];
  counterOfTradeId?: string | null;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
};

const VISIBLE_CHIPS = 2;

function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) {
    return fullName;
  }
  return `${parts[0]!.charAt(0)}. ${parts[parts.length - 1]}`;
}

function toggleSet(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function TradeSideChips({
  players,
  label,
  sectionLabel,
}: {
  players: TradePlayerRow[];
  label: string;
  sectionLabel: string;
}) {
  const visible = players.slice(0, VISIBLE_CHIPS);
  const overflow = players.length - visible.length;

  return (
    <>
      {visible.map((player) => (
        <div
          key={player.id}
          className="flex min-w-0 max-w-24 flex-col items-center gap-1"
        >
          <PlayerAvatar
            fullName={player.fullName}
            sleeperId={player.sleeperId}
            primaryPositionId={player.primaryPositionId}
            nflTeam={player.nflTeam}
            size="sm"
          />
          <span className="w-full truncate text-center text-[10px] leading-tight text-foreground">
            {shortName(player.fullName)}
          </span>
        </div>
      ))}
      {overflow > 0 ? (
        <Popover>
          <PopoverTrigger
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-muted/80 active:scale-[0.96]"
            aria-label={`Show all ${players.length} players`}
          >
            +{overflow}
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-64 gap-3 p-3"
          >
            <PopoverHeader>
              <PopoverTitle>{sectionLabel}</PopoverTitle>
            </PopoverHeader>
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {players.map((player) => (
                <li key={player.id}>
                  <PlayerIdentity
                    fullName={player.fullName}
                    sleeperId={player.sleeperId}
                    primaryPositionId={player.primaryPositionId}
                    nflTeam={player.nflTeam}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
      {players.length === 0 ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
    </>
  );
}

export function TradeComposer({
  leagueSlug,
  myTeam,
  partner,
  myRoster,
  partnerRoster,
  initialWantIds,
  initialOfferIds,
  counterOfTradeId = null,
  rosterSlots,
  benchSlots,
}: TradeComposerProps) {
  const [myOfferIds, setMyOfferIds] = useState(
    () => new Set(initialOfferIds),
  );
  const [theirOfferIds, setTheirOfferIds] = useState(
    () => new Set(initialWantIds),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [proposingDropIds, setProposingDropIds] = useState<string[]>([]);
  const [receivingDropIds, setReceivingDropIds] = useState<string[]>([]);

  const myOfferPlayers = useMemo(
    () => myRoster.filter((player) => myOfferIds.has(player.id)),
    [myRoster, myOfferIds],
  );
  const theirOfferPlayers = useMemo(
    () => partnerRoster.filter((player) => theirOfferIds.has(player.id)),
    [partnerRoster, theirOfferIds],
  );

  const canContinue =
    myOfferPlayers.length > 0 && theirOfferPlayers.length > 0;

  const dropPreview = useMemo(() => {
    const myRosterSim = myRoster.map((player) => ({
      id: player.id,
      slotPositionId: player.slotPositionId,
      primaryPositionId: player.primaryPositionId,
    }));
    const theirRosterSim = partnerRoster.map((player) => ({
      id: player.id,
      slotPositionId: player.slotPositionId,
      primaryPositionId: player.primaryPositionId,
    }));

    const myReceiving = theirOfferPlayers.map((player) => ({
      id: player.id,
      slotPositionId: player.slotPositionId,
      primaryPositionId: player.primaryPositionId,
    }));
    const theirReceiving = myOfferPlayers.map((player) => ({
      id: player.id,
      slotPositionId: player.slotPositionId,
      primaryPositionId: player.primaryPositionId,
    }));

    return {
      proposing: listDropCandidates(
        myRosterSim,
        [...myOfferIds],
        myReceiving,
        rosterSlots,
        benchSlots,
      ),
      receiving: listDropCandidates(
        theirRosterSim,
        [...theirOfferIds],
        theirReceiving,
        rosterSlots,
        benchSlots,
      ),
    };
  }, [
    myRoster,
    partnerRoster,
    myOfferIds,
    theirOfferIds,
    myOfferPlayers,
    theirOfferPlayers,
    rosterSlots,
    benchSlots,
  ]);

  const handlePropose = (comment: string) => {
    stashPendingTradePropose({
      leagueSlug,
      receivingTeamId: partner.id,
      proposingOfferIds: [...myOfferIds],
      receivingOfferIds: [...theirOfferIds],
      proposingDropIds,
      receivingDropIds,
      comment,
      ...(counterOfTradeId ? { counterOfTradeId } : {}),
    });

    window.location.assign(`${myTeamPath(leagueSlug)}?tab=transactions`);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 pb-28">
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          nativeButton={false}
          render={<Link href={`/league/${leagueSlug}/trades`} />}
        >
          <HugeiconsIcon
            icon={ArrowLeft02Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Back to trades
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            {counterOfTradeId ? "Counter trade" : "Propose trade"}
          </h1>
          <p className="text-sm text-pretty text-muted-foreground">
            {counterOfTradeId
              ? "Adjust the players, then send your counter-offer."
              : "Select players from each roster, then review before sending."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TradeRosterTable
          teamName={myTeam.name}
          players={myRoster}
          selectedIds={myOfferIds}
          onToggle={(id) => setMyOfferIds((current) => toggleSet(current, id))}
        />
        <TradeRosterTable
          teamName={partner.name}
          players={partnerRoster}
          selectedIds={theirOfferIds}
          onToggle={(id) =>
            setTheirOfferIds((current) => toggleSet(current, id))
          }
        />
      </div>

      <FloatingActionBar>
        <FloatingActionBarSection label="You offer">
          <TradeSideChips
            players={myOfferPlayers}
            label="None selected"
            sectionLabel="You offer"
          />
        </FloatingActionBarSection>
        <FloatingActionBarSection label="You receive">
          <TradeSideChips
            players={theirOfferPlayers}
            label="None selected"
            sectionLabel="You receive"
          />
        </FloatingActionBarSection>
        <Button
          type="button"
          className="shrink-0"
          disabled={!canContinue}
          onClick={() => {
            setProposingDropIds([]);
            setReceivingDropIds([]);
            setConfirmOpen(true);
          }}
        >
          <HugeiconsIcon
            icon={ArrowLeftRightIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          {counterOfTradeId ? "Review counter" : "Propose Trade"}
        </Button>
      </FloatingActionBar>

      <TradeConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        receivingPlayers={theirOfferPlayers}
        offeringPlayers={myOfferPlayers}
        proposingDropCandidates={dropPreview.proposing.candidates
          .map((player) => myRoster.find((row) => row.id === player.id))
          .filter((row): row is TradePlayerRow => Boolean(row))}
        proposingDropAnalysis={dropPreview.proposing.analysis}
        receivingDropsNeeded={dropPreview.receiving.needed}
        proposingDropIds={proposingDropIds}
        onProposingDropsChange={setProposingDropIds}
        partnerTeamName={partner.name}
        isCounter={Boolean(counterOfTradeId)}
        onConfirm={handlePropose}
      />
    </div>
  );
}
