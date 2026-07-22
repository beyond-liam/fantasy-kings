"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IconSvgElement } from "@hugeicons/react";
import {
  ArrowDownDoubleIcon,
  Cancel01Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  SETTINGS_MENU_ITEM_CLASS,
  SettingsMenuChevron,
} from "@/components/leagues/settings/settings-menu-section";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  clearAllRosters,
  clearTeamRoster,
  deleteLeague,
  stepDownAsCommissioner,
} from "@/lib/actions/danger-zone";
import type { MembershipOwnerOption } from "@/lib/leagues/membership";

function DangerMenuTrigger({
  icon,
  label,
}: {
  icon: IconSvgElement;
  label: string;
}) {
  return (
    <>
      <HugeiconsIcon
        icon={icon}
        strokeWidth={1.75}
        data-icon="inline-start"
      />
      <span className="min-w-0 flex-1 truncate text-left text-pretty">
        {label}
      </span>
      <SettingsMenuChevron />
    </>
  );
}

function ConfirmAlert({
  label,
  icon,
  title,
  description,
  confirmLabel,
  onConfirm,
  redirectTo,
}: {
  label: string;
  icon: IconSvgElement;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<{ success: boolean; error?: string } | void>;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={SETTINGS_MENU_ITEM_CLASS}
          />
        }
      >
        <DangerMenuTrigger icon={icon} label={label} />
      </AlertDialogTrigger>
      <AlertDialogContent>
                <AlertDialogHeader>
          <AlertDialogTitle className="text-balance">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-pretty">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-pretty text-destructive" role="alert">
            {error}
          </p>
        ) : null}
                <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await onConfirm();
                if (result && !result.success) {
                  setError(result.error ?? "Something went wrong.");
                  return;
                }
                setOpen(false);
                if (redirectTo) {
                  router.push(redirectTo);
                }
                router.refresh();
              });
            }}
          >
            <HugeiconsIcon
              icon={icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DangerZoneMenuItemsProps = {
  slug: string;
  leagueName: string;
  owners: MembershipOwnerOption[];
};

export function DangerZoneMenuItems({
  slug,
  leagueName,
  owners,
}: DangerZoneMenuItemsProps) {
  const router = useRouter();
  const teamsWithRoster = useMemo(
    () =>
      owners.filter(
        (owner): owner is MembershipOwnerOption & { teamId: string } =>
          Boolean(owner.teamId),
      ),
    [owners],
  );
  const coCommissioners = useMemo(
    () => owners.filter((owner) => owner.role === "co_commissioner"),
    [owners],
  );
  const successorCandidates = useMemo(
    () => owners.filter((owner) => owner.role !== "commissioner"),
    [owners],
  );

  const [deleteTeamOpen, setDeleteTeamOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [deleteTeamError, setDeleteTeamError] = useState<string | null>(null);
  const [deleteTeamPending, startDeleteTeam] = useTransition();

  const [stepDownOpen, setStepDownOpen] = useState(false);
  const [successorId, setSuccessorId] = useState<string | null>(null);
  const [stepDownError, setStepDownError] = useState<string | null>(null);
  const [stepDownPending, startStepDown] = useTransition();

  const hasCoCommissioner = coCommissioners.length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      <Dialog
        open={deleteTeamOpen}
        onOpenChange={(next) => {
          setDeleteTeamOpen(next);
          if (!next) {
            setSelectedTeamId(null);
            setDeleteTeamError(null);
          }
        }}
      >
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className={SETTINGS_MENU_ITEM_CLASS}
            />
          }
        >
          <DangerMenuTrigger icon={Cancel01Icon} label="Delete Team" />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-balance">Delete team roster</DialogTitle>
            <DialogDescription className="text-pretty">
              This removes every player from the selected team. The team slot and
              owner stay in the league.
            </DialogDescription>
          </DialogHeader>
                    <FieldGroup>
            <Field>
              <FieldLabel>Team</FieldLabel>
              <Select
                items={teamsWithRoster.map((owner) => ({
                  value: owner.teamId,
                  label: `${owner.teamName} · ${owner.displayName}`,
                }))}
                value={selectedTeamId ?? undefined}
                onValueChange={(value) => {
                  if (value) setSelectedTeamId(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {teamsWithRoster.map((owner) => (
                      <SelectItem key={owner.teamId} value={owner.teamId}>
                        <span className="flex min-w-0 flex-col gap-0.5 text-left">
                          <span className="truncate">{owner.teamName}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {owner.displayName}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {deleteTeamError ? (
            <p className="text-sm text-pretty text-destructive" role="alert">
              {deleteTeamError}
            </p>
          ) : null}
                    <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteTeamPending}
              onClick={() => setDeleteTeamOpen(false)}
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
              variant="destructive"
              disabled={deleteTeamPending || !selectedTeamId}
              onClick={() => {
                if (!selectedTeamId) return;
                setDeleteTeamError(null);
                startDeleteTeam(async () => {
                  const result = await clearTeamRoster(slug, selectedTeamId);
                  if (!result.success) {
                    setDeleteTeamError(
                      result.error ?? "Could not clear that roster.",
                    );
                    return;
                  }
                  setDeleteTeamOpen(false);
                  router.refresh();
                });
              }}
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Clear roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmAlert
        label="Delete This League"
        icon={Delete02Icon}
        title="Delete this league?"
        description={`Permanently deletes ${leagueName} and all seasons, teams, rosters, and activity. This cannot be undone.`}
        confirmLabel="Delete league"
        onConfirm={async () => {
          await deleteLeague(slug);
        }}
      />

      {hasCoCommissioner ? (
        <ConfirmAlert
          label="Step Down As Commish"
          icon={ArrowDownDoubleIcon}
          title="Step down as commissioner?"
          description={
            coCommissioners.length === 1
              ? `${coCommissioners[0]!.displayName} will become the new commissioner.`
              : `${coCommissioners[0]!.displayName} will become the new commissioner (earliest co-commissioner).`
          }
          confirmLabel="Step down"
          onConfirm={() => stepDownAsCommissioner(slug)}
          redirectTo={`/league/${slug}`}
        />
      ) : (
        <Dialog
          open={stepDownOpen}
          onOpenChange={(next) => {
            setStepDownOpen(next);
            if (!next) {
              setSuccessorId(null);
              setStepDownError(null);
            }
          }}
        >
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                className={SETTINGS_MENU_ITEM_CLASS}
              />
            }
          >
            <DangerMenuTrigger
              icon={ArrowDownDoubleIcon}
              label="Step Down As Commish"
            />
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-balance">
                Step down as commissioner
              </DialogTitle>
              <DialogDescription className="text-pretty">
                Choose who takes over. You will remain in the league as a regular
                member.
              </DialogDescription>
            </DialogHeader>
                        <FieldGroup>
              <Field>
                <FieldLabel>New commissioner</FieldLabel>
                <Select
                  items={successorCandidates.map((owner) => ({
                    value: owner.userId,
                    label: `${owner.displayName} · ${owner.teamName}`,
                  }))}
                  value={successorId ?? undefined}
                  onValueChange={(value) => {
                    if (value) setSuccessorId(value);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {successorCandidates.map((owner) => (
                        <SelectItem key={owner.userId} value={owner.userId}>
                          <span className="flex min-w-0 flex-col gap-0.5 text-left">
                            <span className="truncate">{owner.displayName}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {owner.teamName}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            {stepDownError ? (
              <p className="text-sm text-pretty text-destructive" role="alert">
                {stepDownError}
              </p>
            ) : null}
                        <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={stepDownPending}
                onClick={() => setStepDownOpen(false)}
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
                variant="destructive"
                disabled={stepDownPending || !successorId}
                onClick={() => {
                  if (!successorId) return;
                  setStepDownError(null);
                  startStepDown(async () => {
                    const result = await stepDownAsCommissioner(
                      slug,
                      successorId,
                    );
                    if (!result.success) {
                      setStepDownError(
                        result.error ?? "Could not step down.",
                      );
                      return;
                    }
                    setStepDownOpen(false);
                    router.push(`/league/${slug}`);
                    router.refresh();
                  });
                }}
              >
                <HugeiconsIcon
                  icon={ArrowDownDoubleIcon}
                  strokeWidth={2}
                  data-icon="inline-start"
                />
                Step down
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmAlert
        label="Clear Rosters"
        icon={Delete02Icon}
        title="Clear all rosters?"
        description="Removes every player from every team in this league. Owners and league settings are kept."
        confirmLabel="Clear all rosters"
        onConfirm={() => clearAllRosters(slug)}
      />
    </div>
  );
}
