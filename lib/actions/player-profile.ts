"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getPlayerProfile } from "@/lib/queries/player-profile";

export async function loadPlayerProfile(input: {
  playerId: string;
  leagueSlug?: string | null;
  season?: string | null;
}) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false as const, error: "Sign in to view player profiles." };
  }

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
    console.error(error);
    return {
      success: false as const,
      error: "Could not load player profile.",
    };
  }
}
