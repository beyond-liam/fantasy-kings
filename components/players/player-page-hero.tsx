import { PlayerPageBackButton } from "@/components/players/player-page-back-button";
import {
  contrastForeground,
  getNflTeamColors,
  getNflTeamStadiumUrl,
} from "@/lib/nfl/team-colors";
import { cn } from "@/lib/utils";

type PlayerPageHeroProps = {
  nflTeam: string | null;
  className?: string;
};

export function PlayerPageHero({ nflTeam, className }: PlayerPageHeroProps) {
  const team = getNflTeamColors(nflTeam);
  const headerBg = team?.header ?? undefined;
  const stadiumUrl = getNflTeamStadiumUrl(nflTeam);
  const fg = headerBg ? contrastForeground(headerBg) : undefined;

  return (
    <div
      className={cn(
        // Fill the content column (not the viewport) so league sidebar padding aligns.
        "relative h-44 w-full overflow-hidden sm:h-56 md:h-64",
        !headerBg && !stadiumUrl && "bg-muted",
        className,
      )}
      style={fg ? { color: fg } : undefined}
    >
      {stadiumUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- local public asset
        <img
          src={stadiumUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover select-none"
        />
      ) : null}
      <div
        className={cn(
          "absolute inset-0",
          !headerBg && stadiumUrl && "bg-black/55",
        )}
        aria-hidden
        style={
          headerBg
            ? {
                backgroundColor: headerBg,
                opacity: stadiumUrl ? 0.62 : 0.85,
              }
            : undefined
        }
      />

      <div className="absolute inset-x-0 top-0 z-10 px-4 pt-3 sm:px-6 sm:pt-4">
        <PlayerPageBackButton />
      </div>
    </div>
  );
}
