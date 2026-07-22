import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DraftRoom } from "@/components/leagues/draft/draft-room";
import { getSessionUser } from "@/lib/auth/session";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import {
  getDraftedRosterForTeam,
  getDraftRoomData,
  getTeamDraftQueue,
} from "@/lib/queries/draft";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
} from "@/lib/queries/leagues";
import { getNflTeams, getRankedPlayers } from "@/lib/queries/players";
import { getNflState } from "@/lib/sleeper/api";

type LeagueDraftRoomPageProps = {
  params: Promise<{ leagueId: string }>;
};

export const metadata: Metadata = {
  title: "Draft",
};

export default async function LeagueDraftRoomPage({
  params,
}: LeagueDraftRoomPageProps) {
  const { leagueId: slug } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${slug}/draft`);
  }

  const league = await getLeagueBySlug(slug);
  if (!league) {
    redirect("/leagues");
  }

  const [membership, season] = await Promise.all([
    getLeagueMembership(league.id, user.id),
    getLeagueSeason(league.id),
  ]);

  if (!membership || !season) {
    redirect("/leagues");
  }

  const isCommissioner = membership.role === "commissioner";
  const scoringRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
  );

  const [room, nflState] = await Promise.all([
    getDraftRoomData({
      leagueSeasonId: season.id,
      settings: season.settings,
      benchSlots: season.benchSlots,
    }),
    getNflState(),
  ]);

  const myTeam =
    room.teams.find((team) => team.userId === user.id) ?? null;

  const [poolPlayers, nflTeams, queuedItems, myDraftedPlayers] =
    await Promise.all([
      getRankedPlayers({
        season: nflState.season,
        week: 0,
        kind: "projection",
        scoringRules,
      }).catch(() => []),
      getNflTeams(),
      myTeam ? getTeamDraftQueue(myTeam.id) : Promise.resolve([]),
      myTeam ? getDraftedRosterForTeam(myTeam.id) : Promise.resolve([]),
    ]);

  const canStart =
    room.teams.length >= season.teamCount &&
    room.teams.every((team) => team.draftSlot != null) &&
    room.schedule.length > 0;

  let startBlockedReason: string | null = null;
  if (room.teams.length < season.teamCount) {
    startBlockedReason = `League is not full (${room.teams.length}/${season.teamCount}).`;
  } else if (room.teams.some((team) => team.draftSlot == null)) {
    startBlockedReason = "Set draft order for every team first.";
  }

  const slimPool = poolPlayers.map(toDraftPoolPlayer);
  const poolById = new Map(slimPool.map((player) => [player.id, player]));
  const pickByPlayerId: Record<string, number> = {};
  const myDraftedRanked = [];
  for (const drafted of myDraftedPlayers) {
    pickByPlayerId[drafted.playerId] = drafted.overall;
    const ranked = poolById.get(drafted.playerId);
    if (ranked) {
      myDraftedRanked.push(ranked);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">League Draft</h1>

      <DraftRoom
        slug={slug}
        isCommissioner={isCommissioner}
        myTeamId={myTeam?.id ?? null}
        status={room.draft?.status ?? null}
        currentPickIndex={room.draft?.currentPickIndex ?? 0}
        onTheClock={room.onTheClock}
        canStart={canStart}
        startBlockedReason={startBlockedReason}
        schedule={room.schedule}
        picks={room.picks}
        teams={room.teams}
        rounds={room.rounds}
        poolPlayers={slimPool}
        nflTeams={nflTeams}
        queuedItems={queuedItems}
        draftedPlayerIds={[...room.draftedPlayerIds]}
        myDraftedPlayers={myDraftedRanked}
        pickByPlayerId={pickByPlayerId}
      />
    </div>
  );
}

/** Drop league-only / unused fields before shipping the pool to the client. */
function toDraftPoolPlayer(
  row: Awaited<ReturnType<typeof getRankedPlayers>>[number],
) {
  return {
    id: row.id,
    fullName: row.fullName,
    nflTeam: row.nflTeam,
    primaryPositionId: row.primaryPositionId,
    sleeperId: row.sleeperId,
    yearsExp: row.yearsExp,
    byeWeek: row.byeWeek,
    injuryStatus: row.injuryStatus,
    rookieYear: row.rookieYear,
    stats: row.stats,
    ptsPpr: row.ptsPpr,
    ptsStd: row.ptsStd,
    fantasyPts: row.fantasyPts,
    positionRank: row.positionRank,
  };
}
