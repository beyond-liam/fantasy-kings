"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft01Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const loginHref =
    next === "/dashboard"
      ? "/login"
      : `/login?next=${encodeURIComponent(next)}`;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", "/update-password");

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: redirectTo.toString() },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex w-full flex-col gap-4">
        <CardHeader className="px-0">
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for {email.trim()}, we sent a password reset
            link.
          </CardDescription>
        </CardHeader>
        <Button
          type="button"
          variant="outline"
          nativeButton={false}
          render={<Link href={loginHref} />}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Back to log in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <CardHeader className="px-0">
        <CardTitle>Reset password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send a reset link.
        </CardDescription>
      </CardHeader>

      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="reset-email">Email</FieldLabel>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={loading}
            aria-invalid={error ? true : undefined}
          />
        </Field>
      </FieldGroup>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not send reset link</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={loading}>
        <HugeiconsIcon
          icon={Mail01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Send reset link
      </Button>
      <Button
        type="button"
        variant="ghost"
        nativeButton={false}
        render={<Link href={loginHref} />}
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Back to log in
      </Button>
    </form>
  );
}
