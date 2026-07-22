"use client";

import { Cancel01Icon, TickDouble02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LogoField } from "@/components/shared/logo-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageFormActions } from "@/components/layout/page-form-actions";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateLeagueIdentity } from "@/lib/actions/league-settings";
import { formatLeagueLabel } from "@/lib/leagues/format";
import type { LeagueIdentityFormValues } from "@/lib/leagues/league-identity";

type LeagueIdentitySettingsProps = {
  slug: string;
  seasonStatus: string;
  initialValues: LeagueIdentityFormValues;
  initialLogoUrl: string | null;
};

function valuesEqual(a: LeagueIdentityFormValues, b: LeagueIdentityFormValues) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function LeagueIdentitySettings({
  slug,
  seasonStatus,
  initialValues,
  initialLogoUrl,
}: LeagueIdentitySettingsProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "logoUrl" | "divisions", string>>
  >({});
  const [isPending, startTransition] = useTransition();

  const hasChanges = !valuesEqual(values, initialValues);

  const patch = (next: Partial<LeagueIdentityFormValues>) => {
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
      const result = await updateLeagueIdentity(slug, values);
      if (!result.success) {
        setError(result.error ?? "Could not save league settings.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }

      if (result.redirectSlug && result.redirectSlug !== slug) {
        router.replace(`/league/${result.redirectSlug}/settings/league`);
        router.refresh();
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          League Name & Logo
        </h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {initialValues.name}
          {" · "}
          <span className="capitalize">{formatLeagueLabel(seasonStatus)}</span>
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <LogoField
          kind="league"
          value={values}
          initialLogoUrl={initialLogoUrl}
          onChange={patch}
          error={fieldErrors.logoUrl}
        />

        <Field>
          <FieldLabel htmlFor="leagueName">League name</FieldLabel>
          <Input
            id="leagueName"
            value={values.name}
            onChange={(event) => patch({ name: event.target.value })}
            className="max-w-xl"
          />
          {fieldErrors.name ? (
            <FieldError>{fieldErrors.name}</FieldError>
          ) : null}
        </Field>
      </FieldGroup>

      <PageFormActions>
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
          Reset
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isPending || !hasChanges}
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
