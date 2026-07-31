import { cache } from "react";

import { getSessionUser } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/queries/profile";

export type SessionAccountSummary = {
  email: string | null;
  avatarUrl: string | null;
  username: string | null;
};

/** Account chrome for the top nav — query helper, not a server action. */
export const getSessionAccountSummary = cache(
  async (): Promise<SessionAccountSummary | null> => {
    const user = await getSessionUser();
    if (!user) return null;
    const profile = await getProfileByUserId(user.id);
    return {
      email: user.email ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      username: profile?.username ?? profile?.displayName ?? null,
    };
  },
);
