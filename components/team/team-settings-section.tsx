"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  Logout01Icon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { LogoField } from "@/components/shared/logo-field";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  dropOutOfLeague,
  updateTeamIdentity,
} from "@/lib/actions/team-settings";
import type { TeamIdentityFormValues } from "@/lib/leagues/team-identity";

type TeamSettingsSectionProps = {
  leagueSlug: string;
  initialValues: TeamIdentityFormValues;
  initialLogoUrl: string | null;
};

function valuesEqual(a: TeamIdentityFormValues, b: TeamIdentityFormValues) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function TeamSettingsSection({
  leagueSlug,
  initialValues,
  initialLogoUrl,
}: TeamSettingsSectionProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "logoUrl", string>>
  >({});
  const [isPending, startTransition] = useTransition();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const hasChanges = !valuesEqual(values, initialValues);

  const patch = (next: Partial<TeamIdentityFormValues>) => {
    setValues((current) => ({ ...current, ...next }));
  };

  const handleReset = () => {
    setValues(initialValues);
    setError(null);
    setFieldErrors({});
  };

  const handleSave = () => {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateTeamIdentity(leagueSlug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save team settings.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }
      toast.success("Team settings saved");
      router.refresh();
    });
  };

  const handleLeaveLeague = () => {
    setLeaveError(null);
    startTransition(async () => {
      const result = await dropOutOfLeague(leagueSlug);
      if (result && !result.success) {
        setLeaveError(result.error ?? "Could not leave the league.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card size="sm" className="gap-0 py-0">
        <CardHeader className="border-b bg-muted/40 py-3">
          <CardTitle className="text-base text-balance">Team Profile</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <FieldGroup>
            <LogoField
              kind="team"
              value={values}
              initialLogoUrl={initialLogoUrl}
              onChange={patch}
              error={fieldErrors.logoUrl}
              description=""
            />

            <Field>
              <FieldLabel htmlFor="teamName">Team Name</FieldLabel>
              <Input
                id="teamName"
                value={values.name}
                onChange={(event) => patch({ name: event.target.value })}
                className="max-w-xl"
              />
              {fieldErrors.name ? (
                <FieldError>{fieldErrors.name}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button
            type="button"
            variant="outline"
            disabled={isPending || !hasChanges}
            onClick={handleReset}
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
        </CardFooter>
      </Card>

      <Card size="sm" className="gap-0 py-0">
        <CardHeader className="border-b bg-destructive/5 py-3 [.border-b]:pb-3">
          <CardTitle className="text-balance text-destructive">
            Leave League
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 py-4">
          <p className="text-sm text-pretty text-muted-foreground">
            This cannot be undone. Leaving vacates your roster slot — your
            players stay on the team for a replacement owner.
          </p>
          <AlertDialog
            open={leaveOpen}
            onOpenChange={(next) => {
              setLeaveOpen(next);
              if (!next) setLeaveError(null);
            }}
          >
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  className="w-fit self-start"
                />
              }
            >
              <HugeiconsIcon
                icon={Logout01Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Leave League
            </AlertDialogTrigger>
            <AlertDialogContent>
                            <AlertDialogHeader>
                <AlertDialogTitle className="text-balance">
                  Leave this league?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-pretty">
                  Your team becomes an open slot. You can only rejoin with a new
                  invite if a seat opens. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {leaveError ? (
                <p className="text-sm text-pretty text-destructive" role="alert">
                  {leaveError}
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
                  onClick={handleLeaveLeague}
                >
                  <HugeiconsIcon
                    icon={Logout01Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Leave League
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
