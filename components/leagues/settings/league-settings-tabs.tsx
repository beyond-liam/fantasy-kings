"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  ArrowDataTransferHorizontalIcon,
  ArrowExpandDiagonal01Icon,
  Calendar01Icon,
  Calendar03Icon,
  Edit02Icon,
  EraserIcon,
  GavelIcon,
  Image01Icon,
  LeftToRightListNumberIcon,
  Legal01Icon,
  ListSettingIcon,
  LockIcon,
  LockKeyIcon,
  LockSync01Icon,
  LoyaltyCardIcon,
  PowerServiceIcon,
  Settings01Icon,
  ShuffleIcon,
  SkullIcon,
  SquareRootSquareIcon,
  TaskEdit01Icon,
  UserGroupIcon,
  UserMultipleIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import { ClearNonKeepersMenuItem } from "@/components/leagues/settings/clear-non-keepers-menu-item";
import { DangerZoneMenuItems } from "@/components/leagues/settings/danger-zone-menu-items";
import { EditRostersMenuItem } from "@/components/leagues/settings/edit-rosters-menu-item";
import { FillBotTeamsMenuItem } from "@/components/leagues/settings/fill-bot-teams-menu-item";
import { OpenFreeAgencyMenuItem } from "@/components/leagues/settings/open-free-agency-menu-item";
import { RemoveOwnerMenuItem } from "@/components/leagues/settings/remove-owner-menu-item";
import { SetKeepersMenuItem } from "@/components/leagues/settings/set-keepers-menu-item";
import {
  SettingsMenuSection,
  type SettingsMenuItem,
} from "@/components/leagues/settings/settings-menu-section";
import {
  MobileTabDrawer,
  type MobileTabDrawerItem,
} from "@/components/layout/mobile-tab-drawer";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { MembershipOwnerOption } from "@/lib/leagues/membership";
import type { NonKeeperClearanceTeam } from "@/lib/leagues/keepers/clearance";
import type { KeeperTeamOption } from "@/lib/queries/keepers";
import {
  DEFAULT_SETTINGS_TAB,
  parseSettingsTab,
  type SettingsTab,
} from "@/lib/leagues/settings-tabs";

const SETTINGS_TABS: {
  value: SettingsTab;
  label: string;
  title: string;
  icon: IconSvgElement;
  variant?: "danger";
  items: SettingsMenuItem[];
}[] = [
  {
    value: "league",
    label: "League Settings",
    title: "League Settings",
    icon: ListSettingIcon,
    items: [
      { label: "Edit League Name & Logo", icon: Image01Icon },
      { label: "Edit League Size", icon: UserGroupIcon },
      { label: "Realign Divisions", icon: ArrowDataTransferHorizontalIcon },
      { label: "Appoint Co-Commish", icon: UserMultipleIcon },
    ],
  },
  {
    value: "rules",
    label: "Rules",
    title: "Rules",
    icon: Legal01Icon,
    items: [
      { label: "Edit Scoring Rules", icon: SquareRootSquareIcon },
      { label: "Edit Roster Requirements", icon: Edit02Icon },
      { label: "Edit Lineup Locking", icon: LockIcon },
      { label: "Edit Waiver Wire Rules", icon: LockKeyIcon },
      { label: "Edit Tiebreak Rules", icon: ArrowExpandDiagonal01Icon },
      { label: "Edit Transaction Rules", icon: LockSync01Icon },
      { label: "Edit Dynasty Rules", icon: LoyaltyCardIcon },
    ],
  },
  {
    value: "schedule",
    label: "Schedule",
    title: "Schedule",
    icon: Calendar03Icon,
    items: [
      { label: "Edit Regular Season Schedule", icon: Calendar03Icon },
      { label: "Edit Playoffs", icon: Calendar01Icon },
      { label: "Edit Playoff Seeding", icon: ArrowDataTransferHorizontalIcon },
    ],
  },
  {
    value: "draft",
    label: "Draft",
    title: "Draft",
    icon: TaskEdit01Icon,
    items: [
      { label: "Configure Draft", icon: Settings01Icon },
      { label: "Edit Draft Order", icon: ShuffleIcon },
      { label: "Open Free Agency", icon: GavelIcon },
    ],
  },
  {
    value: "commish",
    label: "Commish Powers",
    title: "Commish Powers",
    icon: PowerServiceIcon,
    items: [
      { label: "Set Starting Lineups", icon: Wrench01Icon },
      { label: "Edit Past Box Score", icon: EraserIcon },
      { label: "Edit Waiver Order", icon: LeftToRightListNumberIcon },
    ],
  },
  {
    value: "danger",
    label: "Danger Zone",
    title: "Danger Zone",
    icon: SkullIcon,
    variant: "danger",
    items: [],
  },
];

