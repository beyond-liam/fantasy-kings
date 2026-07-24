import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  formatTaxiLockMessage,
  type TaxiLockViolation,
} from "@/lib/leagues/taxi-lock";

type TaxiLockAlertProps = {
  violations: TaxiLockViolation[];
};

export function TaxiLockAlert({ violations }: TaxiLockAlertProps) {
  if (violations.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
      <AlertTitle>Taxi eligibility required</AlertTitle>
      <AlertDescription>{formatTaxiLockMessage(violations)}</AlertDescription>
    </Alert>
  );
}
