"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CopyIcon,
  LeftToRightListDashIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clearWizardValues } from "@/lib/leagues/wizard-storage";

type CreateSuccessInviteProps = {
  inviteCode: string;
  leagueId: string;
};

export function CreateSuccessInvite({
  inviteCode,
  leagueId,
}: CreateSuccessInviteProps) {
  const invitePath = `/join/${inviteCode}`;
  const [copied, setCopied] = useState(false);
  const [fullInviteUrl, setFullInviteUrl] = useState<string | null>(null);

  useEffect(() => {
    setFullInviteUrl(`${window.location.origin}${invitePath}`);
  }, [invitePath]);

  const displayInviteUrl = fullInviteUrl ?? invitePath;

  const handleCopy = async () => {
    const url = fullInviteUrl ?? `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    clearWizardValues();
    toast.success("Invite link copied");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardDescription>Invite link</CardDescription>
          <CardTitle>{displayInviteUrl}</CardTitle>
        </CardHeader>
      </Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button type="button" onClick={handleCopy}>
          <HugeiconsIcon
            icon={CopyIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          {copied ? "Copied!" : "Copy invite link"}
        </Button>
        <Button
          nativeButton={false}
          render={<Link href={`/league/${leagueId}`} />}
          variant="outline"
        >
          <HugeiconsIcon
            icon={LeftToRightListDashIcon}
            strokeWidth={2}
            data-icon="inline-start"
          />
          Go to league
        </Button>
      </div>
    </>
  );
}
