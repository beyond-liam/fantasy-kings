"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  completeOnboarding,
  getOnboardingState,
} from "@/lib/actions/onboarding";
import { NFL_TEAM_LABELS, NFL_TEAMS } from "@/lib/nfl/teams";

export function OnboardingDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [favouriteNflTeam, setFavouriteNflTeam] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getOnboardingState().then((state) => {
      if (cancelled || !state) return;
      setEmail(state.email ?? "");
      setOpen(state.needsOnboarding);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        firstName,
        lastName,
        favouriteNflTeam: favouriteNflTeam as (typeof NFL_TEAMS)[number],
      });
      if (!result.success) {
        setError(result.error ?? "Could not save profile.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Fantasy Kings</DialogTitle>
          <DialogDescription>
            Tell us a bit about yourself to finish setting up your account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="contents">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="onboarding-email">Email</FieldLabel>
              <Input id="onboarding-email" value={email} disabled />
            </Field>
            <Field>
              <FieldLabel htmlFor="onboarding-first-name">First name</FieldLabel>
              <Input
                id="onboarding-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                autoComplete="given-name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="onboarding-last-name">Last name</FieldLabel>
              <Input
                id="onboarding-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                autoComplete="family-name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="onboarding-team">Favourite team</FieldLabel>
              <Select
                items={NFL_TEAMS.map((abbrev) => ({
                  value: abbrev,
                  label: NFL_TEAM_LABELS[abbrev],
                }))}
                value={favouriteNflTeam || undefined}
                onValueChange={(value) => setFavouriteNflTeam(value ?? "")}
              >
                <SelectTrigger id="onboarding-team" className="w-full">
                  <SelectValue placeholder="Select an NFL team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {NFL_TEAMS.map((abbrev) => (
                      <SelectItem key={abbrev} value={abbrev}>
                        {NFL_TEAM_LABELS[abbrev]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn&apos;t save</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || !favouriteNflTeam}>
              <HugeiconsIcon
                icon={Tick02Icon}
                strokeWidth={2}
                data-icon="inline-start"
              />
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
