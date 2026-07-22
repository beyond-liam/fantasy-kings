import type { Metadata } from "next";

import { GameScoreboardHeader } from "@/components/scores/game/game-scoreboard-header";
import { LiveGameDashboard } from "@/components/scores/game/live-game-dashboard";
import { PreGameDashboard } from "@/components/scores/game/pre-game-dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getNflGameSummary } from "@/lib/espn/game-summary";

type NflGamePageProps = {
  params: Promise<{ gameId: string }>;
};

export const metadata: Metadata = {
  title: "Game",
};

export default async function NflGamePage({ params }: NflGamePageProps) {
  const { gameId } = await params;

  let data: Awaited<ReturnType<typeof getNflGameSummary>> | null = null;
  let error: string | null = null;

  try {
    data = await getNflGameSummary(gameId);
  } catch (caught) {
    error =
      caught instanceof Error
        ? caught.message
        : "Failed to load game from ESPN";
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <Alert variant="destructive">
          <AlertTitle>Couldn’t load game</AlertTitle>
          <AlertDescription>
            {error ?? "Game data is unavailable."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const layout = data.game.status === "pre" ? "pre" : "live";

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <GameScoreboardHeader game={data.game} />

      {layout === "pre" ? (
        <PreGameDashboard data={data} />
      ) : (
        <LiveGameDashboard data={data} />
      )}
    </div>
  );
}
