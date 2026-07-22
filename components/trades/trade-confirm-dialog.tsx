"use client";

import { useMemo, useState } from "react";
import {
  Alert02Icon,
  ArrowDown02Icon,
  ArrowLeft02Icon,
  ArrowLeftRightIcon,
  ArrowRight02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PlayerIdentity } from "@/components/rankings/player-identity";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  areTradeDropsSatisfied,
  formatTradeDropAlert,
  isDropPlayerSelectable,
  type TradeDropAnalysis,
} from "@/lib/leagues/trades/validate";
import type { TradePlayerRow } from "@/lib/queries/trades";
import { cn } from "@/lib/utils";

type TradeConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receivingPlayers: TradePlayerRow[];
  offeringPlayers: TradePlayerRow[];
  proposingDropCandidates: TradePlayerRow[];
  proposingDropAnalysis: TradeDropAnalysis;
  receivingDropsNeeded: number;
  proposingDropIds: string[];
  onProposingDropsChange: (playerIds: string[]) => void;
  partnerTeamName: string;
  isCounter?: boolean;
  onConfirm: (comment: string) => void;
};

function PlayerLine({
  player,
  direction,
}: {
  player: TradePlayerRow;
  direction: "in" | "out";
}) {
  const icon = direction === "in" ? ArrowRight02Icon : ArrowLeft02Icon;
  const arrowClass =
    direction === "in" ? "text-success" : "text-destructive";

  return (
    <li className="flex items-center gap-2 py-1.5">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className={cn("size-4 shrink-0", arrowClass)}
      />
      <PlayerIdentity
        fullName={player.fullName}
        sleeperId={player.sleeperId}
        primaryPositionId={player.primaryPositionId}
        nflTeam={player.nflTeam}
        size="sm"
      />
    </li>
  );
}

function DropPlayerCombobox({
  candidates,
  analysis,
  selectedIds,
  onChange,
}: {
  candidates: TradePlayerRow[];
  analysis: TradeDropAnalysis;
  selectedIds: string[];
  onChange: (playerIds: string[]) => void;
}) {
  const anchor = useComboboxAnchor();
  const byId = useMemo(
    () => new Map(candidates.map((player) => [player.id, player])),
    [candidates],
  );
  const selectableIds = useMemo(
    () =>
      new Set(
        candidates
          .filter((player) =>
            isDropPlayerSelectable(
              analysis,
              player,
              selectedIds,
              candidates,
            ),
          )
          .map((player) => player.id),
      ),
    [analysis, candidates, selectedIds],
  );

  return (
    <Combobox
      multiple
      value={selectedIds}
      onValueChange={(next) => {
        const ids = ((next as string[] | null) ?? []).filter((id) =>
          selectableIds.has(id),
        );
        if (ids.length <= analysis.dropsNeeded) {
          onChange(ids);
          return;
        }
        onChange(ids.slice(0, analysis.dropsNeeded));
      }}
      items={candidates.map((player) => player.id)}
      itemToStringLabel={(id) => byId.get(id)?.fullName ?? id}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: string[]) => (
            <>
              {values.map((id) => {
                const player = byId.get(id);
                if (!player) {
                  return null;
                }
                return (
                  <ComboboxChip key={id}>
                    {player.fullName.split(/\s+/).slice(-1)[0]}
                  </ComboboxChip>
                );
              })}
              <ComboboxChipsInput
                disabled={values.length >= analysis.dropsNeeded}
                placeholder={
                  values.length >= analysis.dropsNeeded
                    ? undefined
                    : "Search players to drop…"
                }
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor} className="w-(--anchor-width)">
        <ComboboxEmpty>No players found.</ComboboxEmpty>
        <ComboboxList>
          {(id) => {
            const player = byId.get(id as string);
            if (!player) {
              return null;
            }
            const selectable = selectableIds.has(player.id);
            return (
              <ComboboxItem
                key={player.id}
                value={player.id}
                disabled={!selectable}
                className={cn(!selectable && "opacity-50")}
              >
                <HugeiconsIcon
                  icon={ArrowDown02Icon}
                  strokeWidth={2}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <PlayerIdentity
                  fullName={player.fullName}
                  sleeperId={player.sleeperId}
                  primaryPositionId={player.primaryPositionId}
                  nflTeam={player.nflTeam}
                  size="sm"
                />
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function TradeConfirmDialog({
  open,
  onOpenChange,
  receivingPlayers,
  offeringPlayers,
  proposingDropCandidates,
  proposingDropAnalysis,
  receivingDropsNeeded,
  proposingDropIds,
  onProposingDropsChange,
  partnerTeamName,
  isCounter = false,
  onConfirm,
}: TradeConfirmDialogProps) {
  const [comment, setComment] = useState("");

  const dropsReady = areTradeDropsSatisfied(
    proposingDropAnalysis,
    proposingDropIds,
    proposingDropCandidates,
  );
  const dropAlert =
    proposingDropAnalysis.dropsNeeded > 0
      ? formatTradeDropAlert(proposingDropAnalysis)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isCounter ? "Confirm counter-offer" : "Confirm transaction"}
          </DialogTitle>
          <DialogDescription>
            {isCounter
              ? `Review your counter before sending to ${partnerTeamName}. This replaces the original proposal.`
              : `Review the trade before sending to ${partnerTeamName}.`}
          </DialogDescription>
        </DialogHeader>

                <div className="rounded-lg border p-4">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium">Receiving</p>
              <ul>
                {receivingPlayers.map((player) => (
                  <PlayerLine key={player.id} player={player} direction="in" />
                ))}
              </ul>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium">Offering</p>
              <ul>
                {offeringPlayers.map((player) => (
                  <PlayerLine key={player.id} player={player} direction="out" />
                ))}
              </ul>
            </div>
            {proposingDropAnalysis.dropsNeeded > 0 ? (
              <div className="flex flex-col gap-3 border-t pt-4">
                <p className="text-sm font-medium">
                  Dropping ({proposingDropIds.length}/
                  {proposingDropAnalysis.dropsNeeded})
                </p>
                {!dropsReady && dropAlert ? (
                  <Alert variant="destructive">
                    <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
                    <AlertTitle>{dropAlert.title}</AlertTitle>
                    <AlertDescription>
                      {dropAlert.description}
                    </AlertDescription>
                  </Alert>
                ) : null}
                <DropPlayerCombobox
                  candidates={proposingDropCandidates}
                  analysis={proposingDropAnalysis}
                  selectedIds={proposingDropIds}
                  onChange={onProposingDropsChange}
                />
              </div>
            ) : null}
            {receivingDropsNeeded > 0 ? (
              <p className="border-t pt-4 text-sm text-muted-foreground">
                {partnerTeamName} must drop {receivingDropsNeeded} player
                {receivingDropsNeeded === 1 ? "" : "s"} if they accept.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="trade-comment">Comments</Label>
          <Textarea
            id="trade-comment"
            placeholder="Comments to include on the trade proposal"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Managers on {partnerTeamName} will see this proposal on their
            Transactions tab.
          </p>
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
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
            disabled={!dropsReady}
            onClick={() => onConfirm(comment)}
          >
            <HugeiconsIcon
              icon={ArrowLeftRightIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {isCounter ? "Send counter-offer" : "Send trade proposal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
