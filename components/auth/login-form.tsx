"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Login01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/client";

type Step = "email" | "otp";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("Check your email for a 6-digit code.");
    setStep("otp");
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });

    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      return;
    }

    router.replace(next);
    router.refresh();
  };

  if (step === "otp") {
    return (
      <form onSubmit={verifyCode} className="flex w-full flex-col gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t verify code</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert className="border-success/30 bg-success/10 text-success *:data-[slot=alert-description]:text-success/90">
            <AlertTitle>Code sent</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="otp">Verification code</FieldLabel>
            <InputOTP
              id="otp"
              maxLength={6}
              value={otp}
              onChange={setOtp}
              disabled={loading}
              aria-invalid={error ? true : undefined}
              containerClassName="w-full"
            >
              <InputOTPGroup className="w-full">
                <InputOTPSlot index={0} className="h-12 flex-1 text-lg" />
                <InputOTPSlot index={1} className="h-12 flex-1 text-lg" />
                <InputOTPSlot index={2} className="h-12 flex-1 text-lg" />
                <InputOTPSlot index={3} className="h-12 flex-1 text-lg" />
                <InputOTPSlot index={4} className="h-12 flex-1 text-lg" />
                <InputOTPSlot index={5} className="h-12 flex-1 text-lg" />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-muted-foreground">
              Sent to {email.trim()}
            </p>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={loading || otp.trim().length !== 6}>
          <HugeiconsIcon
            icon={Login01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Verify and continue
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={loading}
          onClick={() => {
            setStep("email");
            setOtp("");
            setError(null);
            setMessage(null);
          }}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Use a different email
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} className="flex w-full flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-invalid={error ? true : undefined}
          />
        </Field>
      </FieldGroup>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t send code</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={loading}>
        <HugeiconsIcon
          icon={Mail01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Send Verification Code
      </Button>
    </form>
  );
}
