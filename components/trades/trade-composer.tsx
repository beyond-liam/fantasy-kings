"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft02Icon, ArrowLeftRightIcon, LicenseDraftIcon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerAvatar } from "@/components/rankings/player-avatar";
import { PlayerIdentity } from "@/components/rankings/player-identity";
import { TradeConfirmDialog } from "@/components/trades/trade-confirm-dialog";
import { TradePicksTable, type TradePickRow } from "@/components/trades/trade-picks-table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  classifyDropCandidatesForMinimums,
  wouldOfferingBreachRosterMinimums,
} from "@/lib/leagues/roster-minimums";
import { listDropCandidates } from "@/lib/leagues/trades/validate";
import { hasUpcomingKickoffWithinHours } from "@/lib/leagues/trades/week-hold";
import { myTeamPath } from "@/lib/leagues/utils";
import { teamInitials } from "@/lib/leagues/standings";
import { stashPendingTradePropose } from "@/lib/trades/pending-propose";
import type { TradePlayerRow } from "@/lib/queries/trades";
import type { RosterSlotConfig } from "@/db/schema/league-seasons";

const PlayerProfileDialog = dynamic(
  () =>
    import("@/components/players/player-profile-dialog").then(
      (m) => m.PlayerProfileDialog,
    ),
  { ssr: false },
);

export type TradePartnerOption = {
  id: string;
  name: string;
  slug: string;
  publicId?: string | null;
};

