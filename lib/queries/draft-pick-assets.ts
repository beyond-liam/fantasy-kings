import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import { draftPickAssets, teams } from "@/db/schema";
import { db } from "@/lib/db";

const originalTeam = alias(teams, "original_pick_team");

export type OwnedDraftPickAsset = {
  id: string;
  draftYear: number;
  round: number;
  slot: number | null;
  overall: number | null;
  originalTeamId: string;
  ownerTeamId: string;
  originalTeamName: string;
  originalTeamDraftSlot: number | null;
  leagueId?: string;
};

export const getOwnedDraftPickAssets = cache(
  async (input: {
    leagueId: string;
    ownerTeamId: string;
  }): Promise<OwnedDraftPickAsset[]> => {
    const rows = await db
      .select({
        id: draftPickAssets.id,
        draftYear: draftPickAssets.draftYear,
        round: draftPickAssets.round,
        slot: draftPickAssets.slot,
        overall: draftPickAssets.overall,
        originalTeamId: draftPickAssets.originalTeamId,
        ownerTeamId: draftPickAssets.ownerTeamId,
        originalTeamName: originalTeam.name,
        originalTeamDraftSlot: originalTeam.draftSlot,
      })
      .from(draftPickAssets)
      .innerJoin(
        originalTeam,
        eq(draftPickAssets.originalTeamId, originalTeam.id),
      )
      .where(
        and(
          eq(draftPickAssets.leagueId, input.leagueId),
          eq(draftPickAssets.ownerTeamId, input.ownerTeamId),
        ),
      )
      .orderBy(
        asc(draftPickAssets.draftYear),
        asc(draftPickAssets.round),
        asc(draftPickAssets.slot),
      );

    return rows;
  },
);

export const getDraftPickAssetsByIds = cache(
  async (ids: string[]): Promise<OwnedDraftPickAsset[]> => {
    if (ids.length === 0) {
      return [];
    }

    const rows = await db
      .select({
        id: draftPickAssets.id,
        draftYear: draftPickAssets.draftYear,
        round: draftPickAssets.round,
        slot: draftPickAssets.slot,
        overall: draftPickAssets.overall,
        originalTeamId: draftPickAssets.originalTeamId,
        ownerTeamId: draftPickAssets.ownerTeamId,
        originalTeamName: originalTeam.name,
        originalTeamDraftSlot: originalTeam.draftSlot,
        leagueId: draftPickAssets.leagueId,
      })
      .from(draftPickAssets)
      .innerJoin(
        originalTeam,
        eq(draftPickAssets.originalTeamId, originalTeam.id),
      )
      .where(inArray(draftPickAssets.id, ids));

    return rows;
  },
);
