"use client";

import { useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  SearchIcon,
  UserEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { SettingsFormCard } from "@/components/leagues/settings/settings-form-card";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import {
  commishAddPlayerToRoster,
  commishRemovePlayerFromRoster,
} from "@/lib/actions/commish-roster";
import type { TeamRosterPlayer } from "@/lib/leagues/roster-fill";
import type { PlayerSearchRow } from "@/lib/rankings/player-search";
import { PLAYER_SEARCH_PAGE_SIZE } from "@/lib/rankings/player-search";
import type { KeeperTeamOption } from "@/lib/queries/keepers";

type CommishEditRosterProps = {
  slug: string;
  seasonYear: number;
  teams: KeeperTeamOption[];
  selectedTeamId: string;
  players: TeamRosterPlayer[];
};

export function CommishEditRoster({
  slug,
  seasonYear,
  teams,
  selectedTeamId,
  players,
}: CommishEditRosterProps) {
  const router = useRouter();
  const selectedTeam = teams.find((team) => team.teamId === selectedTeamId);
  const [pendingRemove, setPendingRemove] = useState<TeamRosterPlayer | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  const handleRemove = () => {
    if (!pendingRemove) return;
    startTransition(async () => {
      const result = await commishRemovePlayerFromRoster(
        slug,
        selectedTeamId,
        pendingRemove.id,
      );
      if (!result.success) {
        toast.error(result.error ?? "Could not remove player.");
        return;
      }
      toast.success(
        `Dropped ${result.playerName ?? pendingRemove.fullName}`,
      );
      setPendingRemove(null);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingsFormCard
        title="Edit roster"
        description={
          selectedTeam
            ? `${selectedTeam.teamName}${selectedTeam.ownerName ? ` · ${selectedTeam.ownerName}` : " · Open slot"}`
            : "Choose a team to edit."
        }
        contentClassName="flex flex-col gap-6"
      >
        {teams.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={UserEdit01Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>No teams yet</EmptyTitle>
              <EmptyDescription>
                Invite managers before editing rosters.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <FieldGroup>
              <Field>
                <FieldLabel>Team</FieldLabel>
                <FieldDescription>
                  Choose whose roster to edit. Adds and drops apply immediately.
                </FieldDescription>
                <Select
                  items={teams.map((team) => ({
                    value: team.teamId,
                    label: team.ownerName
                      ? `${team.teamName} · ${team.ownerName}`
                      : `${team.teamName} · Open slot`,
                  }))}
                  value={selectedTeamId}
                  onValueChange={(value) => {
                    if (!value) return;
                    router.push(
                      `/league/${slug}/settings/edit-roster?team=${encodeURIComponent(value)}`,
                    );
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {teams.map((team) => (
                        <SelectItem key={team.teamId} value={team.teamId}>
                          {team.ownerName
                            ? `${team.teamName} · ${team.ownerName}`
                            : `${team.teamName} · Open slot`}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {players.length} player{players.length === 1 ? "" : "s"}
              </p>
              <CommishPlayerSearchSheet
                slug={slug}
                seasonYear={seasonYear}
                teamId={selectedTeamId}
                disabled={!selectedTeamId || isPending}
              />
            </div>

            {players.length === 0 ? (
              <Empty size="sm">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={UserEdit01Icon} strokeWidth={2} />
                  </EmptyMedia>
                  <EmptyTitle>Empty roster</EmptyTitle>
                  <EmptyDescription>
                    Add a free-agent player to this team.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <TableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead className="w-16">Slot</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Remove</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <PlayerIdentity
                            fullName={player.fullName}
                            sleeperId={player.sleeperId}
                            primaryPositionId={player.primaryPositionId}
                            nflTeam={player.nflTeam}
                            size="sm"
                            playerId={player.id}
                            leagueSlug={slug}
                          />
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {player.slotPositionId ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={isPending}
                            onClick={() => setPendingRemove(player)}
                            aria-label={`Remove ${player.fullName}`}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              strokeWidth={2}
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableShell>
            )}
          </>
        )}
      </SettingsFormCard>

      <AlertDialog
        open={pendingRemove != null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove player?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove
                ? `${pendingRemove.fullName} will be dropped from ${selectedTeam?.teamName ?? "this team"} and become a free agent.`
                : "This player will become a free agent."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={handleRemove}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CommishPlayerSearchSheet({
  slug,
  seasonYear,
  teamId,
  disabled,
}: {
  slug: string;
  seasonYear: number;
  teamId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [players, setPlayers] = useState<PlayerSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    void (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          offset: "0",
          limit: String(PLAYER_SEARCH_PAGE_SIZE),
          season: String(seasonYear),
        });
        if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
        const response = await fetch(
          `/api/league/${encodeURIComponent(slug)}/players/search?${params}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error("Could not load players.");
        }
        const data = (await response.json()) as { players: PlayerSearchRow[] };
        if (requestId !== requestIdRef.current) return;
        setPlayers(data.players);
      } catch (error) {
        if (controller.signal.aborted) return;
        toast.error(
          error instanceof Error ? error.message : "Could not load players.",
        );
        setPlayers([]);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [open, deferredQuery, slug, seasonYear]);

  const handleAdd = (player: PlayerSearchRow) => {
    setAddingId(player.id);
    void commishAddPlayerToRoster(slug, teamId, player.id).then((result) => {
      setAddingId(null);
      if (!result.success) {
        toast.error(result.error ?? "Could not add player.");
        return;
      }
      toast.success(`Added ${result.playerName ?? player.fullName}`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button type="button" size="sm" disabled={disabled} />
        }
      >
        <HugeiconsIcon
          icon={Add01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Add player
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add player</SheetTitle>
          <SheetDescription>
            Search free agents. Owned players cannot be added until they are
            dropped.
          </SheetDescription>
        </SheetHeader>
        <InputGroup>
          <InputGroupAddon>
            <HugeiconsIcon icon={SearchIcon} strokeWidth={2} />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search players..."
          />
        </InputGroup>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : players.length === 0 ? (
            <Empty size="sm">
              <EmptyHeader>
                <EmptyTitle>No players</EmptyTitle>
                <EmptyDescription>
                  Try a different search.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((player) => {
                const owned = Boolean(player.fantasyTeamId);
                return (
                  <li
                    key={player.id}
                    className="flex items-center justify-between gap-2 rounded-lg border p-2"
                  >
                    <PlayerIdentity
                      fullName={player.fullName}
                      sleeperId={player.sleeperId}
                      primaryPositionId={player.primaryPositionId}
                      nflTeam={player.nflTeam}
                      size="sm"
                      playerId={player.id}
                      leagueSlug={slug}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={owned || addingId === player.id}
                      onClick={() => handleAdd(player)}
                    >
                      <HugeiconsIcon
                        icon={Add01Icon}
                        strokeWidth={2}
                        data-icon="inline-start"
                      />
                      {owned ? player.fantasyTeamName ?? "Owned" : "Add"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
