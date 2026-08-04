"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cancel01Icon, TickDouble02Icon, UserRemove01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { ManagerPresenceIndicator } from "@/components/leagues/presence/manager-presence-badge";
import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { PageFormActions } from "@/components/layout/page-form-actions";
import type { MembershipOwnerOption } from "@/lib/leagues/membership";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
  const [savedBaseline, setSavedBaseline] = useState<string[]>(() => [
    ...baseline,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSorted = [...selected].toSorted();
  const hasChanges =
    selectedSorted.length !== savedBaseline.length ||
    selectedSorted.some((id, index) => id !== savedBaseline[index]);

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
        const message = result.error ?? "Could not update co-commissioners.";
        setError(message);
        toast.error(message);
        return;
      }
      setSavedBaseline(selectedSorted);
      toast.success("Co-commissioners updated");
      router.push(settingsHref(slug, "league"));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <SettingsFormCard
        title="Appoint Co-Commissioners"
        contentClassName="p-0"
        footer={
          <PageFormActions float={hasChanges}>
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
        }
      >
        {candidates.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={UserRemove01Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>No other owners yet</EmptyTitle>
              <EmptyDescription>
                Invite managers before assigning co-commissioners.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                      <ManagerPresenceIndicator userId={owner.userId} />
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
      </SettingsFormCard>
    </div>
  );
}
