"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { RosterBreakdown } from "@/components/leagues/roster/roster-breakdown";
import { RosterPresetPicker } from "@/components/leagues/roster/roster-preset-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  getDefaultCustomRosterSlots,
  type RosterRequirementsValues,
  type RosterUiMode,
} from "@/lib/leagues/roster";
import {
  getDefaultMockDraftConfig,
  parseMockDraftConfig,
  writeMockDraftConfig,
  type MockDraftConfig,
  type MockDraftScoring,
  type MockDraftStyle,
} from "@/lib/mock-draft/settings";
import { cn } from "@/lib/utils";

const TEAM_COUNT_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 4);
const CLOCK_OPTIONS = [
  { value: 30, label: "30 seconds" },
  { value: 45, label: "45 seconds" },
  { value: 60, label: "60 seconds" },
  { value: 90, label: "90 seconds" },
  { value: 120, label: "2 minutes" },
] as const;

function OptionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Label
      className={cn(
        "flex w-full cursor-pointer items-start gap-3 rounded-lg border p-4 has-data-checked:border-primary",
        className,
      )}
    >
      {children}
    </Label>
  );
}

export function MockDraftSettings() {
  const router = useRouter();
  const [config, setConfig] = useState<MockDraftConfig>(getDefaultMockDraftConfig);
  const [uiMode, setUiMode] = useState<RosterUiMode>("standard");
  const [error, setError] = useState<string | null>(null);

  const slotItems = useMemo(
    () =>
      Array.from({ length: config.teamCount }, (_, index) => ({
        value: String(index + 1),
        label: `Pick ${index + 1}`,
      })),
    [config.teamCount],
  );

  const patch = (next: Partial<MockDraftConfig>) => {
    setConfig((current) => {
      const merged = { ...current, ...next };
      if (next.teamCount != null && merged.userSlot > next.teamCount) {
        merged.userSlot = next.teamCount;
      }
      return merged;
    });
  };

  const patchRoster = (next: Partial<RosterRequirementsValues>) => {
    setConfig((current) => ({
      ...current,
      roster: { ...current.roster, ...next },
    }));
  };

  const handleModeChange = (nextMode: RosterUiMode) => {
    if (nextMode === "idp") return;
    setUiMode(nextMode);
    patchRoster({
      rosterMode: nextMode,
      customRosterSlots:
        nextMode === "custom" && config.roster.customRosterSlots.length === 0
          ? getDefaultCustomRosterSlots()
          : config.roster.customRosterSlots,
    });
  };

  const handleStart = () => {
    setError(null);
    const parsed = parseMockDraftConfig({
      ...config,
      roster: {
        ...config.roster,
        irEnabled: false,
        taxiEnabled: false,
      },
    });
    if (!parsed.success) {
      setError(parsed.error);
      return;
    }
    writeMockDraftConfig(parsed.data);
    router.push(
      `/draft-room/live?scoring=${encodeURIComponent(parsed.data.scoring)}`,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Mock Draft
        </h1>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="draft">
        <TabsList>
          <TabsTrigger value="draft">Draft Settings</TabsTrigger>
          <TabsTrigger value="roster">Roster Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="draft" className="pt-4">
          <Card size="sm" className="gap-0 py-0">
            <CardHeader className="border-b bg-muted/40 py-3">
              <CardTitle className="text-base text-balance">
                Draft Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Scoring</FieldLabel>
                  <RadioGroup
                    value={config.scoring}
                    onValueChange={(value) => {
                      if (
                        value === "standard" ||
                        value === "half_ppr" ||
                        value === "full_ppr"
                      ) {
                        patch({ scoring: value satisfies MockDraftScoring });
                      }
                    }}
                    className="grid gap-3 sm:grid-cols-3"
                  >
                    <OptionLabel>
                      <RadioGroupItem value="standard" className="mt-0.5" />
                      <span className="text-sm font-medium">Standard</span>
                    </OptionLabel>
                    <OptionLabel>
                      <RadioGroupItem value="half_ppr" className="mt-0.5" />
                      <span className="text-sm font-medium">Half PPR</span>
                    </OptionLabel>
                    <OptionLabel>
                      <RadioGroupItem value="full_ppr" className="mt-0.5" />
                      <span className="text-sm font-medium">PPR</span>
                    </OptionLabel>
                  </RadioGroup>
                </Field>

                <Field>
                  <FieldLabel>Draft type</FieldLabel>
                  <RadioGroup
                    value={config.style}
                    onValueChange={(value) => {
                      if (value === "snake" || value === "linear") {
                        patch({ style: value satisfies MockDraftStyle });
                      }
                    }}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <OptionLabel>
                      <RadioGroupItem value="snake" className="mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">Snake</span>
                        <span className="text-xs text-muted-foreground">
                          Order reverses each round
                        </span>
                      </div>
                    </OptionLabel>
                    <OptionLabel>
                      <RadioGroupItem value="linear" className="mt-0.5" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">Linear</span>
                        <span className="text-xs text-muted-foreground">
                          Same order every round
                        </span>
                      </div>
                    </OptionLabel>
                  </RadioGroup>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="mock-team-count">
                      Number of teams
                    </FieldLabel>
                    <Select
                      items={TEAM_COUNT_OPTIONS.map((count) => ({
                        value: String(count),
                        label: String(count),
                      }))}
                      value={String(config.teamCount)}
                      onValueChange={(value) => {
                        const next = Number(value);
                        if (Number.isFinite(next)) patch({ teamCount: next });
                      }}
                    >
                      <SelectTrigger id="mock-team-count" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TEAM_COUNT_OPTIONS.map((count) => (
                            <SelectItem key={count} value={String(count)}>
                              {count}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="mock-user-slot">
                      Your draft position
                    </FieldLabel>
                    <Select
                      items={slotItems}
                      value={String(config.userSlot)}
                      onValueChange={(value) => {
                        const next = Number(value);
                        if (Number.isFinite(next)) patch({ userSlot: next });
                      }}
                    >
                      <SelectTrigger id="mock-user-slot" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {slotItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="mock-pick-clock">Your pick clock</FieldLabel>
                  <Select
                    items={CLOCK_OPTIONS.map((option) => ({
                      value: String(option.value),
                      label: option.label,
                    }))}
                    value={String(config.pickClockSeconds)}
                    onValueChange={(value) => {
                      const next = Number(value);
                      if (Number.isFinite(next)) {
                        patch({ pickClockSeconds: next });
                      }
                    }}
                  >
                    <SelectTrigger id="mock-pick-clock" className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {CLOCK_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    CPU teams auto-draft. The clock only applies on your turn —
                    if it expires, you get a need-aware auto-pick.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roster" className="pt-4">
          <Card size="sm" className="gap-0 py-0">
            <CardHeader className="border-b bg-muted/40 py-3">
              <CardTitle className="text-base text-balance">
                Roster Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6 py-4">
              <FieldGroup>
                <Field>
                  <FieldLabel>Roster format</FieldLabel>
                  <RosterPresetPicker
                    value={uiMode}
                    onValueChange={handleModeChange}
                  />
                  <FieldDescription>
                    Same position setup as league roster requirements (starters +
                    bench only).
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <RosterBreakdown
                values={config.roster}
                onChange={patchRoster}
                showReserveSlots={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="button" onClick={handleStart}>
          <HugeiconsIcon
            icon={PlayIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Start Mock Draft
        </Button>
      </div>
    </div>
  );
}
