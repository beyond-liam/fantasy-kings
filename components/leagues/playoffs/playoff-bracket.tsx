"use client";

import { ChampionIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  BracketMatchup,
  BracketRound,
  BracketSlot,
  PlayoffBracket,
} from "@/lib/leagues/playoff-bracket";
import { teamInitials } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

type PlayoffBracketProps = {
  bracket: PlayoffBracket;
  myTeamPublicId?: string | null;
};

const ROUND_HEADER_HEIGHT = "3.25rem";
const MATCH_WIDTH = "16.5rem";
const CONNECTOR_WIDTH = "2.5rem";
/** Vertical size of one first-round team row (card + breathing room). */
const ROW_HEIGHT_REM = 3.75;

function slotTeamPublicId(slot: BracketSlot): string | null {
  if (slot.type === "team" || slot.type === "bye") {
    return slot.team.teamPublicId;
  }
  return null;
}

function flattenSlots(matchups: BracketMatchup[]): BracketSlot[] {
  return matchups.flatMap((matchup) => [matchup.top, matchup.bottom]);
}

function formatBracketPoints(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

/** Pair source matchups into target slots (prefers TBD when byes pad the next round). */
function buildMergeFeeds(
  sourceSlots: BracketSlot[],
  targetSlots: BracketSlot[] | null,
): Array<{ top: number; bottom: number; target: number }> {
  const sourceCount = sourceSlots.length;
  if (sourceCount < 2 || sourceCount % 2 !== 0) {
    return [];
  }

  const pairCount = sourceCount / 2;

  if (!targetSlots) {
    if (pairCount === 1) {
      return [{ top: 0, bottom: 1, target: 0 }];
    }
    return [];
  }

  const targetCount = targetSlots.length;
  const tbdTargets = targetSlots
    .map((slot, index) => (slot.type === "tbd" ? index : -1))
    .filter((index) => index >= 0);

  if (tbdTargets.length === pairCount) {
    return tbdTargets.map((target, index) => ({
      top: index * 2,
      bottom: index * 2 + 1,
      target,
    }));
  }

  if (targetCount === pairCount) {
    return Array.from({ length: pairCount }, (_, index) => ({
      top: index * 2,
      bottom: index * 2 + 1,
      target: index,
    }));
  }

  return [];
}

function PointsStack({
  score,
  projection,
}: {
  score?: number | null;
  projection?: number | null;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end leading-tight tabular-nums">
      <span className="text-xs text-muted-foreground">
        {formatBracketPoints(score)}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatBracketPoints(projection)}
      </span>
    </div>
  );
}

