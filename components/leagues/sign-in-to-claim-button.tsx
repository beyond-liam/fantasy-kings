"use client";

import { useRouter } from "next/navigation";
import { UserIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";

type SignInToClaimButtonProps = {
  inviteCode: string;
};

export function SignInToClaimButton({ inviteCode }: SignInToClaimButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      className="w-fit"
      onClick={() => {
        router.push(
          `/login?next=${encodeURIComponent(`/join/${inviteCode}`)}`,
        );
      }}
    >
      <HugeiconsIcon
        icon={UserIcon}
        strokeWidth={2}
        data-icon="inline-start"
      />
      Sign in to claim
    </Button>
  );
}
