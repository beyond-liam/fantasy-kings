import type { LeagueActivityMetadata } from "@/db/schema/league-activity";

export function formatWaiverAwardSummary(input: {
  teamName: string;
  playerName: string;
  dropPlayerName?: string | null;
  bid?: number | null;
  waiverType: "priority" | "faab";
}): string {
  const bidPart =
    input.waiverType === "faab" && input.bid != null
      ? ` for $${input.bid}`
      : "";
  const dropPart = input.dropPlayerName
    ? ` (dropped ${input.dropPlayerName})`
    : "";
  return `${input.teamName} claimed ${input.playerName}${bidPart}${dropPart}.`;
}

export function formatWaiverFailSummary(input: {
  teamName: string;
  playerName: string;
  failReason: string;
}): string {
  const reason = input.failReason.trim() || "Claim failed.";
  return `${input.teamName} claim on ${input.playerName} failed — ${reason}`;
}

export function buildWaiverActivityMetadata(input: {
  teamName: string;
  playerName: string;
  dropPlayerName?: string | null;
  bid?: number | null;
  failReason?: string | null;
  waiverType: "priority" | "faab";
}): LeagueActivityMetadata {
  return {
    teamName: input.teamName,
    playerName: input.playerName,
    dropPlayerName: input.dropPlayerName ?? null,
    bid: input.bid ?? null,
    failReason: input.failReason ?? null,
    waiverType: input.waiverType,
  };
}
