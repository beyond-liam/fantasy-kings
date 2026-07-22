import { z } from "zod";

import type { LineupLockMode } from "@/db/schema/league-seasons";

export const LINEUP_LOCK_OPTIONS: Array<{
  value: LineupLockMode;
  label: string;
  description: string;
}> = [
  {
    value: "first_game",
    label: "Lock all lineup slots when the first game starts",
    description:
      "Every starter locks together at the kickoff of the first NFL game that week.",
  },
  {
    value: "individual",
    label: "Lock each lineup slot individually at the player's game time",
    description:
      "A starter stays editable until their own NFL game starts that week.",
  },
];

export const DEFAULT_LINEUP_LOCK_MODE: LineupLockMode = "individual";

export const lineupLockModeSchema = z.enum(["first_game", "individual"]);

export function parseLineupLockMode(
  value: string | null | undefined,
): LineupLockMode {
  const parsed = lineupLockModeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_LINEUP_LOCK_MODE;
}
