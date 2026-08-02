import { PlayerIdentityCard } from "@/components/players/player-identity-card";
import { PlayerPageHero } from "@/components/players/player-page-hero";
import { PlayerProfileContent } from "@/components/players/player-profile-dialog";
import type { PlayerProfile } from "@/lib/queries/player-profile";

type PlayerPageTemplateProps = {
  profile: PlayerProfile;
};

export function PlayerPageTemplate({ profile }: PlayerPageTemplateProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Clip hero full-bleed only — not the overlapping avatar */}
      <div className="overflow-x-hidden">
        <PlayerPageHero nflTeam={profile.nflTeam} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-screen-2xl px-4 pb-8 sm:px-6 sm:pb-10">
        {/* Shared pull into hero; content card offset matches avatar half-height spacer */}
        <div className="-mt-36 flex flex-col gap-6 sm:-mt-40 lg:flex-row lg:items-start lg:gap-8">
          <PlayerIdentityCard
            profile={profile}
            className="w-full shrink-0 lg:max-w-md"
          />

          <article className="min-w-0 flex-1 overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-foreground/10 lg:mt-20">
            <PlayerProfileContent
              profile={profile}
              headingLevel="h1"
              showHeader={false}
            />
          </article>
        </div>
      </div>
    </div>
  );
}
