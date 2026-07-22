"use client";

import { Cancel01Icon, UserMinus01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type CutPlayerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  isPending?: boolean;
  onConfirm: () => void;
};

export function CutPlayerDialog({
  open,
  onOpenChange,
  playerName,
  isPending = false,
  onConfirm,
}: CutPlayerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
                <AlertDialogHeader>
          <AlertDialogTitle>Cut player?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cut {playerName} from your roster? This
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
                <AlertDialogFooter>
          <AlertDialogCancel variant="ghost" disabled={isPending}>
            <HugeiconsIcon
              icon={Cancel01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            <HugeiconsIcon
              icon={UserMinus01Icon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            Cut player
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
