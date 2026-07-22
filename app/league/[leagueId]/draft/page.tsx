import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DraftRoom } from "@/components/leagues/draft/draft-room";
import { getSessionUser } from "@/lib/auth/session";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import {
  resolveScoringRuleDefinitions,
  type ScoringPreset,
} from "@/lib/leagues/scoring";
import {
  getDraftedRosterForTeam,
  getDraftRoomData,
  getSeasonDraftTeams,
  getTeamDraftQueue,
} from "@/lib/queries/draft";
import {
  getLeagueBySlug,
  getLeagueMembership,
  getLeagueSeason,
  isLeagueCommissioner,
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

  const isCommissioner = await isLeagueCommissioner(league.id, user.id);
  const scoringRules = resolveScoringRuleDefinitions(
    season.scoringPreset as ScoringPreset,
    season.settings.scoringRules,
  );

  const [room, nflState, seasonTeams] = await Promise.all([
    getDraftRoomData({
      leagueSeasonId: season.id,
      settings: season.settings,
      benchSlots: season.benchSlots,
    }),
    getNflState(),
    getSeasonDraftTeams(season.id),
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

  // Soft hints only — commissioner can always start (server auto-assigns slots).
  let startHint: string | null = null;
  if (seasonTeams.length < season.teamCount) {
    startHint = `League is not full (${seasonTeams.length}/${season.teamCount}) — you can still start.`;
  } else if (seasonTeams.some((team) => team.draftSlot == null)) {
    startHint =
      "Some teams are missing draft order — starting will assign remaining slots.";
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

  const draftSettings = resolveDraftSettings(season.settings.draft);
  const onTheClockTeam =
    room.teams.find((team) => team.id === room.onTheClock?.teamId) ?? null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <DraftRoom
        slug={slug}
        isCommissioner={isCommissioner}
        myTeamId={myTeam?.id ?? null}
        status={room.draft?.status ?? null}
        currentPickIndex={room.draft?.currentPickIndex ?? 0}
        onTheClock={room.onTheClock}
        startHint={startHint}
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
        draftType={season.draftType}
        pickTimeLimitSeconds={season.pickTimeLimitSeconds}
        pickTimeLimitEnabled={draftSettings.pickTimeLimitEnabled !== false}
        autoPickEnabled={draftSettings.autoPickEnabled}
        onTheClockTeamAutoPick={Boolean(onTheClockTeam?.autoPickEnabled)}
        draftStartAt={toIso(season.draftStartAt)}
        turnExpiresAt={toIso(room.draft?.turnExpiresAt)}
        pausedSecondsRemaining={room.draft?.pausedSecondsRemaining ?? null}
      />
    </div>
  );
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
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
