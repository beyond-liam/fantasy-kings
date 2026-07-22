import { UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

const toastedOverallByLeague = new Map<string, Set<number>>();

function toastedSet(slug: string) {
  let set = toastedOverallByLeague.get(slug);
  if (!set) {
    set = new Set();
    toastedOverallByLeague.set(slug, set);
  }
  return set;
}

/** Single toast format for every pick method. Dedupes by league + overall. */
export function toastDraftPick(input: {
  slug: string;
  overall: number;
  playerFullName: string;
  teamName: string;
}) {
  const set = toastedSet(input.slug);
  if (set.has(input.overall)) {
    return false;
  }

  set.add(input.overall);
  toast.info(`${input.playerFullName} drafted by ${input.teamName}`, {
    icon: (
      <HugeiconsIcon
        icon={UserAdd01Icon}
        strokeWidth={2}
        className="size-4 text-emerald-400"
      />
    ),
  });
  return true;
}
