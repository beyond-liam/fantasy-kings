"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import {
  playerProfileFallbackHref,
  playerProfileReturnFromReferrer,
} from "@/lib/players/profile-path";

const RETURN_HREF_KEY = "fk:player-profile-return:v1";

function readReturnHref(): string | null {
  try {
    return sessionStorage.getItem(RETURN_HREF_KEY);
  } catch {
    return null;
  }
}

function writeReturnHref(href: string) {
  try {
    sessionStorage.setItem(RETURN_HREF_KEY, href);
  } catch {
    // Private browsing / quota
  }
}

function clearReturnHref() {
  try {
    sessionStorage.removeItem(RETURN_HREF_KEY);
  } catch {
    // Private browsing / quota
  }
}

type PlayerPageBackButtonProps = {
  leagueSlug?: string | null;
};

export function PlayerPageBackButton({
  leagueSlug,
}: PlayerPageBackButtonProps) {
  const router = useRouter();

  useEffect(() => {
    const fromReferrer = playerProfileReturnFromReferrer({
      referrer: document.referrer,
      origin: window.location.origin,
    });
    if (fromReferrer) {
      writeReturnHref(fromReferrer);
    }
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        const fromReferrer = playerProfileReturnFromReferrer({
          referrer: document.referrer,
          origin: window.location.origin,
        });
        if (fromReferrer) {
          writeReturnHref(fromReferrer);
        }
        const href =
          readReturnHref() ?? playerProfileFallbackHref(leagueSlug);
        clearReturnHref();
        router.push(href);
      }}
      className="-ml-2 gap-1.5 text-current hover:bg-black/10 hover:text-current dark:hover:bg-white/15"
    >
      <HugeiconsIcon
        icon={ArrowLeft01Icon}
        strokeWidth={2}
        data-icon="inline-start"
        className="translate-y-px"
      />
      Back
    </Button>
  );
}
