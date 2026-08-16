import { TeamSettingsSection } from "@/components/team/team-settings-section";

export type MyTeamSettingsPanelProps = {
  slug: string;
  team: {
    name: string;
    logoUrl: string | null;
    autoPickEnabled: boolean;
  };
};

export async function MyTeamSettingsPanel({
  slug,
  team,
}: MyTeamSettingsPanelProps) {
  return (
    <TeamSettingsSection
      leagueSlug={slug}
      initialLogoUrl={team.logoUrl ?? null}
      initialAutoPickEnabled={team.autoPickEnabled}
      initialValues={{
        name: team.name,
        logoMode: "keep",
        logoUrl: team.logoUrl ?? "",
      }}
    />
  );
}
