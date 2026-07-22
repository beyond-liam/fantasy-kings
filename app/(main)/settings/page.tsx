import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UserSettingsForm } from "@/components/account/user-settings-form";
import { ensureProfile, getSessionUser } from "@/lib/auth/session";
import { getProfileByUserId } from "@/lib/queries/profile";

export const metadata: Metadata = {
  title: "Settings",
};

function fallbackUsername(email: string | undefined, displayName: string | null) {
  const fromDisplay = displayName?.replace(/[^a-zA-Z0-9_]/g, "") ?? "";
  if (fromDisplay.length >= 3) return fromDisplay.slice(0, 24);
  const fromEmail = email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") ?? "user";
  return (fromEmail.length >= 3 ? fromEmail : `user_${fromEmail}`).slice(0, 24);
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/settings");
  }

  await ensureProfile(user);
  const profile = await getProfileByUserId(user.id);
  if (!profile) {
    redirect("/login?next=/settings");
  }

  const username =
    profile.username?.trim() ||
    fallbackUsername(user.email, profile.displayName);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        Settings
      </h1>

      <UserSettingsForm
        initialAvatarUrl={profile.avatarUrl ?? null}
        initialValues={{
          email: user.email ?? "",
          username,
          firstName: profile.firstName ?? "",
          lastName: profile.lastName ?? "",
          avatarMode: "keep",
          avatarUrl: profile.avatarUrl ?? "",
        }}
      />
    </div>
  );
}
