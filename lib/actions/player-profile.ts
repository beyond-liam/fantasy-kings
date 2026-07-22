"use server";

import { getPlayerProfile } from "@/lib/queries/player-profile";

export async function loadPlayerProfile(input: {
  playerId: string;
  leagueSlug?: string | null;
  season?: string | null;
}) {
  if (!input.playerId.trim()) {
    return { success: false as const, error: "Missing player." };
  }

  try {
    const profile = await getPlayerProfile({
      playerId: input.playerId,
      leagueSlug: input.leagueSlug,
      season: input.season,
    });

    if (!profile) {
      return { success: false as const, error: "Player not found." };
    }

    return { success: true as const, profile };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error ? error.message : "Could not load player profile.",
    };
  }
}
