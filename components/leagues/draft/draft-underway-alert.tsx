import Link from "next/link";
import type { ReactNode } from "react";
import {
  InformationCircleIcon,
  NoteEditIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { DraftUnderwayBoardSummary } from "@/lib/queries/draft";

type DraftUnderwayAlertProps = {
  slug: string;
  paused?: boolean;
  draftType?: "live" | "email";
  board?: DraftUnderwayBoardSummary | null;
};

function BoardStat({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-info/70">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-info tabular-nums">
        {children}
      </dd>
    </div>
  );
}

export function DraftUnderwayAlert({
  slug,
  paused = false,
  draftType = "live",
  board = null,
}: DraftUnderwayAlertProps) {
  const isEmail = draftType === "email";
  const title = paused
    ? "Draft paused"
    : isEmail
      ? "Draft in progress"
      : "Draft started";

  return (
    <Alert variant="info">
      <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
      <AlertTitle>{title}</AlertTitle>
      {isEmail ? (
        <AlertDescription>
          <dl className="mt-1.5 grid gap-2.5">
            <BoardStat label="Previous pick">
              {board?.previous
                ? `${board.previous.teamName} · ${board.previous.playerFullName} · #${board.previous.overall}`
                : "—"}
            </BoardStat>
            <BoardStat label="On the clock">
              {board?.onTheClock
                ? `${board.onTheClock.teamName} · #${board.onTheClock.overall}`
                : "—"}
            </BoardStat>
            <BoardStat label="Up next">
              {board?.upNext
                ? `${board.upNext.teamName} · #${board.upNext.overall}`
                : "—"}
            </BoardStat>
          </dl>
        </AlertDescription>
      ) : (
        <AlertDescription>
          {paused
            ? "The draft is paused. Jump back in when you're ready."
            : "The draft is underway. Head to the draft room to make picks."}
        </AlertDescription>
      )}
      <AlertAction>
        <Button
          nativeButton={false}
          size="sm"
          variant="outline"
          render={<Link href={`/league/${slug}/draft`} />}
        >
          <HugeiconsIcon
            icon={NoteEditIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Go to Draft
        </Button>
      </AlertAction>
    </Alert>
  );
}
