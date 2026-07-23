"use client";

import { useEffect, useState } from "react";
import {
  CheckmarkCircle02Icon,
  Copy01Icon,
  TickDouble02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type InviteLinkCardProps = {
  inviteCode: string;
};

export function InviteLinkCard({ inviteCode }: InviteLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [fullInviteUrl, setFullInviteUrl] = useState<string | null>(null);

  const invitePath = `/join/${inviteCode}`;
  const displayInviteUrl = fullInviteUrl ?? invitePath;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window.location is unavailable during SSR; this fills in the full URL post-hydration to avoid a mismatch.
    setFullInviteUrl(`${window.location.origin}${invitePath}`);
  }, [invitePath]);

  const handleCopy = async () => {
    const url = fullInviteUrl ?? `${window.location.origin}${invitePath}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const copyButton = (
    <Button
      type="button"
      variant="ghost-success"
      size="icon-sm"
      aria-label={copied ? "Copied" : "Copy invite link"}
      onClick={handleCopy}
    >
      <span className="relative flex size-4 items-center justify-center">
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-[opacity,filter,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
            copied
              ? "scale-100 opacity-100 blur-0"
              : "scale-[0.25] opacity-0 blur-[4px]",
          )}
          aria-hidden
        >
          <HugeiconsIcon icon={TickDouble02Icon} strokeWidth={2} />
        </span>
        <span
          className={cn(
            "flex items-center justify-center transition-[opacity,filter,scale] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)]",
            copied
              ? "scale-[0.25] opacity-0 blur-[4px]"
              : "scale-100 opacity-100 blur-0",
          )}
          aria-hidden
        >
          <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
        </span>
      </span>
    </Button>
  );

  return (
    <Alert className="border-success/30 bg-success/10 text-success *:data-[slot=alert-description]:text-success/90">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} />
      <AlertTitle>Invite managers</AlertTitle>
      <AlertDescription>
        Share this link for open join until the league fills up.
        <p className="mt-2 break-all font-mono text-current/90">
          {displayInviteUrl}
        </p>
      </AlertDescription>
      <AlertAction>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={copyButton} />
            <TooltipContent>
              {copied ? "Copied" : "Copy invite link"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </AlertAction>
    </Alert>
  );
}