type TradeComposerProps = {
  leagueSlug: string;
  myTeam: { id: string; name: string };
  partner: TradePartnerOption;
  myRoster: TradePlayerRow[];
  partnerRoster: TradePlayerRow[];
  initialWantIds: string[];
  initialOfferIds: string[];
  initialWantPickIds?: string[];
  initialOfferPickIds?: string[];
  myPicks?: TradePickRow[];
  partnerPicks?: TradePickRow[];
  showPicks?: boolean;
  counterOfTradeId?: string | null;
  rosterSlots: RosterSlotConfig[] | null | undefined;
  benchSlots: number;
  tradeProcessing?: string;
  enforceRosterMinimums?: boolean;
  /** ISO kickoff times keyed by NFL abbreviation (upper). */
  kickoffsByNflTeam?: Record<string, string>;
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
  picks = [],
  label,
  sectionLabel,
  leagueSlug,
}: {
  players: TradePlayerRow[];
  picks?: TradePickRow[];
  label: string;
  sectionLabel: string;
  leagueSlug: string;
}) {
  const visiblePlayers = players.slice(0, VISIBLE_CHIPS);
  const overflowPlayers = players.length - visiblePlayers.length;
  const visiblePicks = picks.slice(0, players.length === 0 ? VISIBLE_CHIPS : 2);

  return (
    <>
      {visiblePlayers.map((player) => (
        <TradePlayerChip
          key={player.id}
          player={player}
          leagueSlug={leagueSlug}
        />
      ))}
      {visiblePicks.map((pick) => (
        <span
          key={pick.id}
          className="max-w-20 truncate rounded-full bg-muted px-2 py-1 text-[10px] font-medium tabular-nums text-foreground"
        >
          {pick.primary}
        </span>
      ))}
      {overflowPlayers > 0 ? (
        <Popover>
          <PopoverTrigger
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-muted/80 active:scale-[0.96]"
            aria-label={`Show all ${players.length + picks.length} assets`}
          >
            +{overflowPlayers + Math.max(0, picks.length - visiblePicks.length)}
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
                    playerId={player.id}
                    leagueSlug={leagueSlug}
                  />
                </li>
              ))}
              {picks.map((pick) => (
                <li key={pick.id} className="text-sm tabular-nums">
                  {pick.primary}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
      {players.length === 0 && picks.length === 0 ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
    </>
  );
}

function TradePlayerChip({
  player,
  leagueSlug,
}: {
  player: TradePlayerRow;
  leagueSlug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="group/player-chip flex min-w-0 max-w-24 flex-col items-center gap-1 text-left focus-visible:outline-none"
        onClick={() => setOpen(true)}
      >
        <PlayerAvatar
          fullName={player.fullName}
          sleeperId={player.sleeperId}
          primaryPositionId={player.primaryPositionId}
          nflTeam={player.nflTeam}
          size="sm"
        />
        <span className="w-full truncate text-center text-[10px] leading-tight text-foreground underline-offset-2 group-hover/player-chip:underline group-focus-visible/player-chip:underline">
          {shortName(player.fullName)}
        </span>
      </button>
      <PlayerProfileDialog
        playerId={open ? player.id : null}
        leagueSlug={leagueSlug}
        open={open}
        onOpenChange={setOpen}
      />
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
  initialWantPickIds = [],
  initialOfferPickIds = [],
  myPicks = [],
  partnerPicks = [],
  showPicks = false,
  counterOfTradeId = null,
  rosterSlots,
  benchSlots,
  tradeProcessing,
  enforceRosterMinimums = false,
  kickoffsByNflTeam = {},
}: TradeComposerProps) {
  const [myOfferIds, setMyOfferIds] = useState(
    () => new Set(initialOfferIds),
  );
  const [theirOfferIds, setTheirOfferIds] = useState(
    () => new Set(initialWantIds),
  );
  const [myPickIds, setMyPickIds] = useState(
    () => new Set(initialOfferPickIds),
  );
  const [theirPickIds, setTheirPickIds] = useState(
    () => new Set(initialWantPickIds),
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
  const myOfferPicks = useMemo(
    () => myPicks.filter((pick) => myPickIds.has(pick.id)),
    [myPicks, myPickIds],
  );
  const theirOfferPicks = useMemo(
    () => partnerPicks.filter((pick) => theirPickIds.has(pick.id)),
    [partnerPicks, theirPickIds],
  );

  const myMinimumBlockedOfferIds = useMemo(() => {
    if (!enforceRosterMinimums) return new Set<string>();
    const receiving = theirOfferPlayers.map((player) => ({
      id: player.id,
      slotPositionId: player.slotPositionId,
      primaryPositionId: player.primaryPositionId,
    }));
    const roster = myRoster.map((player) => ({
      id: player.id,
      slotPositionId: player.slotPositionId,
      primaryPositionId: player.primaryPositionId,
    }));
    const blocked = new Set<string>();
    for (const player of myRoster) {
      if (
        wouldOfferingBreachRosterMinimums({
          roster,
          offeringIds: myOfferIds,
          receiving,
          playerId: player.id,
          rosterSlots,
          enforce: true,
        })
      ) {
        blocked.add(player.id);
      }
    }
    return blocked;
  }, [
    enforceRosterMinimums,
    myRoster,
    myOfferIds,
    theirOfferPlayers,
    rosterSlots,
  ]);

  const warnWeekEndFromKickoff =
    tradeProcessing === "review_24h" &&
    hasUpcomingKickoffWithinHours({
      hours: 24,
      kickoffs: [...myOfferPlayers, ...theirOfferPlayers].map((player) => {
        const abbr = player.nflTeam?.trim().toUpperCase();
        if (!abbr) return null;
        const iso =
          kickoffsByNflTeam[abbr] ??
          (abbr === "WAS" ? kickoffsByNflTeam.WSH : null) ??
          (abbr === "WSH" ? kickoffsByNflTeam.WAS : null);
        return iso ? new Date(iso) : null;
      }),
    });

  const canContinue =
    (myOfferPlayers.length > 0 || myOfferPicks.length > 0) &&
    (theirOfferPlayers.length > 0 || theirOfferPicks.length > 0);

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

    const proposing = listDropCandidates(
      myRosterSim,
      [...myOfferIds],
      myReceiving,
      rosterSlots,
      benchSlots,
    );
    const receiving = listDropCandidates(
      theirRosterSim,
      [...theirOfferIds],
      theirReceiving,
      rosterSlots,
      benchSlots,
    );

    const proposingMin = classifyDropCandidatesForMinimums({
      candidates: proposing.candidates,
      roster: myRosterSim,
      rosterSlots,
      enforce: enforceRosterMinimums,
      incoming: myReceiving,
      alsoRemovingIds: myOfferIds,
    });

    return {
      proposing,
      receiving,
      proposingMinimumBlockedIds: new Set(
        proposingMin.ineligible.map((row) => row.player.id),
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
    enforceRosterMinimums,
  ]);

  const handlePropose = (input: {
    comment: string;
    expiresAt: Date | null;
  }) => {
    stashPendingTradePropose({
      leagueSlug,
      receivingTeamId: partner.id,
      proposingOfferIds: [...myOfferIds],
      receivingOfferIds: [...theirOfferIds],
      proposingDropIds,
      receivingDropIds,
      proposingPickIds: [...myPickIds],
      receivingPickIds: [...theirPickIds],
      comment: input.comment,
      expiresAt: input.expiresAt?.toISOString() ?? null,
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
              ? "Adjust the players and picks, then send your counter-offer."
              : showPicks
                ? "Select players or picks from each team, then review before sending."
                : "Select players from each roster, then review before sending."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ComposerTeamColumn
          teamName={myTeam.name}
          showPicks={showPicks}
          defaultTab={
            initialOfferPickIds.length > 0 && initialOfferIds.length === 0
              ? "picks"
              : "roster"
          }
          roster={
            <TradeRosterTable
              teamName={showPicks ? null : myTeam.name}
              players={myRoster}
              selectedIds={myOfferIds}
              onToggle={(id) =>
                setMyOfferIds((current) => toggleSet(current, id))
              }
              leagueSlug={leagueSlug}
              blockedIds={myMinimumBlockedOfferIds}
            />
          }
          picks={
            <TradePicksTable
              teamName={null}
              picks={myPicks}
              selectedIds={myPickIds}
              onToggle={(id) =>
                setMyPickIds((current) => toggleSet(current, id))
              }
            />
          }
        />
        <ComposerTeamColumn
          teamName={partner.name}
          showPicks={showPicks}
          defaultTab={
            initialWantPickIds.length > 0 && initialWantIds.length === 0
              ? "picks"
              : "roster"
          }
          roster={
            <TradeRosterTable
              teamName={showPicks ? null : partner.name}
              players={partnerRoster}
              selectedIds={theirOfferIds}
              onToggle={(id) =>
                setTheirOfferIds((current) => toggleSet(current, id))
              }
              leagueSlug={leagueSlug}
            />
          }
          picks={
            <TradePicksTable
              teamName={null}
              picks={partnerPicks}
              selectedIds={theirPickIds}
              onToggle={(id) =>
                setTheirPickIds((current) => toggleSet(current, id))
              }
            />
          }
        />
      </div>

      <FloatingActionBar>
        <FloatingActionBarSection label="You offer">
          <TradeSideChips
            players={myOfferPlayers}
            picks={myOfferPicks}
            label="None selected"
            sectionLabel="You offer"
            leagueSlug={leagueSlug}
          />
        </FloatingActionBarSection>
        <FloatingActionBarSection label="You receive">
          <TradeSideChips
            players={theirOfferPlayers}
            picks={theirOfferPicks}
            label="None selected"
            sectionLabel="You receive"
            leagueSlug={leagueSlug}
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
        receivingPicks={theirOfferPicks}
        offeringPicks={myOfferPicks}
        proposingDropCandidates={dropPreview.proposing.candidates
          .map((player) => myRoster.find((row) => row.id === player.id))
          .filter((row): row is TradePlayerRow => Boolean(row))}
        proposingDropAnalysis={dropPreview.proposing.analysis}
        proposingMinimumBlockedIds={dropPreview.proposingMinimumBlockedIds}
        receivingDropsNeeded={dropPreview.receiving.needed}
        proposingDropIds={proposingDropIds}
        onProposingDropsChange={setProposingDropIds}
        partnerTeamName={partner.name}
        isCounter={Boolean(counterOfTradeId)}
        leagueSlug={leagueSlug}
        warnWeekEndFromKickoff={warnWeekEndFromKickoff}
        onConfirm={handlePropose}
      />
    </div>
  );
}

function ComposerTeamColumn({
  teamName,
  showPicks,
  defaultTab,
  roster,
  picks,
}: {
  teamName: string;
  showPicks: boolean;
  defaultTab: "roster" | "picks";
  roster: ReactNode;
  picks: ReactNode;
}) {
  if (!showPicks) {
    return roster;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback>{teamInitials(teamName)}</AvatarFallback>
        </Avatar>
        <h2 className="truncate text-lg font-semibold tracking-tight">
          {teamName}
        </h2>
      </div>
      <Tabs defaultValue={defaultTab} className="gap-3">
        <TabsList>
          <TabsTrigger value="roster">
            <HugeiconsIcon
              icon={UserMultipleIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Roster
          </TabsTrigger>
          <TabsTrigger value="picks">
            <HugeiconsIcon
              icon={LicenseDraftIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Picks
          </TabsTrigger>
        </TabsList>
        <TabsContent value="roster">{roster}</TabsContent>
        <TabsContent value="picks">{picks}</TabsContent>
      </Tabs>
    </div>
  );
}
