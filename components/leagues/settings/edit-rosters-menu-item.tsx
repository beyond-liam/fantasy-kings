"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight01Icon,
  Cancel01Icon,
  UserEdit01Icon,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { KeeperTeamOption } from "@/lib/queries/keepers";

type EditRostersMenuItemProps = {
  slug: string;
  teams: KeeperTeamOption[];
};

export function EditRostersMenuItem({ slug, teams }: EditRostersMenuItemProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSelectedTeamId(null);
    }
  };

  const handleContinue = () => {
    if (!selectedTeamId) return;
    handleOpenChange(false);
    router.push(
      `/league/${slug}/settings/edit-roster?team=${encodeURIComponent(selectedTeamId)}`,
    );
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
          icon={UserEdit01Icon}
          strokeWidth={1.75}
          data-icon="inline-start"
          className="text-muted-foreground transition-colors duration-150 group-hover/settings-item:text-foreground group-hover/button:text-foreground"
        />
        <span className="min-w-0 flex-1 truncate text-left text-pretty">
          Edit Rosters
        </span>
        <SettingsMenuChevron />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-balance">Edit roster</DialogTitle>
          <DialogDescription className="text-pretty">
            Choose a team, then add or remove players.
          </DialogDescription>
        </DialogHeader>

        {teams.length === 0 ? (
          <FieldDescription>No teams in this league yet.</FieldDescription>
        ) : (
          <FieldGroup>
            <Field>
              <FieldLabel>Team</FieldLabel>
              <RadioGroup
                variant="card"
                value={selectedTeamId ?? undefined}
                onValueChange={(value) => {
                  if (value) setSelectedTeamId(value);
                }}
                className="max-h-72 overflow-y-auto"
              >
                {teams.map((team) => (
                  <RadioGroupItem key={team.teamId} value={team.teamId}>
                    <span className="block text-sm font-medium">
                      {team.teamName}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {team.ownerName ?? "Open slot"}
                    </span>
                  </RadioGroupItem>
                ))}
              </RadioGroup>
            </Field>
          </FieldGroup>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
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
            disabled={!selectedTeamId}
            onClick={handleContinue}
          >
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
