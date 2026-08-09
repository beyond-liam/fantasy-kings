"use client";

import { useState } from "react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PasswordField } from "@/components/auth/password-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLoading(false);
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    window.location.assign("/dashboard");
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <CardHeader className="px-0">
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Choose a new password for your Fantasy Kings account.
        </CardDescription>
      </CardHeader>

      <FieldGroup>
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={loading}
          invalid={Boolean(error)}
          minLength={MIN_PASSWORD_LENGTH}
        />
        <PasswordField
          id="confirm-new-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          disabled={loading}
          invalid={Boolean(error)}
          minLength={MIN_PASSWORD_LENGTH}
        />
      </FieldGroup>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't update password</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={loading}>
        <HugeiconsIcon
          icon={Tick02Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Save password
      </Button>
    </form>
  );
}
