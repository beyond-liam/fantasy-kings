"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SetupStepValues } from "@/lib/leagues/wizard-schema";
import { playoffTeamCountsForLeague, clampPlayoffTeamCount } from "@/lib/leagues/playoff-settings";
import {
  CHAMPIONSHIP_WEEKS,
  getRegularSeasonEndWeek,
  TEAM_COUNT_MAX,
  TEAM_COUNT_MIN,
} from "@/lib/leagues/season-calendar";

const TEAM_COUNT_ITEMS = Array.from(
  { length: TEAM_COUNT_MAX - TEAM_COUNT_MIN + 1 },
  (_, i) => {
    const count = TEAM_COUNT_MIN + i;
    return { value: String(count), label: `${count} teams` };
  },
);

const DIVISION_COUNT_ITEMS = [1, 2, 3, 4].map((count) => ({
  value: String(count),
  label: String(count),
}));

const CHAMPIONSHIP_WEEK_ITEMS = CHAMPIONSHIP_WEEKS.map((week) => ({
  value: String(week),
  label: `Week ${week}`,
}));

type SetupStepProps = {
  values: SetupStepValues;
  errors: Partial<Record<keyof SetupStepValues, string>>;
  onChange: (values: Partial<SetupStepValues>) => void;
};

export function SetupStep({ values, errors, onChange }: SetupStepProps) {
  const playoffTeamItems = playoffTeamCountsForLeague(values.teamCount).map(
    (count) => ({
      value: String(count),
      label: String(count),
    }),
  );
  const regularSeasonEndWeek = getRegularSeasonEndWeek(
    values.championshipWeek,
    values.playoffTeamCount,
  );

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="leagueName">League name</FieldLabel>
        <Input
          id="leagueName"
          value={values.leagueName}
          onChange={(event) => onChange({ leagueName: event.target.value })}
          placeholder="Sunday Sweat"
        />
        {errors.leagueName ? (
          <FieldError>{errors.leagueName}</FieldError>
        ) : null}
      </Field>

      <Field>
        <FieldLabel>League type</FieldLabel>
        <RadioGroup
          variant="card"
          value={values.leagueType}
          onValueChange={(value) =>
            onChange({ leagueType: value as SetupStepValues["leagueType"] })
          }
          className="sm:grid-cols-2"
        >
          <RadioGroupItem value="redraft">
            <span className="block text-sm font-medium">Redraft</span>
            <span className="block text-sm text-muted-foreground">
              Fresh rosters every season.
            </span>
          </RadioGroupItem>
          <RadioGroupItem value="dynasty">
            <span className="block text-sm font-medium">Dynasty</span>
            <span className="block text-sm text-muted-foreground">
              Keep your core — future picks coming later.
            </span>
          </RadioGroupItem>
        </RadioGroup>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="teamCount">Number of teams</FieldLabel>
          <Select
            items={TEAM_COUNT_ITEMS}
            value={String(values.teamCount)}
            onValueChange={(value) => {
              if (value) {
                const teamCount = Number(value);
                onChange({
                  teamCount,
                  playoffTeamCount: clampPlayoffTeamCount(
                    values.playoffTeamCount,
                    teamCount,
                  ),
                });
              }
            }}
          >
            <SelectTrigger id="teamCount" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TEAM_COUNT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="divisionCount">Number of divisions</FieldLabel>
          <Select
            items={DIVISION_COUNT_ITEMS}
            value={String(values.divisionCount)}
            onValueChange={(value) => {
              if (value) {
                onChange({ divisionCount: Number(value) });
              }
            }}
          >
            <SelectTrigger id="divisionCount" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {DIVISION_COUNT_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.divisionCount ? (
            <FieldError>{errors.divisionCount}</FieldError>
          ) : null}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="playoffTeamCount">Playoff teams</FieldLabel>
          <Select
            items={playoffTeamItems}
            value={String(values.playoffTeamCount)}
            onValueChange={(value) => {
              if (value) {
                onChange({
                  playoffTeamCount: Number(
                    value,
                  ) as SetupStepValues["playoffTeamCount"],
                });
              }
            }}
          >
            <SelectTrigger id="playoffTeamCount" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {playoffTeamItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="championshipWeek">Championship week</FieldLabel>
          <Select
            items={CHAMPIONSHIP_WEEK_ITEMS}
            value={String(values.championshipWeek)}
            onValueChange={(value) => {
              if (value) {
                onChange({
                  championshipWeek: Number(
                    value,
                  ) as SetupStepValues["championshipWeek"],
                });
              }
            }}
          >
            <SelectTrigger id="championshipWeek" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CHAMPIONSHIP_WEEK_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Regular season ends after Week {regularSeasonEndWeek}.
      </p>
    </FieldGroup>
  );
}
