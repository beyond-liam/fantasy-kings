"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { settingsHref } from "@/lib/leagues/settings-tabs";

import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLeagueSize } from "@/lib/actions/league-settings";
import {
  TEAM_COUNT_MAX,
  TEAM_COUNT_MIN,
} from "@/lib/leagues/season-calendar";

const DIVISION_COUNT_OPTIONS = [1, 2, 3, 4] as const;

export type LeagueSizeDivision = {
  id: string;
  name: string;
};

type LeagueSizeSettingsProps = {
  slug: string;
  teamCount: number;
  memberCount: number;
  divisionCount: number;
  divisions: LeagueSizeDivision[];
};

function defaultDivisionName(index: number) {
  return `Division ${String.fromCharCode(65 + index)}`;
}

function buildDivisionNames(
  count: number,
  existing: LeagueSizeDivision[],
  previousNames: string[],
) {
  return Array.from({ length: count }, (_, index) => {
    return (
      previousNames[index]?.trim() ||
      existing[index]?.name.trim() ||
      defaultDivisionName(index)
    );
  });
}

export function LeagueSizeSettings({
  slug,
  teamCount,
  memberCount,
  divisionCount,
  divisions,
}: LeagueSizeSettingsProps) {
  const router = useRouter();
  const [nextTeamCount, setNextTeamCount] = useState(String(teamCount));
  const [nextDivisionCount, setNextDivisionCount] = useState(
    String(divisionCount),
  );
  const [divisionNames, setDivisionNames] = useState(() =>
    buildDivisionNames(Math.max(divisionCount, 1), divisions, []),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const minAllowed = Math.max(TEAM_COUNT_MIN, memberCount);
  const selectedDivisionCount = Number(nextDivisionCount);

  const teamOptions = useMemo(() => {
    return Array.from(
      { length: TEAM_COUNT_MAX - TEAM_COUNT_MIN + 1 },
      (_, i) => TEAM_COUNT_MIN + i,
    ).filter(
      (count) =>
        count >= minAllowed &&
        (selectedDivisionCount <= 1 || count % selectedDivisionCount === 0),
    );
  }, [minAllowed, selectedDivisionCount]);

  const divisionOptions = useMemo(() => {
    const teams = Number(nextTeamCount);
    return DIVISION_COUNT_OPTIONS.filter(
      (count) => count === 1 || teams % count === 0,
    );
  }, [nextTeamCount]);

  const baselineNames = useMemo(
    () =>
      divisionCount > 1
        ? buildDivisionNames(divisionCount, divisions, [])
        : [],
    [divisionCount, divisions],
  );

  const activeNames =
    selectedDivisionCount > 1
      ? divisionNames.slice(0, selectedDivisionCount)
      : [];

  const hasChanges =
    Number(nextTeamCount) !== teamCount ||
    selectedDivisionCount !== divisionCount ||
    (selectedDivisionCount > 1 &&
      (activeNames.length !== baselineNames.length ||
        activeNames.some((name, index) => name !== baselineNames[index])));

  const handleDivisionCountChange = (value: string | null) => {
    if (value == null) return;
    const count = Number(value);
    setNextDivisionCount(value);
    setDivisionNames((current) =>
      buildDivisionNames(count, divisions, current),
    );
    const currentTeams = Number(nextTeamCount);
    if (count > 1 && currentTeams % count !== 0) {
      const nextValid = Array.from(
        { length: TEAM_COUNT_MAX - minAllowed + 1 },
        (_, i) => minAllowed + i,
      ).find((option) => option % count === 0);
      if (nextValid != null) {
        setNextTeamCount(String(nextValid));
      }
    }
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateLeagueSize(slug, {
        teamCount: Number(nextTeamCount),
        divisionCount: selectedDivisionCount,
        divisionNames:
          selectedDivisionCount > 1
            ? divisionNames.slice(0, selectedDivisionCount)
            : undefined,
      });
      if (!result.success) {
        setError(result.error ?? "Could not update league size.");
        return;
      }
      router.push(settingsHref(slug, "league"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Edit League Size
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {memberCount} of {teamCount} slots filled. You can only shrink below
          the current size after removing owners. Team count must divide evenly
          by divisions.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field>
          <FieldLabel>Number of teams</FieldLabel>
          <Select
            value={nextTeamCount}
            onValueChange={(value) => {
              if (value != null) setNextTeamCount(value);
            }}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teamOptions.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} teams
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Minimum right now: {minAllowed}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Divisions</FieldLabel>
          <Select
            value={nextDivisionCount}
            onValueChange={handleDivisionCountChange}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {divisionOptions.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count === 1 ? "No divisions" : `${count} divisions`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Changing divisions may clear team assignments — use Realign
            Divisions after saving.
          </FieldDescription>
        </Field>

        {selectedDivisionCount > 1 ? (
          <Field>
            <FieldLabel>Division names</FieldLabel>
            <div className="mt-2 grid max-w-xl gap-3">
              {Array.from({ length: selectedDivisionCount }, (_, index) => (
                <Input
                  key={`division-name-${index}`}
                  value={divisionNames[index] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDivisionNames((current) => {
                      const next = buildDivisionNames(
                        selectedDivisionCount,
                        divisions,
                        current,
                      );
                      next[index] = value;
                      return next;
                    });
                  }}
                  placeholder={defaultDivisionName(index)}
                  aria-label={`Division ${index + 1} name`}
                />
              ))}
            </div>
          </Field>
        ) : null}
      </FieldGroup>

      <PageFormActions>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => router.push(settingsHref(slug, "league"))}
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isPending || !hasChanges}
          onClick={handleSave}
        >
          <HugeiconsIcon
            icon={TickDouble02Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Save
        </Button>
      </PageFormActions>
    </div>
  );
}