function TeamCard({
  slot,
  myTeamPublicId,
}: {
  slot: BracketSlot;
  myTeamPublicId?: string | null;
}) {
  const isMine = slotTeamPublicId(slot) === myTeamPublicId;

  return (
    <div
      className={cn(
        "playoff-match w-full overflow-hidden rounded-lg border bg-card shadow-sm",
        isMine && "ring-1 ring-primary/40",
      )}
    >
      {slot.type === "tbd" ? (
        <div className="flex min-h-9 items-center gap-2.5 px-3 py-2">
          <div
            className="size-6 shrink-0 rounded-full border border-dashed border-border"
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {slot.label}
          </span>
          <PointsStack />
        </div>
      ) : (
        <div
          className={cn(
            "flex min-h-9 items-center gap-2.5 px-3 py-2",
            isMine && "bg-primary/10",
          )}
        >
          <span className="w-5 shrink-0 text-center text-xs font-medium tabular-nums text-muted-foreground">
            {slot.team.seed}
          </span>
          <Avatar
            size="sm"
            className="outline outline-black/10 dark:outline-white/10"
          >
            {slot.team.logoUrl ? (
              <AvatarImage src={slot.team.logoUrl} alt="" />
            ) : null}
            <AvatarFallback>{teamInitials(slot.team.teamName)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {slot.team.teamName}
          </span>
          <PointsStack
            score={slot.team.score}
            projection={slot.team.projection}
          />
        </div>
      )}
    </div>
  );
}

function BracketConnectors({
  rowCount,
  sourceCount,
  targetCount,
  feeds,
}: {
  rowCount: number;
  sourceCount: number;
  targetCount: number;
  feeds: Array<{ top: number; bottom: number; target: number }>;
}) {
  if (sourceCount < 1 || targetCount < 1 || rowCount < 1 || feeds.length === 0) {
    return null;
  }

  const sourceSpan = rowCount / sourceCount;
  const targetSpan = rowCount / targetCount;
  const paths: string[] = [];

  const centerY = (index: number, span: number) =>
    (((index + 0.5) * span) / rowCount) * 100;

  for (const feed of feeds) {
    const topY = centerY(feed.top, sourceSpan);
    const botY = centerY(feed.bottom, sourceSpan);
    const midY = centerY(feed.target, targetSpan);
    const r = Math.min(3.5, Math.abs(botY - topY) / 5);
    paths.push(
      [
        `M 0 ${topY}`,
        `H ${50 - r}`,
        `Q 50 ${topY} 50 ${topY + r}`,
        `V ${botY - r}`,
        `Q 50 ${botY} ${50 - r} ${botY}`,
        `H 0`,
        `M 50 ${midY}`,
        `H 100`,
      ].join(" "),
    );
  }

  return (
    <svg
      className="size-full text-border"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {paths.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function RoundColumn({
  round,
  index,
  rowCount,
  bodyHeight,
  myTeamPublicId,
}: {
  round: BracketRound;
  index: number;
  rowCount: number;
  bodyHeight: string;
  myTeamPublicId?: string | null;
}) {
  const slots = flattenSlots(round.matchups);
  const rowSpan = rowCount / slots.length;

  return (
    <div
      className="playoff-round flex shrink-0 flex-col"
      style={{ width: MATCH_WIDTH, animationDelay: `${index * 90}ms` }}
    >
      <div
        className="flex flex-col justify-center gap-0.5 px-1"
        style={{ height: ROUND_HEADER_HEIGHT }}
      >
        <h3 className="text-sm font-semibold tracking-tight text-balance">
          {round.name}
        </h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          {round.weekLabel}
        </p>
      </div>
      <div
        className="grid"
        style={{
          height: bodyHeight,
          gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
        }}
      >
        {slots.map((slot, slotIndex) => {
          const start = Math.floor(slotIndex * rowSpan) + 1;
          const end = Math.floor((slotIndex + 1) * rowSpan) + 1;
          return (
            <div
              key={`${round.id}-${slotIndex}`}
              className="flex items-center px-0.5"
              style={{ gridRow: `${start} / ${end}` }}
            >
              <TeamCard slot={slot} myTeamPublicId={myTeamPublicId} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectorColumn({
  rowCount,
  bodyHeight,
  sourceCount,
  targetCount,
  feeds,
}: {
  rowCount: number;
  bodyHeight: string;
  sourceCount: number;
  targetCount: number;
  feeds: Array<{ top: number; bottom: number; target: number }>;
}) {
  return (
    <div
      className="flex shrink-0 flex-col"
      style={{ width: CONNECTOR_WIDTH }}
      aria-hidden
    >
      <div style={{ height: ROUND_HEADER_HEIGHT }} />
      <div style={{ height: bodyHeight }}>
        <BracketConnectors
          rowCount={rowCount}
          sourceCount={sourceCount}
          targetCount={targetCount}
          feeds={feeds}
        />
      </div>
    </div>
  );
}

function ChampionColumn({
  rowCount,
  bodyHeight,
}: {
  rowCount: number;
  bodyHeight: string;
}) {
  return (
    <div
      className="playoff-round flex shrink-0 flex-col"
      style={{ width: MATCH_WIDTH, animationDelay: "280ms" }}
    >
      <div style={{ height: ROUND_HEADER_HEIGHT }} />
      <div
        className="grid"
        style={{
          height: bodyHeight,
          gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
        }}
      >
        <div
          className="flex items-center px-0.5"
          style={{ gridRow: `1 / ${rowCount + 1}` }}
        >
          <div className="playoff-match w-full overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex min-h-9 items-center gap-2.5 px-3 py-2">
              <span className="flex size-6 shrink-0 items-center justify-center">
                <HugeiconsIcon
                  icon={ChampionIcon}
                  strokeWidth={2}
                  className="size-5 text-warning"
                />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                TBD
              </span>
              <PointsStack />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayoffBracketView({
  bracket,
  myTeamPublicId,
}: PlayoffBracketProps) {
  const rounds = bracket.rounds;
  const rowCount = Math.max(
    1,
    flattenSlots(rounds[0]?.matchups ?? []).length,
  );
  const bodyHeight = `${rowCount * ROW_HEIGHT_REM}rem`;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-balance">
        Playoff Bracket
      </h2>

      <div className="playoff-bracket relative overflow-x-auto rounded-2xl border bg-muted/30 p-4 md:p-6">
        <div className="relative flex min-w-max items-start">
          {rounds.map((round, index) => {
            const next = rounds[index + 1];
            const sourceSlots = flattenSlots(round.matchups);
            const targetSlots = next ? flattenSlots(next.matchups) : null;
            const feeds = buildMergeFeeds(sourceSlots, targetSlots);
            const targetCount = targetSlots?.length ?? 1;

            return (
              <div key={round.id} className="flex items-start">
                <RoundColumn
                  round={round}
                  index={index}
                  rowCount={rowCount}
                  bodyHeight={bodyHeight}
                  myTeamPublicId={myTeamPublicId}
                />
                <ConnectorColumn
                  rowCount={rowCount}
                  bodyHeight={bodyHeight}
                  sourceCount={sourceSlots.length}
                  targetCount={targetCount}
                  feeds={feeds}
                />
              </div>
            );
          })}
          <ChampionColumn
            rowCount={rowCount}
            bodyHeight={bodyHeight}
          />
        </div>
      </div>
    </section>
  );
}
