"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  LoyaltyCardIcon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { PageFormActions } from "@/components/layout/page-form-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { updateTeamKeepers } from "@/lib/actions/keepers";
import type { DynastySettings } from "@/db/schema/league-seasons";
import {
  countKeepersTowardMax,
  keeperSlotCountsTowardMax,
} from "@/lib/leagues/dynasty-settings";
import { defaultSlotLabel } from "@/lib/leagues/roster-display";
import { compareRosterPositions } from "@/lib/leagues/roster-position-order";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import { cn } from "@/lib/utils";

export type KeeperSelectionPlayer = Pick<
  TeamRosterPlayer,
  | "id"
  | "fullName"
  | "nflTeam"
  | "primaryPositionId"
  | "sleeperId"
  | "slotPositionId"
  | "isKeeper"
>;

type KeepersSelectionProps = {
  slug: string;
  leagueSlug: string;
  players: KeeperSelectionPlayer[];
  dynasty: DynastySettings;
  locked?: boolean;
};

function selectedFingerprint(ids: Set<string>) {
  return [...ids].sort().join("|");
}

function sortKeepers(players: KeeperSelectionPlayer[]) {
  return players.toSorted((a, b) => {
    const slotCmp = compareRosterPositions(
      a.slotPositionId ?? a.primaryPositionId,
      b.slotPositionId ?? b.primaryPositionId,
    );
    if (slotCmp !== 0) return slotCmp;
    return a.fullName.localeCompare(b.fullName);
  });
}

export function KeepersSelection({
  slug,
  leagueSlug,
  players,
  dynasty,
  locked = false,
}: KeepersSelectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const sorted = useMemo(() => sortKeepers(players), [players]);
  const initialSelected = useMemo(() => {
    return new Set(
      players.filter((player) => player.isKeeper).map((player) => player.id),
    );
  }, [players]);
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const serverKey = selectedFingerprint(initialSelected);
  const [syncedKey, setSyncedKey] = useState(serverKey);

  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setSelected(new Set(initialSelected));
  }

  const selectedPlayers = sorted.filter((player) => selected.has(player.id));
  const counting = countKeepersTowardMax(selectedPlayers, dynasty);
  const allowed = dynasty.keepersMax;
  const hasChanges = selectedFingerprint(selected) !== serverKey;
  const maxConfigured = allowed != null;
  const atMax = maxConfigured && counting >= allowed;

  const toggle = (player: KeeperSelectionPlayer) => {
    if (locked) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(player.id)) {
        next.delete(player.id);
        return next;
      }
      if (
        maxConfigured &&
        keeperSlotCountsTowardMax(player.slotPositionId, dynasty) &&
        counting >= allowed
      ) {
        return current;
      }
      next.add(player.id);
      return next;
    });
  };

  const handleReset = () => {
    setSelected(new Set(initialSelected));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateTeamKeepers(slug, [...selected]);
      if (!result.success) {
        toast.error(result.error ?? "Could not save keepers.");
        return;
      }
      toast.success("Keepers saved.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!maxConfigured ? (
        <Alert>
          <AlertDescription>
            Your commissioner must set Keepers max under Dynasty Rules before
            you can save keepers.
          </AlertDescription>
        </Alert>
      ) : null}

      {locked ? (
        <Alert>
          <AlertDescription>
            Keepers are locked until the draft completes.
          </AlertDescription>
        </Alert>
      ) : null}

      {sorted.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={LoyaltyCardIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No players to keep yet</EmptyTitle>
            <EmptyDescription>
              Once players are on your roster — usually after the draft — you
              can mark keepers here to carry into next season.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {maxConfigured ? (
                <>
                  <span className="font-medium tabular-nums text-foreground">
                    {counting}
                  </span>
                  {" Set / "}
                  <span className="font-medium tabular-nums text-foreground">
                    {allowed}
                  </span>
                  {" Allowed"}
                </>
              ) : (
                "Set keepers max in Dynasty Rules before selecting keepers."
              )}
            </p>
            {dynasty.keepersMin != null ? (
              <p className="text-sm text-muted-foreground">
                Minimum{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {dynasty.keepersMin}
                </span>
              </p>
            ) : null}
          </div>

          <TableShell>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Player</TableHead>
                  <TableHead className="w-20">Slot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((player) => {
                  const checked = selected.has(player.id);
                  const counts = keeperSlotCountsTowardMax(
                    player.slotPositionId,
                    dynasty,
                  );
                  const blocked =
                    locked ||
                    !maxConfigured ||
                    (atMax && counts && !checked);
                  return (
                    <TableRow
                      key={player.id}
                      data-state={checked ? "selected" : undefined}
                      className={cn(
                        checked && "bg-muted/50",
                        blocked && !checked && "opacity-60",
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          disabled={blocked && !checked}
                          onCheckedChange={() => {
                            if (!blocked || checked) {
                              toggle(player);
                            }
                          }}
                          aria-label={`Keep ${player.fullName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <PlayerIdentity
                          fullName={player.fullName}
                          sleeperId={player.sleeperId}
                          primaryPositionId={player.primaryPositionId}
                          nflTeam={player.nflTeam}
                          size="sm"
                          playerId={player.id}
                          leagueSlug={leagueSlug}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {defaultSlotLabel(player.slotPositionId ?? "BN")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableShell>

          <PageFormActions float={hasChanges && !locked}>
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !hasChanges || locked}
              onClick={handleReset}
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Reset
            </Button>
            <Button
              type="button"
              disabled={isPending || !hasChanges || locked || !maxConfigured}
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
        </>
      )}
    </div>
  );
}