const SETTINGS_DRAWER_TABS: readonly MobileTabDrawerItem[] = SETTINGS_TABS.map(
  (tab) => ({
    value: tab.value,
    label: tab.label,
    icon: tab.icon,
  }),
);
function getSettingsTabs(slug: string) {
  return SETTINGS_TABS.map((tab) => {
    if (tab.value === "rules") {
      return {
        ...tab,
        items: tab.items.map((item) => {
          if (item.label === "Edit Scoring Rules") {
            return { ...item, href: `/league/${slug}/settings/scoring` };
          }
          if (item.label === "Edit Roster Requirements") {
            return { ...item, href: `/league/${slug}/settings/roster` };
          }
          if (item.label === "Edit Lineup Locking") {
            return { ...item, href: `/league/${slug}/settings/lineup-locking` };
          }
          if (item.label === "Edit Waiver Wire Rules") {
            return { ...item, href: `/league/${slug}/settings/waivers` };
          }
          if (item.label === "Edit Tiebreak Rules") {
            return { ...item, href: `/league/${slug}/settings/tiebreakers` };
          }
          if (item.label === "Edit Transaction Rules") {
            return { ...item, href: `/league/${slug}/settings/transactions` };
          }
          if (item.label === "Edit Dynasty Rules") {
            return { ...item, href: `/league/${slug}/settings/dynasty` };
          }
          return item;
        }),
      };
    }

    if (tab.value === "draft") {
      return {
        ...tab,
        items: tab.items.map((item) => {
          if (item.label === "Configure Draft") {
            return { ...item, href: `/league/${slug}/settings/draft` };
          }
          if (item.label === "Edit Draft Order") {
            return { ...item, href: `/league/${slug}/settings/draft-order` };
          }
          return item;
        }),
      };
    }

    if (tab.value === "schedule") {
      return {
        ...tab,
        items: tab.items.map((item) => {
          if (item.label === "Edit Regular Season Schedule") {
            return { ...item, href: `/league/${slug}/settings/schedule` };
          }
          if (item.label === "Edit Playoffs") {
            return { ...item, href: `/league/${slug}/settings/playoffs` };
          }
          return item;
        }),
      };
    }

    if (tab.value === "commish") {
      return {
        ...tab,
        items: tab.items.map((item) => {
          if (item.label === "Set Starting Lineups") {
            return { ...item, href: `/league/${slug}/settings/lineups` };
          }
          if (item.label === "Edit Waiver Order") {
            return { ...item, href: `/league/${slug}/settings/waiver-order` };
          }
          return item;
        }),
      };
    }

    if (tab.value === "league") {
      return {
        ...tab,
        items: tab.items.map((item) => {
          if (item.label === "Edit League Name & Logo") {
            return { ...item, href: `/league/${slug}/settings/league` };
          }
          if (item.label === "Edit League Size") {
            return { ...item, href: `/league/${slug}/settings/league-size` };
          }
          if (item.label === "Realign Divisions") {
            return {
              ...item,
              href: `/league/${slug}/settings/realign-divisions`,
            };
          }
          if (item.label === "Appoint Co-Commish") {
            return {
              ...item,
              href: `/league/${slug}/settings/co-commissioners`,
            };
          }
          return item;
        }),
      };
    }

    return tab;
  });
}

type LeagueSettingsTabsProps = {
  slug: string;
  leagueName: string;
  seasonStatus: string;
  freeAgencyOpen: boolean;
  vacantSlotCount: number;
  divisionCount: number;
  leagueType: string;
  regularSeasonFinished: boolean;
  boxScoresEditable: boolean;
  owners: MembershipOwnerOption[];
  keeperTeams: KeeperTeamOption[];
  clearanceTeams: NonKeeperClearanceTeam[];
  keepersLocked: boolean;
  keepersMaxConfigured: boolean;
};

