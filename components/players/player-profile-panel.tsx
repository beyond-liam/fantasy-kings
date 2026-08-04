"use client";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PlayerGameLogTable } from "@/components/players/player-game-log-table";
import { PlayerOverviewTab } from "@/components/players/player-overview-tab";
import { PlayerSeasonSelect } from "@/components/players/player-season-select";
import type { PlayerProfile } from "@/lib/queries/player-profile";

type PlayerProfilePanelProps = {
  profile: PlayerProfile;
};

export function PlayerProfilePanel({ profile }: PlayerProfilePanelProps) {
  return (
    <Tabs defaultValue="overview" className="gap-0">
      <div className="border-b border-border px-5 pt-4 sm:px-6">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="matchup">Matchup</TabsTrigger>
          <TabsTrigger value="game-log">Game Log</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <PlayerSeasonSelect
          season={profile.season}
          availableSeasons={profile.availableSeasons}
          playerId={profile.id}
          leagueSlug={profile.leagueSlug}
        />

        <TabsContent value="overview" className="mt-0">
          <PlayerOverviewTab overview={profile.overview} />
        </TabsContent>

        <TabsContent value="matchup" className="mt-0">
          <Empty className="border-none" size="sm">
            <EmptyHeader>
              <EmptyTitle>Matchup coming soon</EmptyTitle>
              <EmptyDescription>
                This week&apos;s opponent, usage, and start/sit context will live
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </TabsContent>

        <TabsContent value="game-log" className="mt-0">
          <PlayerGameLogTable
            profile={profile}
            stickyBgClassName="bg-background"
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
