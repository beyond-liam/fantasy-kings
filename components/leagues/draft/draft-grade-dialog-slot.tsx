import { DraftGradeDialog } from "@/components/leagues/draft/draft-grade-dialog";
import {
  DRAFT_GRADE_LETTERS,
  type DraftGradeLetter,
} from "@/lib/leagues/draft/grades";
import { ensureDraftGradesForSeason } from "@/lib/leagues/draft/persist-grades";
import {
  getUnseenDraftGradeForTeam,
  type UnseenDraftGrade,
} from "@/lib/queries/draft-grades";

type DraftGradeDialogSlotProps = {
  leagueSlug: string;
  teamId: string | null | undefined;
  leagueSeasonId: string | null | undefined;
  /**
   * Temporary UI preview — no DB required.
   * Pass `true` / `"1"` for A+, or a letter like `"B+"`.
   */
  preview?: boolean | string;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  leagueName?: string | null;
};

function parsePreviewLetter(preview: boolean | string): DraftGradeLetter {
  if (preview === true || preview === "1" || preview === "true") {
    return "A+";
  }
  const normalized = String(preview).trim().toUpperCase();
  if ((DRAFT_GRADE_LETTERS as string[]).includes(normalized)) {
    return normalized as DraftGradeLetter;
  }
  return "A+";
}

function buildPreviewGrade(input: {
  letter: DraftGradeLetter;
  teamName: string;
  teamLogoUrl: string | null;
  leagueName: string;
}): UnseenDraftGrade {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    draftId: "00000000-0000-4000-8000-000000000002",
    teamId: "00000000-0000-4000-8000-000000000003",
    letter: input.letter,
    score: 92,
    leagueRank: 1,
    teamCount: 12,
    projectedWins: 11,
    projectedLosses: 3,
    playoffOdds: 90,
    championshipOdds: 28,
    headline: "Draft champion",
    teamName: input.teamName,
    teamLogoUrl: input.teamLogoUrl,
    leagueName: input.leagueName,
    bestValue: {
      playerId: "00000000-0000-4000-8000-000000000004",
      fullName: "Saquon Barkley",
      sleeperId: "4866",
      primaryPositionId: "RB",
      nflTeam: "PHI",
      overall: 14,
      round: 2,
      pickInRound: 2,
      adp: 6.2,
    },
    worstValue: {
      playerId: "00000000-0000-4000-8000-000000000005",
      fullName: "Kyle Pitts",
      sleeperId: "4034",
      primaryPositionId: "TE",
      nflTeam: "ATL",
      overall: 22,
      round: 2,
      pickInRound: 10,
      adp: 48.4,
    },
  };
}

/** Server slot — mounts the one-time draft grade dialog when unseen. */
export async function DraftGradeDialogSlot({
  leagueSlug,
  teamId,
  leagueSeasonId,
  preview,
  teamName,
  teamLogoUrl,
  leagueName,
}: DraftGradeDialogSlotProps) {
  if (preview && process.env.NODE_ENV === "development") {
    return (
      <DraftGradeDialog
        leagueSlug={leagueSlug}
        preview
        grade={buildPreviewGrade({
          letter: parsePreviewLetter(preview),
          teamName: teamName?.trim() || "Your team",
          teamLogoUrl: teamLogoUrl ?? null,
          leagueName: leagueName?.trim() || "Fantasy Kings",
        })}
      />
    );
  }

  if (!teamId || !leagueSeasonId) {
    return null;
  }

  try {
    await ensureDraftGradesForSeason(leagueSeasonId);
    const grade = await getUnseenDraftGradeForTeam({
      teamId,
      leagueSeasonId,
    });

    if (!grade) {
      return null;
    }

    return <DraftGradeDialog leagueSlug={leagueSlug} grade={grade} />;
  } catch (error) {
    // Missing migration / transient DB errors must not break draft or league pages.
    console.error("DraftGradeDialogSlot failed", error);
    return null;
  }
}
