"use client";

import { useState, useTransition } from "react";
import { Key01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { PasswordField } from "@/components/auth/password-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { updateAccountPassword } from "@/lib/actions/account-password";

const MIN_PASSWORD_LENGTH = 8;

type PasswordSettingsCardProps = {
  /** Email provider identity present (password or legacy OTP). */
  hasEmailIdentity: boolean;
};

export function PasswordSettingsCard({
  hasEmailIdentity,
}: PasswordSettingsCardProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSetMode = !hasEmailIdentity;
  const title = isSetMode ? "Set Password" : "Change Password";
  const submitLabel = isSetMode ? "Set password" : "Update password";

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (hasEmailIdentity && !currentPassword.trim()) {
      setError("Enter your current password.");
      return;
    }

    startTransition(async () => {
      const result = await updateAccountPassword({
        currentPassword: hasEmailIdentity ? currentPassword : undefined,
        newPassword,
        confirmPassword,
        requireCurrent: hasEmailIdentity,
      });
      if (!result.success) {
        setError(result.error ?? "Could not update password.");
        return;
      }
      toast.success(isSetMode ? "Password set" : "Password updated");
      resetFields();
    });
  };

  return (
    <Card size="sm" className="gap-0 py-0">
      <CardHeader variant="panel">
        <CardTitle className="text-base text-balance">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <FieldGroup>
            {hasEmailIdentity ? (
              <PasswordField
                id="current-password"
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={isPending}
                invalid={Boolean(error)}
                minLength={1}
              />
            ) : null}

            <PasswordField
              id="settings-new-password"
              label={isSetMode ? "Password" : "New password"}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              disabled={isPending}
              invalid={Boolean(error)}
              minLength={MIN_PASSWORD_LENGTH}
            />
            <PasswordField
              id="settings-confirm-password"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={isPending}
              invalid={Boolean(error)}
              minLength={MIN_PASSWORD_LENGTH}
            />
          </FieldGroup>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={isPending} className="w-fit self-start">
            <HugeiconsIcon
              icon={Key01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
