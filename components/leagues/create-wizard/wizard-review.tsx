"use client";

import { Edit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import type { CreateLeagueWizardValues } from "@/lib/leagues/wizard-schema";
import { getRegularSeasonEndWeek } from "@/lib/leagues/season-calendar";
import { secondsToPickTime } from "@/lib/leagues/defaults";

type WizardReviewProps = {
  values: CreateLeagueWizardValues;
  onEdit: (step: string) => void;
};

function formatReviewValue(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b([a-z])/g, (_, char: string) => char.toUpperCase())
    .replace(/\bPpr\b/g, "PPR")
    .replace(/\bFaab\b/g, "FAAB");
}

function ReviewRow({
  label,
  value,
  raw,
}: {
  label: string;
  value: string;
  raw?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">
        {raw ? value : formatReviewValue(value)}
      </span>
    </div>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <HugeiconsIcon
        icon={Edit02Icon}
        strokeWidth={2}
        data-icon="inline-start"
        className="size-3.5"
      />
      Edit
    </Button>
  );
}

export function WizardReview({ values, onEdit }: WizardReviewProps) {
  const regularSeasonEndWeek = getRegularSeasonEndWeek(
    values.championshipWeek,
    values.playoffTeamCount,
  );
  const pickTime = secondsToPickTime(
    values.pickTimeUnit === "hours"
      ? values.pickTimeLimit * 3600
      : values.pickTimeLimit * 60,
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">League setup</h3>
          <EditButton onClick={() => onEdit("setup")} />
        </div>
        <ReviewRow label="Name" value={values.leagueName} raw />
        <ReviewRow label="Type" value={values.leagueType} />
        <ReviewRow label="Teams" value={String(values.teamCount)} />
        <ReviewRow label="Divisions" value={String(values.divisionCount)} />
        <ReviewRow label="Playoff teams" value={String(values.playoffTeamCount)} />
        <ReviewRow label="Championship week" value={`Week ${values.championshipWeek}`} />
        <ReviewRow
          label="Regular season ends"
          value={`Week ${regularSeasonEndWeek}`}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Rosters & scoring</h3>
          <EditButton onClick={() => onEdit("roster")} />
        </div>
        <ReviewRow label="Roster mode" value={values.rosterMode} />
        <ReviewRow label="Bench" value={String(values.benchSlots)} />
        <ReviewRow
          label="IR"
          value={values.irEnabled ? String(values.irSlots) : "Off"}
        />
        <ReviewRow
          label="Taxi"
          value={values.taxiEnabled ? String(values.taxiSlots) : "Off"}
        />
        <ReviewRow label="Scoring" value={values.scoringPreset.replaceAll("_", " ")} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Transactions</h3>
          <EditButton onClick={() => onEdit("transactions")} />
        </div>
        <ReviewRow
          label="Waivers"
          value={
            values.waiversEnabled
              ? values.waiverType === "faab"
                ? `FAAB ($${values.faabBudget})`
                : "Priority"
              : "Off"
          }
        />
        <ReviewRow
          label="Trades"
          value={
            values.tradesEnabled
              ? `${values.tradeProcessing.replaceAll("_", " ")} · after week ${values.tradeDeadlineWeek}`
              : "Off"
          }
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Draft</h3>
          <EditButton onClick={() => onEdit("draft")} />
        </div>
        <ReviewRow label="Format" value={values.draftType} />
        <ReviewRow
          label="Start"
          value={new Date(values.draftStartAt).toLocaleString()}
          raw
        />
        <ReviewRow
          label="Pick clock"
          value={`${pickTime.value} ${pickTime.unit}`}
        />
      </section>
    </div>
  );
}
