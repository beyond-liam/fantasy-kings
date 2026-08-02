"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Login01Icon,
  Mail01Icon,
  UserAdd01Icon,
} from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeNextPath } from "@/lib/auth/safe-next";
import { mapOtpSendError } from "@/lib/auth/otp-errors";
import { createClient } from "@/lib/supabase/client";

type Mode = "register" | "login";
type Step = "email" | "otp";

const MODE_COPY = {
  register: {
    title: "Register your account",
    description: "Add and verify your email address to get started.",
  },
  login: {
    title: "Welcome back",
    description:
      "Login with your email address and your verification code.",
  },
} as const;

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [mode, setMode] = useState<Mode>("register");
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
        shouldCreateUser: mode === "register",
      },
    });

    setLoading(false);

    if (signInError) {
      setError(mapOtpSendError(signInError.message, mode));
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

    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      return;
    }

    // Full navigation so the server re-renders app chrome with the new session.
    window.location.assign(next);
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
    <Tabs
      value={mode}
      onValueChange={(value) => {
        if (value !== "register" && value !== "login") return;
        setMode(value);
        setError(null);
        setMessage(null);
      }}
      className="w-full gap-4"
    >
      <TabsList className="w-full">
        <TabsTrigger value="register">Register</TabsTrigger>
        <TabsTrigger value="login">Log In</TabsTrigger>
      </TabsList>

      <TabsContent value="register" className="mt-0 flex flex-col gap-4">
        <CardHeader className="px-0">
          <CardTitle>{MODE_COPY.register.title}</CardTitle>
          <CardDescription>{MODE_COPY.register.description}</CardDescription>
        </CardHeader>
        <EmailStep
          mode="register"
          email={email}
          error={error}
          loading={loading}
          onEmailChange={setEmail}
          onSubmit={sendCode}
        />
      </TabsContent>

      <TabsContent value="login" className="mt-0 flex flex-col gap-4">
        <CardHeader className="px-0">
          <CardTitle>{MODE_COPY.login.title}</CardTitle>
          <CardDescription>{MODE_COPY.login.description}</CardDescription>
        </CardHeader>
        <EmailStep
          mode="login"
          email={email}
          error={error}
          loading={loading}
          onEmailChange={setEmail}
          onSubmit={sendCode}
        />
      </TabsContent>
    </Tabs>
  );
}

function EmailStep({
  mode,
  email,
  error,
  loading,
  onEmailChange,
  onSubmit,
}: {
  mode: Mode;
  email: string;
  error: string | null;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const isRegister = mode === "register";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor={`email-${mode}`}>Email</FieldLabel>
          <Input
            id={`email-${mode}`}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
            aria-invalid={error ? true : undefined}
          />
        </Field>
      </FieldGroup>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>
            {isRegister ? "Couldn't register" : "Couldn't send code"}
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={loading}>
        <HugeiconsIcon
          icon={isRegister ? UserAdd01Icon : Mail01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        {isRegister ? "Register and Verify Account" : "Send Verification Code"}
      </Button>
    </form>
  );
}
