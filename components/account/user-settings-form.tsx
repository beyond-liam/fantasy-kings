"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  Delete02Icon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { LogoField } from "@/components/shared/logo-field";
import { PageFormActions } from "@/components/layout/page-form-actions";
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  deleteAccount,
  updateUserSettings,
} from "@/lib/actions/account";
import type { UserSettingsFormValues } from "@/lib/account/user-settings";

type UserSettingsFormProps = {
  initialValues: UserSettingsFormValues;
  initialAvatarUrl: string | null;
};

function valuesEqual(a: UserSettingsFormValues, b: UserSettingsFormValues) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function UserSettingsForm({
  initialValues,
  initialAvatarUrl,
}: UserSettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<
      Record<"email" | "username" | "firstName" | "lastName" | "avatarUrl", string>
    >
  >({});
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasChanges = !valuesEqual(values, initialValues);

  const patch = (next: Partial<UserSettingsFormValues>) => {
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
      const result = await updateUserSettings(values);
      if (!result.success) {
        setError(result.error ?? "Could not save settings.");
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      if (result.emailPendingConfirm) {
        toast.success("Settings saved. Check your inbox to confirm the new email.");
      } else {
        toast.success("Settings saved");
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteAccount();
      if (result && !result.success) {
        setDeleteError(result.error ?? "Could not delete account.");
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
          <CardTitle className="text-base text-balance">Profile</CardTitle>
        </CardHeader>
        <CardContent className="py-4">
          <FieldGroup>
            <LogoField
              kind="avatar"
              label="Avatar"
              description="Upload an image up to 2MB, or paste a public URL."
              value={{
                logoMode: values.avatarMode,
                logoUrl: values.avatarUrl,
              }}
              initialLogoUrl={initialAvatarUrl}
              onChange={(next) =>
                patch({
                  ...(next.logoMode != null
                    ? { avatarMode: next.logoMode }
                    : {}),
                  ...(next.logoUrl != null ? { avatarUrl: next.logoUrl } : {}),
                })
              }
              error={fieldErrors.avatarUrl}
            />

            <Field>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={values.email}
                onChange={(event) => patch({ email: event.target.value })}
                aria-invalid={Boolean(fieldErrors.email)}
              />
              <FieldDescription>
                Changing email sends a confirmation link to the new address.
              </FieldDescription>
              {fieldErrors.email ? (
                <FieldError>{fieldErrors.email}</FieldError>
              ) : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
                autoComplete="username"
                value={values.username}
                onChange={(event) => patch({ username: event.target.value })}
                aria-invalid={Boolean(fieldErrors.username)}
              />
              {fieldErrors.username ? (
                <FieldError>{fieldErrors.username}</FieldError>
              ) : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  value={values.firstName}
                  onChange={(event) =>
                    patch({ firstName: event.target.value })
                  }
                  aria-invalid={Boolean(fieldErrors.firstName)}
                />
                {fieldErrors.firstName ? (
                  <FieldError>{fieldErrors.firstName}</FieldError>
                ) : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  value={values.lastName}
                  onChange={(event) => patch({ lastName: event.target.value })}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                />
                {fieldErrors.lastName ? (
                  <FieldError>{fieldErrors.lastName}</FieldError>
                ) : null}
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

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

      <Card size="sm" className="gap-0 py-0">
        <CardHeader className="border-b bg-destructive/5 py-3 [.border-b]:pb-3">
          <CardTitle className="text-balance text-destructive">
            Delete Account
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4 py-4">
          <p className="text-sm text-pretty text-muted-foreground">
            This cannot be undone. It permanently deletes your account, every
            league you created, and vacates your teams in other leagues.
          </p>
          <AlertDialog
            open={deleteOpen}
            onOpenChange={(next) => {
              setDeleteOpen(next);
              if (!next) setDeleteError(null);
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
                icon={Delete02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Delete account
            </AlertDialogTrigger>
            <AlertDialogContent>
                            <AlertDialogHeader>
                <AlertDialogTitle className="text-balance">
                  Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-pretty">
                  All leagues you created will be deleted. Your teams in other
                  leagues become open slots. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError ? (
                <p className="text-sm text-pretty text-destructive" role="alert">
                  {deleteError}
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
                  onClick={handleDelete}
                >
                  <HugeiconsIcon
                    icon={Delete02Icon}
                    strokeWidth={2}
                    data-icon="inline-start"
                  />
                  Delete account
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
