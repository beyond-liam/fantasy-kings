import { TeamDraftPicksList } from "@/components/team/team-draft-picks-list";
import { TeamFuturePicksList } from "@/components/team/team-future-picks";
import {
  dynastyPickLabel,
  uniqueDraftPickYears,
} from "@/lib/leagues/draft-pick-label";
import { tradeComposerPath } from "@/lib/leagues/utils";
import type { ProposeTradePartner } from "@/lib/leagues/trades/partners";
import { getDraftedRosterForTeam } from "@/lib/queries/draft";
import { getOwnedDraftPickAssets } from "@/lib/queries/draft-pick-assets";

export type TeamDraftPicksPanelProps = {
  teamId: string;
  leagueSlug: string;
  leagueId: string;
  leagueType: "redraft" | "dynasty";
  seasonYear: number;
  tradesEnabled: boolean;
  variant?: "mine" | "other";
  partnerTeamSlug?: string | null;
  partners?: ProposeTradePartner[];
};

export async function MyTeamDraftPicksPanel({
  teamId,
  leagueSlug,
  leagueId,
  leagueType,
  seasonYear,
  tradesEnabled,
  variant = "mine",
  partnerTeamSlug = null,
  partners = [],
}: TeamDraftPicksPanelProps) {
  const draftedPicks = await getDraftedRosterForTeam(teamId);
  const draftedRows = draftedPicks.map((pick) => ({
    overall: pick.overall,
    playerId: pick.playerId,
    playerName: pick.fullName,
    positionId: pick.primaryPositionId,
    nflTeam: pick.nflTeam,
  }));

  if (leagueType !== "dynasty") {
    return <TeamDraftPicksList leagueSlug={leagueSlug} picks={draftedRows} />;
  }

  const assets = await getOwnedDraftPickAssets({
    leagueId,
    ownerTeamId: teamId,
  });
  const singlePartner = partners.length === 1 ? partners[0] : null;
  const futurePicks = assets.map((asset) => {
    const label = dynastyPickLabel({
      draftYear: asset.draftYear,
      round: asset.round,
      slot: asset.slot,
      originalTeamName: asset.originalTeamName,
      isOriginalOwner: asset.originalTeamId === asset.ownerTeamId,
      currentSeasonYear: seasonYear,
      originalTeamDraftSlot: asset.originalTeamDraftSlot,
    });
    const tradeHref = !tradesEnabled
      ? null
      : variant === "other" && partnerTeamSlug
        ? tradeComposerPath(leagueSlug, {
            with: partnerTeamSlug,
            wantPick: asset.id,
          })
        : variant === "mine" && singlePartner
          ? tradeComposerPath(leagueSlug, {
              with: singlePartner.slug,
              offerPick: asset.id,
            })
          : null;

    return {
      id: asset.id,
      draftYear: asset.draftYear,
      primary: label.primary,
      secondary: label.secondary,
      tradeHref,
      tradeLabel:
        variant === "other" ? "Trade for pick" : "Offer pick for trade",
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <TeamFuturePicksList
        picks={futurePicks}
        years={uniqueDraftPickYears(futurePicks.map((pick) => pick.draftYear))}
        leagueSlug={leagueSlug}
        partners={
          variant === "mine" && tradesEnabled && partners.length > 1
            ? partners
            : []
        }
      />
      {draftedRows.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-semibold tracking-tight">
            Players drafted
          </h3>
          <TeamDraftPicksList leagueSlug={leagueSlug} picks={draftedRows} />
        </div>
      ) : null}
    </div>
  );
}
