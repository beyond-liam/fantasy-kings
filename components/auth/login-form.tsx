"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Login01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";

import { PasswordField } from "@/components/auth/password-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mapAuthError } from "@/lib/auth/auth-errors";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/client";

type Mode = "register" | "login";

const MODE_COPY = {
  register: {
    title: "Create your account",
    description: "Register with your email and a password.",
  },
  login: {
    title: "Welcome back",
    description: "Log in with your email and password.",
  },
} as const;

const MIN_PASSWORD_LENGTH = 8;

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const authError = searchParams.get("error") === "auth";

  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    authError ? "Sign-in was cancelled or failed. Please try again." : null,
  );
  const [loading, setLoading] = useState(false);

  const authRedirectTo = () => {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  };

  const submitEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const trimmedEmail = email.trim();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setLoading(false);
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (mode === "register" && password !== confirmPassword) {
      setLoading(false);
      setError("Passwords do not match.");
      return;
    }

    const supabase = createClient();

    if (mode === "register") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: authRedirectTo(),
        },
      });

      setLoading(false);

      if (signUpError) {
        setError(mapAuthError(signUpError.message, "register"));
        return;
      }

      if (data.session) {
        window.location.assign(next);
        return;
      }

      setMessage(
        "Check your email for a verification link to finish creating your account.",
      );
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(mapAuthError(signInError.message, "login"));
      return;
    }

    window.location.assign(next);
  };

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
        <AuthFields
          mode="register"
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          error={error}
          message={message}
          loading={loading}
          next={next}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={submitEmailAuth}
        />
      </TabsContent>

      <TabsContent value="login" className="mt-0 flex flex-col gap-4">
        <CardHeader className="px-0">
          <CardTitle>{MODE_COPY.login.title}</CardTitle>
          <CardDescription>{MODE_COPY.login.description}</CardDescription>
        </CardHeader>
        <AuthFields
          mode="login"
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          error={error}
          message={message}
          loading={loading}
          next={next}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onSubmit={submitEmailAuth}
        />
      </TabsContent>
    </Tabs>
  );
}

function AuthFields({
  mode,
  email,
  password,
  confirmPassword,
  error,
  message,
  loading,
  next,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: {
  mode: Mode;
  email: string;
  password: string;
  confirmPassword: string;
  error: string | null;
  message: string | null;
  loading: boolean;
  next: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const isRegister = mode === "register";
  const forgotHref =
    next === "/dashboard"
      ? "/forgot-password"
      : `/forgot-password?next=${encodeURIComponent(next)}`;

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
            disabled={loading}
            aria-invalid={error ? true : undefined}
          />
        </Field>

        <PasswordField
          id={`password-${mode}`}
          label="Password"
          value={password}
          onChange={onPasswordChange}
          autoComplete={isRegister ? "new-password" : "current-password"}
          disabled={loading}
          invalid={Boolean(error)}
          minLength={MIN_PASSWORD_LENGTH}
        />

        {isRegister ? (
          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={onConfirmPasswordChange}
            autoComplete="new-password"
            disabled={loading}
            invalid={Boolean(error)}
            minLength={MIN_PASSWORD_LENGTH}
          />
        ) : null}
      </FieldGroup>

      {isRegister ? (
        <p className="text-sm text-muted-foreground">
          We&apos;ll email a verification link to confirm your address.
        </p>
      ) : (
        <div className="flex justify-end">
          <Link
            href={forgotHref}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>
            {isRegister ? "Couldn't register" : "Couldn't log in"}
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {message ? (
        <Alert className="border-success/30 bg-success/10 text-success *:data-[slot=alert-description]:text-success/90">
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={loading}>
        <HugeiconsIcon
          icon={isRegister ? UserAdd01Icon : Login01Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        {isRegister ? "Create Account" : "Log In"}
      </Button>
    </form>
  );
}
