import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  formatIrLockMessage,
  type IrLockViolation,
} from "@/lib/leagues/ir-lock";

type IrLockAlertProps = {
  violations: IrLockViolation[];
};

export function IrLockAlert({ violations }: IrLockAlertProps) {
  if (violations.length === 0) {
    return null;
  }

  return (
    <Alert variant="warning">
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
      <AlertTitle>IR eligibility required</AlertTitle>
      <AlertDescription>{formatIrLockMessage(violations)}</AlertDescription>
    </Alert>
  );
}
