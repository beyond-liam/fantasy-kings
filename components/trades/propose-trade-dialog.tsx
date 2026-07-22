"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRightIcon,
  ArrowRight02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { tradeComposerPath } from "@/lib/leagues/utils";

export type ProposeTradePartner = {
  id: string;
  name: string;
  slug: string;
};

type ProposeTradeDialogProps = {
  leagueSlug: string;
  partners: ProposeTradePartner[];
};

export function ProposeTradeDialog({
  leagueSlug,
  partners,
}: ProposeTradeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  if (partners.length === 0) {
    return null;
  }

  const items = partners.map((partner) => ({
    value: partner.id,
    label: partner.name,
  }));

  function handleContinue() {
    const partner = partners.find((item) => item.id === partnerId);
    if (!partner) {
      return;
    }
    setOpen(false);
    router.push(
      tradeComposerPath(leagueSlug, {
        with: partner.slug,
      }),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setPartnerId(null);
        }
      }}
    >
      <Button type="button" onClick={() => setOpen(true)}>
        <HugeiconsIcon
          icon={ArrowLeftRightIcon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        Propose New Trade
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Trade With</DialogTitle>
          <DialogDescription>
            Choose the team you want to propose a trade to.
          </DialogDescription>
        </DialogHeader>
                <FieldGroup>
          <Field>
            <FieldLabel htmlFor="trade-partner">Team</FieldLabel>
            <Select
              items={items}
              value={partnerId}
              onValueChange={setPartnerId}
            >
              <SelectTrigger id="trade-partner" className="w-full">
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
                <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
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
            disabled={!partnerId}
            onClick={handleContinue}
          >
            <HugeiconsIcon
              icon={ArrowRight02Icon}
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
