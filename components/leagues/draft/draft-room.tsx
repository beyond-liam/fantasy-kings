"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DraftBoard } from "@/components/leagues/draft/draft-board";
import { DraftControls } from "@/components/leagues/draft/draft-controls";
import {
  DRAFT_PICKS_EVENT,
  type DraftPicksPollResponse,
} from "@/components/leagues/draft/draft-pick-notifier";
import { DraftPlayerPool } from "@/components/leagues/draft/draft-player-pool";
import { DraftQueuePanel } from "@/components/leagues/draft/draft-queue-panel";
import { DraftQueueProvider } from "@/components/leagues/draft/draft-queue-provider";
import { DraftRosterTab } from "@/components/leagues/draft/draft-roster-tab";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { DraftPickRow, DraftQueueRow } from "@/lib/queries/draft";
import type { DraftScheduleSlot } from "@/lib/leagues/draft/board";
import type { RankedPlayerRow } from "@/lib/queries/players";

type DraftRoomProps = {
  slug: string;
  isCommissioner: boolean;
  myTeamId: string | null;
  status: "scheduled" | "live" | "paused" | "complete" | null;
  currentPickIndex: number;
  onTheClock: DraftScheduleSlot | null;
  canStart: boolean;
  startBlockedReason: string | null;
  schedule: DraftScheduleSlot[];
  picks: DraftPickRow[];
  teams: Array<{
    id: string;
    name: string;
    draftSlot: number;
    logoUrl?: string | null;
  }>;
  rounds: number;
  poolPlayers: RankedPlayerRow[];
  nflTeams: string[];
  queuedItems: DraftQueueRow[];
  draftedPlayerIds: string[];
  myDraftedPlayers: RankedPlayerRow[];
  pickByPlayerId: Record<string, number>;
};

export function DraftRoom({
  slug,
  isCommissioner,
  myTeamId,
  status,
  currentPickIndex,
  onTheClock,
  canStart,
  startBlockedReason,
  schedule,
  picks,
  teams,
  rounds,
  poolPlayers,
  nflTeams,
  queuedItems,
  draftedPlayerIds,
  myDraftedPlayers,
  pickByPlayerId,
}: DraftRoomProps) {
  const router = useRouter();
  const [tab, setTab] = useState("board");
  const draftLive = status === "live";
  const draftComplete = status === "complete";
  const isMyTurn = Boolean(
    draftLive && onTheClock && myTeamId && onTheClock.teamId === myTeamId,
  );

  const queuedPlayerIds = useMemo(
    () => queuedItems.map((item) => item.playerId),
    [queuedItems],
  );

  useEffect(() => {
    let debounceId = 0;

    const onDraftPicks = (event: Event) => {
      const detail = (event as CustomEvent<DraftPicksPollResponse>).detail;
      if (!detail) {
        return;
      }
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        router.refresh();
      }, 500);
    };

    window.addEventListener(DRAFT_PICKS_EVENT, onDraftPicks);
    return () => {
      window.clearTimeout(debounceId);
      window.removeEventListener(DRAFT_PICKS_EVENT, onDraftPicks);
    };
  }, [router]);

  return (
    <DraftQueueProvider slug={slug} initialQueuedIds={queuedPlayerIds}>
      <div className="flex flex-col gap-6">
        <DraftControls
          slug={slug}
          isCommissioner={isCommissioner}
          status={status}
          onTheClock={onTheClock}
          canStart={canStart}
          canRevert={currentPickIndex > 0}
          startBlockedReason={startBlockedReason}
        />

        <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
          <TabsList>
            <TabsTrigger value="board">Draft Board</TabsTrigger>
            <TabsTrigger value="pool">Player Pool</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="roster">Roster</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="pt-4">
            {tab === "board" ? (
              <DraftBoard
                slug={slug}
                schedule={schedule}
                picks={picks}
                teams={teams}
                rounds={rounds}
                currentPickIndex={currentPickIndex}
                status={status}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="pool" className="flex flex-col gap-4 pt-4">
            {tab === "pool" ? (
              <DraftPlayerPool
                slug={slug}
                data={poolPlayers}
                teams={nflTeams}
                draftedPlayerIds={draftedPlayerIds}
                draftLive={draftLive}
                draftComplete={draftComplete}
                isMyTurn={isMyTurn}
                isCommissioner={isCommissioner}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="queue" className="flex flex-col gap-4 pt-4">
            {tab === "queue" ? (
              <DraftQueuePanel slug={slug} items={queuedItems} />
            ) : null}
          </TabsContent>

          <TabsContent value="roster" className="pt-4">
            {tab === "roster" ? (
              <DraftRosterTab
                players={myDraftedPlayers}
                pickByPlayerId={pickByPlayerId}
                leagueSlug={slug}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </DraftQueueProvider>
  );
}
