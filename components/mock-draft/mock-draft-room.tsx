"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import {
  DraftClockCard,
  DraftClockSeconds,
} from "@/components/draft/draft-clock-card";
import { DraftBoard } from "@/components/leagues/draft/draft-board";
import { DraftPlayerPool } from "@/components/leagues/draft/draft-player-pool";
import { DraftRosterTab } from "@/components/leagues/draft/draft-roster-tab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { buildDraftSchedule } from "@/lib/leagues/draft/board";
import { buildPersistedRosterSlots } from "@/lib/leagues/roster";
import { pickBotPlayer } from "@/lib/mock-draft/bot";
import {
  getMockDraftRounds,
  readMockDraftConfig,
  type MockDraftConfig,
} from "@/lib/mock-draft/settings";
import type { DraftPickRow } from "@/lib/queries/draft";
import type { RankedPlayerRow } from "@/lib/queries/players";

function playDraftSound(src: string) {
  try {
    const audio = new Audio(src);
    void audio.play().catch(() => undefined);
  } catch {
    // Autoplay can be blocked until the user interacts with the page.
  }
}

type MockDraftRoomProps = {
  players: RankedPlayerRow[];
};

type MockTeam = {
  id: string;
  name: string;
  draftSlot: number;
  isUser: boolean;
};

function buildTeams(config: MockDraftConfig): MockTeam[] {
  return Array.from({ length: config.teamCount }, (_, index) => {
    const slot = index + 1;
    const isUser = slot === config.userSlot;
    return {
      id: `team-${slot}`,
      name: isUser ? "You" : `CPU ${slot}`,
      draftSlot: slot,
      isUser,
    };
  });
}

