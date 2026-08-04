"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { Spinner } from "@/components/ui/spinner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlayerGameLogTable } from "@/components/players/player-game-log-table";
import { PlayerOverviewTab } from "@/components/players/player-overview-tab";
import { PlayerSeasonSelect } from "@/components/players/player-season-select";
import type { PlayerProfile } from "@/lib/queries/player-profile";
import {
  getPlayerAvatarUrl,
  getPlayerInitials,
} from "@/lib/sleeper/avatars";

type PlayerProfilePanelProps = {
  profile: PlayerProfile;
};

export function PlayerProfilePanel({ profile }: PlayerProfilePanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [withoutActive, setWithoutActive] = useState(false);
  const [isPending, startTransition] = useTransition();
  const withoutQb1 = profile.withoutQb1;
  const qbAvatarSrc = withoutQb1
    ? getPlayerAvatarUrl({
        sleeperId: withoutQb1.qbSleeperId,
        primaryPositionId: "QB",
        nflTeam: withoutQb1.qbNflTeam,
      })
    : null;

  return (
    <Tabs value={tab} onValueChange={setTab} className="relative gap-0">
      <div className="border-b border-border px-5 pt-4 sm:px-6">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="overview" className="pb-4">Overview</TabsTrigger>
          <TabsTrigger value="matchup" className="pb-4">Matchup</TabsTrigger>
          <TabsTrigger value="game-log" className="pb-4">Game Log</TabsTrigger>
        </TabsList>
      </div>

      <div className="relative flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PlayerSeasonSelect
            season={profile.season}
            availableSeasons={profile.availableSeasons}
            disabled={isPending}
            onSeasonChange={(nextSeason) => {
              setWithoutActive(false);
              const params = new URLSearchParams();
              params.set("season", nextSeason);
              if (profile.leagueSlug) {
                params.set("league", profile.leagueSlug);
              }
              startTransition(() => {
                router.push(`/players/${profile.id}?${params.toString()}`);
              });
            }}
          />
          {tab === "overview" && withoutQb1 ? (
            <Toggle
              variant="outline"
              size="sm"
              pressed={withoutActive && withoutQb1.withoutGames > 0}
              onPressedChange={setWithoutActive}
              disabled={isPending || withoutQb1.withoutGames === 0}
              title={
                withoutQb1.withoutGames === 0
                  ? `No scored weeks without ${withoutQb1.qbLastName}`
                  : undefined
              }
              aria-label={`Without ${withoutQb1.qbLastName} (${withoutQb1.withoutGames}g)`}
              className="gap-2 border aria-pressed:border-rose-500/80 aria-pressed:bg-rose-500/10 aria-pressed:text-rose-600 aria-pressed:hover:bg-rose-500/15 aria-pressed:focus-visible:border-rose-500/80 aria-pressed:focus-visible:ring-rose-500/40 data-pressed:border-rose-500/80 data-pressed:bg-rose-500/10 data-pressed:text-rose-600 data-pressed:hover:bg-rose-500/15 data-pressed:focus-visible:border-rose-500/80 data-pressed:focus-visible:ring-rose-500/40 dark:aria-pressed:border-rose-400/70 dark:aria-pressed:bg-rose-500/15 dark:aria-pressed:text-rose-400 dark:aria-pressed:hover:bg-rose-500/20 dark:aria-pressed:focus-visible:border-rose-400/70 dark:aria-pressed:focus-visible:ring-rose-400/40 dark:data-pressed:border-rose-400/70 dark:data-pressed:bg-rose-500/15 dark:data-pressed:text-rose-400 dark:data-pressed:hover:bg-rose-500/20 dark:data-pressed:focus-visible:border-rose-400/70 dark:data-pressed:focus-visible:ring-rose-400/40"
            >
              <Avatar
                size="sm"
                className="!size-4 after:border-slate-100/25"
                data-icon="inline-start"
              >
                {qbAvatarSrc ? (
                  <AvatarImage src={qbAvatarSrc} alt="" />
                ) : null}
                <AvatarFallback>
                  {getPlayerInitials(withoutQb1.qbFullName)}
                </AvatarFallback>
              </Avatar>
              Without {withoutQb1.qbLastName}
              <span className="text-[11px] font-normal text-muted-foreground">
                ({withoutQb1.withoutGames}g)
              </span>
            </Toggle>
          ) : null}
        </div>

        <TabsContent value="overview" className="mt-0">
          <PlayerOverviewTab
            overview={profile.overview}
            withoutQb1={withoutQb1}
            withoutActive={withoutActive}
          />
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

        {isPending ? (
          <div
            aria-busy="true"
            aria-live="polite"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/70"
          >
            <Spinner className="size-6 text-muted-foreground" />
          </div>
        ) : null}
      </div>
    </Tabs>
  );
}
