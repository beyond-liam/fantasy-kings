"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Cancel01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  SETTINGS_MENU_ITEM_CLASS,
  SettingsMenuChevron,
} from "@/components/leagues/settings/settings-menu-section";
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { removeLeagueOwner } from "@/lib/actions/league-settings";
import {
  OWNER_REMOVAL_REASONS,
  type MembershipOwnerOption,
  type OwnerRemovalReason,
} from "@/lib/leagues/membership";

type RemoveOwnerMenuItemProps = {
  slug: string;
  owners: MembershipOwnerOption[];
};

export function RemoveOwnerMenuItem({
  slug,
  owners,
}: RemoveOwnerMenuItemProps) {
  const router = useRouter();
  const removable = useMemo(
    () => owners.filter((owner) => owner.role !== "commissioner"),
    [owners],
  );
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reason, setReason] = useState<OwnerRemovalReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectItems = removable.map((owner) => ({
    value: owner.userId,
    label: `${owner.displayName} · ${owner.teamName}`,
  }));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSelectedUserId(null);
      setReason(null);
      setError(null);
    }
  };

  const handleRemove = () => {
    if (!selectedUserId) {
      setError("Select an owner to remove.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removeLeagueOwner(slug, selectedUserId, reason);
      if (!result.success) {
        setError(result.error ?? "Could not remove owner.");
        return;
      }
      handleOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className={SETTINGS_MENU_ITEM_CLASS}
          />
        }
      >
        <HugeiconsIcon
          icon={UserRemove01Icon}
          strokeWidth={1.75}
          data-icon="inline-start"
          className="text-muted-foreground transition-colors duration-150 group-hover/settings-item:text-foreground group-hover/button:text-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-left text-pretty">
          Remove Owner
        </span>
        <SettingsMenuChevron />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">
            Remove Owner From League
          </DialogTitle>
          <DialogDescription className="text-pretty">
            The team stays as an open slot. A reason is optional but saved for
            later reference.
          </DialogDescription>
        </DialogHeader>

                <FieldGroup>
          <Field>
            <FieldLabel>Owner</FieldLabel>
            {removable.length === 0 ? (
              <FieldDescription>
                No removable owners in this league.
              </FieldDescription>
            ) : (
              <Select
                items={selectItems}
                value={selectedUserId ?? undefined}
                onValueChange={(value) => {
                  if (value) setSelectedUserId(value);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {removable.map((owner) => (
                      <SelectItem key={owner.userId} value={owner.userId}>
                        <span className="flex min-w-0 flex-col gap-0.5 text-left">
                          <span className="truncate">{owner.displayName}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {owner.teamName}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field>
            <FieldLabel>Reason (optional)</FieldLabel>
            <RadioGroup
              value={reason ?? undefined}
              onValueChange={(value) =>
                setReason(value as OwnerRemovalReason)
              }
              className="gap-2"
            >
              {OWNER_REMOVAL_REASONS.map((item) => {
                const id = `remove-reason-${item.value}`;
                return (
                  <Label
                    key={item.value}
                    htmlFor={id}
                    className="flex cursor-pointer items-start gap-3 font-normal"
                  >
                    <RadioGroupItem id={id} value={item.value} className="mt-0.5" />
                    <span className="text-sm text-pretty">{item.label}</span>
                  </Label>
                );
              })}
            </RadioGroup>
          </Field>
        </FieldGroup>

        {error ? (
          <p className="text-sm text-pretty text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
          >
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || !selectedUserId || removable.length === 0}
            onClick={handleRemove}
          >
            <HugeiconsIcon
              icon={UserRemove01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Remove Owner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
