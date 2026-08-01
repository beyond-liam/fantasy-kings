"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resolveLeagueInviteCode } from "@/lib/actions/leagues";

type JoinLeagueDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
};

export function JoinLeagueDialog({
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
}: JoinLeagueDialogProps = {}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = controlledOpen ?? internalOpen;

  function setOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
    }
    if (onOpenChange) {
      onOpenChange(nextOpen);
      return;
    }
    setInternalOpen(nextOpen);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resolveLeagueInviteCode(code);
      if (!result.success || !result.path) {
        setError(result.error ?? "Invalid league code.");
        return;
      }
      setOpen(false);
      router.push(result.path);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger render={<Button type="button" variant="outline" />}>
          <HugeiconsIcon
            icon={Link01Icon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Join League
        </DialogTrigger>
      ) : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a league</DialogTitle>
          <DialogDescription>
            Enter the league code from your commissioner&apos;s invite.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="contents">
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="league-code">League code</FieldLabel>
              <Input
                id="league-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABCD1234"
                autoComplete="off"
                spellCheck={false}
                required
                aria-invalid={error ? true : undefined}
              />
            </Field>
          </FieldGroup>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn&apos;t find league</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || !code.trim()}>
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
