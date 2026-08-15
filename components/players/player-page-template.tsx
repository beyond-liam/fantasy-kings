import { PlayerIdentityCard } from "@/components/players/player-identity-card";
import { PlayerPageHero } from "@/components/players/player-page-hero";
import { PlayerProfilePanel } from "@/components/players/player-profile-panel";
import type { PlayerProfile } from "@/lib/queries/player-profile";

type PlayerPageTemplateProps = {
  profile: PlayerProfile;
};

export function PlayerPageTemplate({ profile }: PlayerPageTemplateProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Clip hero full-bleed only — not the overlapping avatar */}
      <div className="overflow-x-hidden">
        <PlayerPageHero
          nflTeam={profile.nflTeam}
          leagueSlug={profile.leagueSlug}
        />
      </div>

      {/* Container queries so side-by-side tracks content width (league sidebar), not viewport */}
      <div className="@container relative z-10 mx-auto w-full max-w-screen-2xl px-4 pb-8 sm:px-6 sm:pb-10">
        {/* Shared pull into hero; content card offset matches avatar half-height spacer */}
        <div className="-mt-36 flex flex-col gap-6 sm:-mt-40 @3xl:flex-row @3xl:items-start @3xl:gap-6 @5xl:gap-8">
          <PlayerIdentityCard
            profile={profile}
            className="mx-auto w-full min-w-0 max-w-md @3xl:mx-0 @3xl:sticky @3xl:top-20 @3xl:max-w-none @3xl:basis-[min(100%,20rem)] @3xl:shrink @5xl:basis-[min(100%,24rem)] @3xl:self-start"
          />

          <article className="min-w-0 flex-1 overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-foreground/10 @3xl:mt-20">
            <PlayerProfilePanel profile={profile} />
          </article>
        </div>
      </div>
    </div>
  );
}
