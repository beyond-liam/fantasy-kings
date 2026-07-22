import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { getSessionUser } from "@/lib/auth/session";
import { getLeagueBySlug, isLeagueMember } from "@/lib/queries/leagues";

export async function LeagueLayoutGuard({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ leagueId: string }>;
}>) {
  const { leagueId } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=/league/${leagueId}`);
  }

  const league = await getLeagueBySlug(leagueId);
  if (!league) {
    redirect("/leagues");
  }

  const member = await isLeagueMember(league.id, user.id);
  if (!member) {
    redirect("/leagues");
  }

  // Old slug bookmarks → canonical short id (preserve subpath)
  if (league.publicId !== leagueId) {
    const headerStore = await headers();
    const pathname = headerStore.get("x-pathname") ?? `/league/${leagueId}`;
    const suffix = pathname.startsWith(`/league/${leagueId}`)
      ? pathname.slice(`/league/${leagueId}`.length)
      : "";
    redirect(`/league/${league.publicId}${suffix}`);
  }

  return children;
}
