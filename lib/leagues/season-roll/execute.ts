import "server-only";

import { and, eq } from "drizzle-orm";

import {
  divisions,
  draftPickAssets,
  leagueActivity,
  leagues,
  leagueSeasons,
  rosterPlayers,
  teams,
} from "@/db/schema";
import { db } from "@/lib/db";
import { pickSlotAndOverall } from "@/lib/leagues/draft-pick-label";
import { getDraftRounds } from "@/lib/leagues/draft/board";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import {
  maxConfigurableDynastyDraftRounds,
  resolveDynastySettings,
} from "@/lib/leagues/dynasty-settings";
import { evaluateSeasonRoll } from "@/lib/leagues/season-roll/evaluate";
import {
  assignReverseFinishDraftSlots,
  mintDraftPickAssetSpecs,
  mintDraftPickYears,
  nextSeasonDraftStartAt,
  settingsForRolledDynastySeason,
} from "@/lib/leagues/season-roll";
import type { LeagueStandingsMember } from "@/lib/leagues/standings";

type LeagueRow = typeof leagues.$inferSelect;
type SeasonRow = typeof leagueSeasons.$inferSelect;

export type ExecuteSeasonRollResult =
  | { ok: true; seasonYear: number; keepersCarried: number; picksMinted: number }
  | { ok: false; error: string };

