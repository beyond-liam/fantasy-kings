import Link from "next/link";
import {
  InformationCircleIcon,
  NoteEditIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type DraftUnderwayAlertProps = {
  slug: string;
  paused?: boolean;
};

export function DraftUnderwayAlert({
  slug,
  paused = false,
}: DraftUnderwayAlertProps) {
  return (
    <Alert variant="info">
      <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} />
      <AlertTitle>{paused ? "Draft paused" : "Draft started"}</AlertTitle>
      <AlertDescription>
        {paused
          ? "The draft is paused. Jump back in when you're ready."
          : "The draft is underway. Head to the draft room to make picks."}
      </AlertDescription>
      <AlertAction>
        <Button
          nativeButton={false}
          size="sm"
          variant="outline"
          render={<Link href={`/league/${slug}/draft`} />}
        >
          <HugeiconsIcon
            icon={NoteEditIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Draft room
        </Button>
      </AlertAction>
    </Alert>
  );
}
