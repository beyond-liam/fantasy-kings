"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  ArrowRight02Icon,
  Cancel01Icon,
  LicenseDraftIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { tradeComposerPath } from "@/lib/leagues/utils";
import type { ProposeTradePartner } from "@/lib/leagues/trades/partners";

export type TeamFuturePickRow = {
  id: string;
  draftYear: number;
  primary: string;
  secondary: string | null;
  tradeHref: string | null;
  tradeLabel: string;
};

type TeamFuturePicksListProps = {
  picks: TeamFuturePickRow[];
  years: number[];
  leagueSlug?: string;
  partners?: ProposeTradePartner[];
};

export function TeamFuturePicksList({
  picks,
  years,
  leagueSlug,
  partners = [],
}: TeamFuturePicksListProps) {
  const router = useRouter();
  const [year, setYear] = useState("all");
  const [pendingPickId, setPendingPickId] = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const visible =
    year === "all"
      ? picks
      : picks.filter((pick) => String(pick.draftYear) === year);
  const needsPartnerDialog = partners.length > 1 && Boolean(leagueSlug);
  const showTradeColumn =
    picks.some((pick) => pick.tradeHref) || needsPartnerDialog;

  if (picks.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={LicenseDraftIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No future picks yet</EmptyTitle>
          <EmptyDescription>
            Future draft picks appear here after the commissioner starts a new
            season.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {years.length > 1 ? (
        <ToggleGroup
          value={[year]}
          onValueChange={(next) => {
            if (next.length === 0) return;
            const added = next.find((value) => value !== year);
            setYear(added ?? next[next.length - 1]!);
          }}
          variant="outline"
          size="sm"
          spacing={2}
          multiple
          className="flex flex-wrap"
          aria-label="Filter picks by year"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {years.map((entry) => (
            <ToggleGroupItem key={entry} value={String(entry)}>
              {entry}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      {visible.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={LicenseDraftIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>No picks in {year}</EmptyTitle>
            <EmptyDescription>
              This team does not own any picks for that draft year.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pick</TableHead>
                {showTradeColumn ? (
                  <TableHead className="w-44 text-right">
                    <span className="sr-only">Trade</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((pick) => (
                <TableRow key={pick.id}>
                  <TableCell>
                    <p className="font-medium tabular-nums">{pick.primary}</p>
                    {pick.secondary ? (
                      <p className="text-pretty text-muted-foreground">
                        {pick.secondary}
                      </p>
                    ) : null}
                  </TableCell>
                  {showTradeColumn ? (
                    <TableCell className="text-right">
                      {pick.tradeHref ? (
                        <Button
                          nativeButton={false}
                          size="sm"
                          variant="outline"
                          render={<Link href={pick.tradeHref} />}
                        >
                          <HugeiconsIcon
                            icon={ArrowLeftRightIcon}
                            strokeWidth={2}
                            data-icon="inline-start"
                          />
                          {pick.tradeLabel}
                        </Button>
                      ) : needsPartnerDialog ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPendingPickId(pick.id);
                            setPartnerId(null);
                          }}
                        >
                          <HugeiconsIcon
                            icon={ArrowLeftRightIcon}
                            strokeWidth={2}
                            data-icon="inline-start"
                          />
                          {pick.tradeLabel}
                        </Button>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}

      <Dialog
        open={pendingPickId != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingPickId(null);
            setPartnerId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Trade with</DialogTitle>
            <DialogDescription>
              Choose the team you want to propose a trade to.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="future-pick-trade-partner">Team</FieldLabel>
              <Select
                items={partners.map((partner) => ({
                  value: partner.id,
                  label: partner.name,
                }))}
                value={partnerId}
                onValueChange={setPartnerId}
              >
                <SelectTrigger id="future-pick-trade-partner" className="w-full">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPendingPickId(null);
                setPartnerId(null);
              }}
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
              disabled={!partnerId || !pendingPickId || !leagueSlug}
              onClick={() => {
                const partner = partners.find((item) => item.id === partnerId);
                if (!partner || !pendingPickId || !leagueSlug) return;
                router.push(
                  tradeComposerPath(leagueSlug, {
                    with: partner.slug,
                    offerPick: pendingPickId,
                  }),
                );
              }}
            >
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
