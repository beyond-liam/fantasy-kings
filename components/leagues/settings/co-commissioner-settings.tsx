"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PageFormActions } from "@/components/layout/page-form-actions";
import type { MembershipOwnerOption } from "@/lib/leagues/membership";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateCoCommissioners } from "@/lib/actions/league-settings";
import { settingsHref } from "@/lib/leagues/settings-tabs";
import { cn } from "@/lib/utils";

type CoCommissionerSettingsProps = {
  slug: string;
  owners: MembershipOwnerOption[];
};

export function CoCommissionerSettings({
  slug,
  owners,
}: CoCommissionerSettingsProps) {
  const router = useRouter();
  const candidates = useMemo(
    () => owners.filter((owner) => owner.role !== "commissioner"),
    [owners],
  );
  const baseline = useMemo(
    () =>
      candidates
        .filter((owner) => owner.role === "co_commissioner")
        .map((owner) => owner.userId)
        .toSorted(),
    [candidates],
  );
  const [selected, setSelected] = useState<string[]>(() => [...baseline]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSorted = [...selected].toSorted();
  const hasChanges =
    selectedSorted.length !== baseline.length ||
    selectedSorted.some((id, index) => id !== baseline[index]);

  const toggle = (userId: string, checked: boolean) => {
    setSelected((prev) =>
      checked
        ? prev.includes(userId)
          ? prev
          : [...prev, userId]
        : prev.filter((id) => id !== userId),
    );
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateCoCommissioners(slug, selected);
      if (!result.success) {
        setError(result.error ?? "Could not update co-commissioners.");
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
          Appoint Co-Commissioners
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Co-commissioners can manage league settings. The primary commissioner
          stays in charge of appointing them.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card size="sm" className="gap-0 py-0">
        <CardHeader className="border-b py-(--card-spacing)">
          <CardTitle>Owners</CardTitle>
          <CardDescription>
            Select one or more managers to appoint as co-commissioners.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {candidates.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No other owners in this league yet.
            </p>
          ) : (
            <ul>
              {candidates.map((owner, index) => {
                const id = `co-${owner.userId}`;
                const checked = selected.includes(owner.userId);
                return (
                  <li
                    key={owner.userId}
                    className={cn(
                      "flex min-h-12 items-center gap-3 px-4 py-3",
                      index > 0 && "border-t",
                      checked && "bg-muted/50",
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggle(owner.userId, value === true)
                      }
                    />
                    <Label
                      htmlFor={id}
                      className="flex min-w-0 flex-1 cursor-pointer flex-col items-start gap-0.5 text-left font-normal"
                    >
                      <span className="truncate text-sm font-medium">
                        {owner.displayName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {owner.teamName}
                      </span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

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