export async function executeSeasonRoll(input: {
  league: LeagueRow;
  season: SeasonRow;
  standingsTeams: LeagueStandingsMember[];
  actorUserId: string;
  now?: Date;
}): Promise<ExecuteSeasonRollResult> {
  const now = input.now ?? new Date();
  const evaluation = await evaluateSeasonRoll(
    input.season,
    input.standingsTeams,
  );
  if (!evaluation.eligible) {
    return {
      ok: false,
      error: evaluation.error ?? "This season is not ready to roll forward.",
    };
  }

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(leagueSeasons)
      .where(eq(leagueSeasons.id, input.season.id))
      .for("update")
      .limit(1);

    if (!locked) {
      return { ok: false, error: "League season not found." };
    }
    if (locked.leagueType !== "dynasty") {
      return {
        ok: false,
        error: "Starting a new season is only available in dynasty leagues.",
      };
    }

    const nextSeasonYear = locked.seasonYear + 1;
    const [existingNext] = await tx
      .select({ id: leagueSeasons.id })
      .from(leagueSeasons)
      .where(
        and(
          eq(leagueSeasons.leagueId, locked.leagueId),
          eq(leagueSeasons.seasonYear, nextSeasonYear),
        ),
      )
      .limit(1);

    if (existingNext) {
      return { ok: false, error: "The next season has already been started." };
    }

    const settings = settingsForRolledDynastySeason(
      locked.settings,
      locked.benchSlots,
    );

    const [newSeason] = await tx
      .insert(leagueSeasons)
      .values({
        leagueId: locked.leagueId,
        seasonYear: nextSeasonYear,
        status: "recruiting",
        leagueType: locked.leagueType,
        teamCount: locked.teamCount,
        divisionCount: locked.divisionCount,
        playoffTeamCount: locked.playoffTeamCount,
        championshipWeek: locked.championshipWeek,
        regularSeasonEndWeek: locked.regularSeasonEndWeek,
        rosterMode: locked.rosterMode,
        benchSlots: locked.benchSlots,
        irEnabled: locked.irEnabled,
        irSlots: locked.irSlots,
        taxiEnabled: locked.taxiEnabled,
        taxiSlots: locked.taxiSlots,
        scoringPreset: locked.scoringPreset,
        waiversEnabled: locked.waiversEnabled,
        waiverType: locked.waiverType,
        faabBudget: locked.faabBudget,
        tradesEnabled: locked.tradesEnabled,
        tradeProcessing: locked.tradeProcessing,
        tradeDeadlineWeek: locked.tradeDeadlineWeek,
        draftType: locked.draftType,
        draftStartAt: nextSeasonDraftStartAt(locked.draftStartAt, now),
        pickTimeLimitSeconds: locked.pickTimeLimitSeconds,
        emailNotificationsEnabled: locked.emailNotificationsEnabled,
        freeAgencyOpen: false,
        lastWaiverProcessedAt: null,
        waiverProcessingLeaseUntil: null,
        settings,
      })
      .returning();

    if (!newSeason) {
      return { ok: false, error: "Could not create the next season." };
    }

    const oldDivisions = await tx
      .select()
      .from(divisions)
      .where(eq(divisions.leagueSeasonId, locked.id));

    const divisionIdByOld = new Map<string, string>();
    if (oldDivisions.length > 0) {
      const insertedDivisions = await tx
        .insert(divisions)
        .values(
          oldDivisions.map((row) => ({
            leagueSeasonId: newSeason.id,
            name: row.name,
            sortOrder: row.sortOrder,
          })),
        )
        .returning({ id: divisions.id, sortOrder: divisions.sortOrder, name: divisions.name });

      const byKey = new Map(
        insertedDivisions.map((row) => [`${row.sortOrder}:${row.name}`, row.id]),
      );
      for (const old of oldDivisions) {
        const mapped = byKey.get(`${old.sortOrder}:${old.name}`);
        if (mapped) divisionIdByOld.set(old.id, mapped);
      }
    }

    const oldTeams = await tx
      .select()
      .from(teams)
      .where(eq(teams.leagueSeasonId, locked.id));

    if (oldTeams.length === 0) {
      return { ok: false, error: "This league has no teams to carry forward." };
    }

    const ranked = [...evaluation.rankedTeams];
    const seen = new Set(ranked.map((row) => row.teamId));
    for (const team of oldTeams) {
      if (!seen.has(team.id)) {
        ranked.push({ teamId: team.id, rank: null });
      }
    }

    const draftSlots = assignReverseFinishDraftSlots(ranked);
    const slotByOldId = new Map(
      draftSlots.map((row) => [row.teamId, row.draftSlot]),
    );

    const faabRemaining =
      locked.waiversEnabled &&
      locked.waiverType === "faab" &&
      locked.faabBudget != null
        ? locked.faabBudget
        : null;

    const insertedTeams = await tx
      .insert(teams)
      .values(
        oldTeams.map((team) => {
          const draftSlot = slotByOldId.get(team.id) ?? team.draftSlot ?? 1;
          return {
            leagueSeasonId: newSeason.id,
            lineageId: team.lineageId,
            userId: team.userId,
            name: team.name,
            logoUrl: team.logoUrl,
            publicId: team.publicId,
            slug: team.slug,
            divisionId: team.divisionId
              ? (divisionIdByOld.get(team.divisionId) ?? null)
              : null,
            draftSlot,
            autoPickEnabled: false,
            consecutiveExpiredPicks: 0,
            forcedAutoPick: false,
            waiverPriority: draftSlot,
            faabRemaining,
            lastWaiverResultsSeenAt: null,
          };
        }),
      )
      .returning({
        id: teams.id,
        lineageId: teams.lineageId,
        draftSlot: teams.draftSlot,
      });

    const newIdByLineage = new Map(
      insertedTeams.map((row) => [row.lineageId, row.id]),
    );
    const newIdByOldId = new Map<string, string>();
    for (const old of oldTeams) {
      const nextId = newIdByLineage.get(old.lineageId);
      if (nextId) newIdByOldId.set(old.id, nextId);
    }

    for (const old of oldTeams) {
      const nextId = newIdByOldId.get(old.id);
      if (!nextId) continue;
      await tx
        .update(draftPickAssets)
        .set({ ownerTeamId: nextId })
        .where(eq(draftPickAssets.ownerTeamId, old.id));
      await tx
        .update(draftPickAssets)
        .set({ originalTeamId: nextId })
        .where(eq(draftPickAssets.originalTeamId, old.id));
    }

    const keepers = await tx
      .select()
      .from(rosterPlayers)
      .where(
        and(
          eq(rosterPlayers.leagueSeasonId, locked.id),
          eq(rosterPlayers.status, "rostered"),
          eq(rosterPlayers.isKeeper, true),
        ),
      );

    const keeperRows = keepers.flatMap((row) => {
      const nextTeamId = newIdByOldId.get(row.teamId);
      if (!nextTeamId) return [];
      return [
        {
          leagueSeasonId: newSeason.id,
          teamId: nextTeamId,
          playerId: row.playerId,
          status: "rostered" as const,
          slotPositionId: row.slotPositionId,
          taxiActivated: row.taxiActivated,
          isKeeper: true,
          waiverClearsAt: null,
          acquiredAt: now,
        },
      ];
    });

    if (keeperRows.length > 0) {
      await tx.insert(rosterPlayers).values(keeperRows);
    }

    const dynasty = resolveDynastySettings(newSeason.settings.dynasty);
    const rounds = maxConfigurableDynastyDraftRounds({
      rosterCap: getDraftRounds(
        newSeason.settings.rosterSlots,
        newSeason.benchSlots,
      ),
      keepersMax: dynasty.keepersMax,
      isStartup: false,
    });
    const years = mintDraftPickYears(
      newSeason.seasonYear,
      dynasty.futurePickTradeYears,
    );
    const specs = mintDraftPickAssetSpecs({
      teamIds: insertedTeams.map((row) => row.id),
      years,
      rounds,
    });

    let picksMinted = 0;
    if (specs.length > 0) {
      const inserted = await tx
        .insert(draftPickAssets)
        .values(
          specs.map((spec) => ({
            leagueId: input.league.id,
            draftYear: spec.draftYear,
            round: spec.round,
            originalTeamId: spec.originalTeamId,
            ownerTeamId: spec.ownerTeamId,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: draftPickAssets.id });
      picksMinted = inserted.length;
    }

    const draftStyle = resolveDraftSettings(newSeason.settings.draft).style;
    const teamCount = insertedTeams.length;
    if (teamCount > 0 && rounds > 0) {
      for (const team of insertedTeams) {
        if (team.draftSlot == null) continue;
        for (let round = 1; round <= rounds; round += 1) {
          const resolved = pickSlotAndOverall({
            round,
            draftSlot: team.draftSlot,
            teamCount,
            style: draftStyle,
          });
          await tx
            .update(draftPickAssets)
            .set({ slot: resolved.slot, overall: resolved.overall })
            .where(
              and(
                eq(draftPickAssets.originalTeamId, team.id),
                eq(draftPickAssets.draftYear, newSeason.seasonYear),
                eq(draftPickAssets.round, round),
              ),
            );
        }
      }
    }

    await tx.insert(leagueActivity).values({
      leagueSeasonId: newSeason.id,
      type: "season_started",
      actorUserId: input.actorUserId,
      summary: `Commissioner started the ${newSeason.seasonYear} season`,
      metadata: { seasonYear: newSeason.seasonYear },
    });

    return {
      ok: true,
      seasonYear: newSeason.seasonYear,
      keepersCarried: keeperRows.length,
      picksMinted,
    };
  });
}