export function LeagueSettingsTabs({
  slug,
  leagueName,
  seasonStatus,
  freeAgencyOpen,
  vacantSlotCount,
  divisionCount,
  leagueType,
  regularSeasonFinished,
  boxScoresEditable,
  owners,
  keeperTeams,
  clearanceTeams,
  keepersLocked,
  keepersMaxConfigured,
}: LeagueSettingsTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseSettingsTab(searchParams.get("tab"));

  const setTab = (next: string | number | null) => {
    const value = parseSettingsTab(String(next ?? DEFAULT_SETTINGS_TAB));
    const params = new URLSearchParams(searchParams.toString());
    if (value === DEFAULT_SETTINGS_TAB) {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const tabs = getSettingsTabs(slug).map((tab) => {
    if (tab.value === "schedule") {
      return {
        ...tab,
        items: tab.items.map((item) =>
          item.label === "Edit Playoff Seeding"
            ? {
                ...item,
                disabled: !regularSeasonFinished,
                disabledReason:
                  "Playoff seeding unlocks after the regular season finishes.",
              }
            : item,
        ),
      };
    }

    if (tab.value === "commish") {
      return {
        ...tab,
        items: tab.items.map((item) =>
          item.label === "Edit Past Box Score"
            ? {
                ...item,
                disabled: !boxScoresEditable,
                disabledReason:
                  "Past box scores are only available once games have started.",
              }
            : item,
        ),
      };
    }

    if (tab.value === "league") {
      return {
        ...tab,
        items: tab.items.filter(
          (item) => item.label !== "Realign Divisions" || divisionCount >= 2,
        ),
      };
    }

    if (tab.value === "rules") {
      return {
        ...tab,
        items: tab.items.filter(
          (item) =>
            item.label !== "Edit Dynasty Rules" || leagueType === "dynasty",
        ),
      };
    }

    return tab;
  });

  return (
    <Tabs value={activeTab} onValueChange={setTab} className="gap-4">
      <div className="hidden max-w-full overflow-x-auto md:block">
        <TabsList className="min-w-max">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="transition-[color,background-color,box-shadow,opacity] duration-150 ease-out"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <MobileTabDrawer
        items={SETTINGS_DRAWER_TABS}
        value={activeTab}
        onSelect={setTab}
        title="Settings sections"
        description="Choose which settings section to view"
      />
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="outline-none">
          {tab.value === "draft" ? (
            <SettingsMenuSection
              title={tab.title}
              items={tab.items.filter(
                (item) => item.label !== "Open Free Agency",
              )}
              variant={tab.variant}
              footer={
                <div className="flex flex-col gap-0.5">
                  <FillBotTeamsMenuItem
                    slug={slug}
                    vacantSlotCount={vacantSlotCount}
                  />
                  <OpenFreeAgencyMenuItem
                    slug={slug}
                    seasonStatus={seasonStatus}
                    freeAgencyOpen={freeAgencyOpen}
                  />
                </div>
              }
            />
          ) : tab.value === "commish" ? (
            <SettingsMenuSection
              title={tab.title}
              items={tab.items}
              variant={tab.variant}
              footer={
                leagueType === "dynasty" ? (
                  <div className="flex flex-col gap-0.5">
                    <SetKeepersMenuItem slug={slug} teams={keeperTeams} />
                    <EditRostersMenuItem slug={slug} teams={keeperTeams} />
                    <ClearNonKeepersMenuItem
                      slug={slug}
                      teams={clearanceTeams}
                      keepersLocked={keepersLocked}
                      keepersMaxConfigured={keepersMaxConfigured}
                    />
                  </div>
                ) : null
              }
            />
          ) : tab.value === "danger" ? (
            <SettingsMenuSection
              title={tab.title}
              items={tab.items}
              variant={tab.variant}
              leading={
                <div className="flex flex-col gap-0.5">
                  <RemoveOwnerMenuItem slug={slug} owners={owners} />
                  <DangerZoneMenuItems
                    slug={slug}
                    leagueName={leagueName}
                    owners={owners}
                  />
                </div>
              }
            />
          ) : (
            <SettingsMenuSection
              title={tab.title}
              items={tab.items}
              variant={tab.variant}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