export function MockDraftRoom({ players }: MockDraftRoomProps) {
  const router = useRouter();
  const [config] = useState<MockDraftConfig | null>(() => readMockDraftConfig());
  const [currentPickIndex, setCurrentPickIndex] = useState(0);
  const [picks, setPicks] = useState<DraftPickRow[]>([]);
  const [status, setStatus] = useState<"live" | "complete">("live");
  const [secondsLeft, setSecondsLeft] = useState(
    () => readMockDraftConfig()?.pickClockSeconds ?? 60,
  );
  const pickingRef = useRef(false);
  const [tab, setTab] = useState("board");

  const teams = useMemo(
    () => (config ? buildTeams(config) : []),
    [config],
  );
  const userTeamId = useMemo(
    () => teams.find((team) => team.isUser)?.id ?? null,
    [teams],
  );
  const rosterSlots = useMemo(
    () => (config ? buildPersistedRosterSlots(config.roster) : []),
    [config],
  );
  const rounds = config ? getMockDraftRounds(config) : 0;
  const schedule = useMemo(() => {
    if (!config || teams.length === 0 || rounds <= 0) return [];
    return buildDraftSchedule({
      teams,
      rounds,
      style: config.style,
    });
  }, [config, teams, rounds]);

  const draftedPlayerIds = useMemo(
    () => new Set(picks.map((pick) => pick.playerId)),
    [picks],
  );

  const onTheClock = schedule[currentPickIndex] ?? null;
  const isUserTurn = Boolean(
    status === "live" && onTheClock && userTeamId && onTheClock.teamId === userTeamId,
  );

  const picksByTeam = useMemo(() => {
    const map = new Map<string, DraftPickRow[]>();
    for (const pick of picks) {
      const list = map.get(pick.teamId) ?? [];
      list.push(pick);
      map.set(pick.teamId, list);
    }
    return map;
  }, [picks]);

  const availablePlayers = useMemo(
    () => players.filter((player) => !draftedPlayerIds.has(player.id)),
    [players, draftedPlayerIds],
  );

  const nflTeams = useMemo(() => {
    const teamsSet = new Set<string>();
    for (const player of players) {
      if (player.nflTeam) teamsSet.add(player.nflTeam);
    }
    return [...teamsSet].sort();
  }, [players]);

  const myRoster = userTeamId ? (picksByTeam.get(userTeamId) ?? []) : [];

  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const myDraftedPlayers = useMemo(() => {
    const rows: RankedPlayerRow[] = [];
    for (const pick of myRoster) {
      const player = playersById.get(pick.playerId);
      if (player) rows.push(player);
    }
    return rows;
  }, [myRoster, playersById]);

  const pickByPlayerId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const pick of myRoster) {
      map[pick.playerId] = pick.overall;
    }
    return map;
  }, [myRoster]);

  const draftedPlayerIdList = useMemo(
    () => [...draftedPlayerIds],
    [draftedPlayerIds],
  );

  const picksUntilUser = useMemo(() => {
    if (!userTeamId || status !== "live") return null;
    for (let index = currentPickIndex; index < schedule.length; index++) {
      if (schedule[index]?.teamId === userTeamId) {
        return index - currentPickIndex;
      }
    }
    return null;
  }, [currentPickIndex, schedule, status, userTeamId]);

  const applyPick = (
    player: RankedPlayerRow,
    slot: (typeof schedule)[number],
    source: "manual" | "autopick",
  ) => {
    const pick: DraftPickRow = {
      id: `pick-${slot.overall}`,
      overall: slot.overall,
      round: slot.round,
      pickInRound: slot.pickInRound,
      teamId: slot.teamId,
      playerId: player.id,
      source,
      madeAt: new Date(),
      playerFullName: player.fullName,
      playerPositionId: player.primaryPositionId,
      playerNflTeam: player.nflTeam,
      playerByeWeek: player.byeWeek,
      playerSleeperId: player.sleeperId,
    };

    setPicks((current) => [...current, pick]);
    if (userTeamId && slot.teamId !== userTeamId) {
      playDraftSound("/sound-draft-pick.mp3");
    }
    setCurrentPickIndex((index) => {
      const nextIndex = index + 1;
      if (nextIndex >= schedule.length) {
        setStatus("complete");
        toast.success("Mock draft complete");
        return nextIndex;
      }
      if (config) {
        setSecondsLeft(config.pickClockSeconds);
      }
      return nextIndex;
    });
    toast.message(
      `${slot.teamName} drafted ${player.fullName} (${player.primaryPositionId})`,
    );
  };

  const runBotPick = () => {
    if (!config || !onTheClock || status !== "live" || pickingRef.current) {
      return;
    }
    pickingRef.current = true;

    const teamPicks = picksByTeam.get(onTheClock.teamId) ?? [];
    const draftedPositions = teamPicks.map((pick) => pick.playerPositionId);
    const teamPickCount = teamPicks.length;
    const picksRemainingForTeam = rounds - teamPickCount;

    const choice = pickBotPlayer({
      available: availablePlayers,
      draftedPositions,
      rosterSlots,
      scoring: config.scoring,
      picksRemainingForTeam,
    });

    if (choice) {
      const full = availablePlayers.find((player) => player.id === choice.id);
      if (full) {
        applyPick(full, onTheClock, "autopick");
      }
    }
    pickingRef.current = false;
  };

  const draftPlayer = (playerId: string) => {
    if (!config || !onTheClock || !isUserTurn || pickingRef.current) return;
    const player = availablePlayers.find((row) => row.id === playerId);
    if (!player) return;
    pickingRef.current = true;
    applyPick(player, onTheClock, "manual");
    pickingRef.current = false;
  };

  // CPU auto-draft when not user turn
  useEffect(() => {
    if (!config || status !== "live" || !onTheClock || isUserTurn) return;
    const timer = window.setTimeout(() => {
      runBotPick();
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional pick clock side effect
  }, [config, status, onTheClock?.overall, isUserTurn, picks.length]);

  // Cue the user when their turn starts
  useEffect(() => {
    if (!config || status !== "live" || !isUserTurn) return;
    playDraftSound("/sound-youre-up.mp3");
  }, [config, status, isUserTurn, onTheClock?.overall]);

  // User pick clock
  useEffect(() => {
    if (!config || status !== "live" || !isUserTurn) return;
    if (secondsLeft <= 0) {
      const timer = window.setTimeout(() => {
        runBotPick();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((value) => value - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, status, isUserTurn, secondsLeft, onTheClock?.overall]);

  if (!config) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Alert>
          <AlertTitle>No mock draft settings</AlertTitle>
          <AlertDescription>
            Set up scoring, roster, and draft order first.
          </AlertDescription>
        </Alert>
        <Button type="button" render={<Link href="/draft-room" />}>
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Back to settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.push("/draft-room")}
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Settings
            </Button>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Mock Draft
          </h1>
        </div>

        <DraftClockCard
          title={
            status === "complete"
              ? "Draft complete"
              : isUserTurn
                ? "On the clock"
                : "Up next"
          }
          showStopwatch={status !== "complete"}
        >
          {status === "complete" ? (
            <p className="text-sm text-muted-foreground">
              All {schedule.length} picks are in.
            </p>
          ) : isUserTurn && onTheClock ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                You - Pick #{onTheClock.overall}
              </p>
              <DraftClockSeconds seconds={secondsLeft} />
            </div>
          ) : picksUntilUser != null && picksUntilUser > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">You&apos;re up in</p>
              <p className="text-2xl font-semibold tabular-nums">
                {picksUntilUser}{" "}
                <span className="text-base font-medium text-muted-foreground">
                  {picksUntilUser === 1 ? "pick" : "picks"}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No more picks for you.
            </p>
          )}
        </DraftClockCard>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList>
          <TabsTrigger value="board">Draft Board</TabsTrigger>
          <TabsTrigger value="pool">Player Pool</TabsTrigger>
          <TabsTrigger value="roster">Roster</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="pt-4">
          {tab === "board" ? (
            <DraftBoard
              slug="mock"
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
              slug="mock"
              data={players}
              teams={nflTeams}
              draftedPlayerIds={draftedPlayerIdList}
              draftLive={status === "live"}
              draftComplete={status === "complete"}
              isMyTurn={isUserTurn}
              isCommissioner={false}
              showQueue={false}
              onDraftPlayer={draftPlayer}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="roster" className="pt-4">
          {tab === "roster" ? (
            <DraftRosterTab
              players={myDraftedPlayers}
              pickByPlayerId={pickByPlayerId}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
