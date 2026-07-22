"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import {
  AddTeamIcon,
  ArrowDataTransferHorizontalIcon,
  ArrowExpandDiagonal01Icon,
  Calendar01Icon,
  Calendar03Icon,
  Edit02Icon,
  EraserIcon,
  GavelIcon,
  Image01Icon,
  LeftToRightListNumberIcon,
  LockIcon,
  LockKeyIcon,
  LockSync01Icon,
  Settings01Icon,
  ShuffleIcon,
  SquareRootSquareIcon,
  UserGroupIcon,
  UserMultipleIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";

import { DangerZoneMenuItems } from "@/components/leagues/settings/danger-zone-menu-items";
import { FillBotTeamsMenuItem } from "@/components/leagues/settings/fill-bot-teams-menu-item";
import { OpenFreeAgencyMenuItem } from "@/components/leagues/settings/open-free-agency-menu-item";
import { RemoveOwnerMenuItem } from "@/components/leagues/settings/remove-owner-menu-item";
import {
  SettingsMenuSection,
  type SettingsMenuItem,
} from "@/components/leagues/settings/settings-menu-section";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { MembershipOwnerOption } from "@/lib/leagues/membership";
import {
  DEFAULT_SETTINGS_TAB,
  parseSettingsTab,
  type SettingsTab,
} from "@/lib/leagues/settings-tabs";

const SETTINGS_TABS = [
  {
    value: "league" satisfies SettingsTab,
    label: "League Settings",
    title: "League Settings",
    items: [
      { label: "Edit League Name & Logo", icon: Image01Icon },
      { label: "Edit League Size", icon: UserGroupIcon },
      { label: "Realign Divisions", icon: ArrowDataTransferHorizontalIcon },
      { label: "Appoint Co-Commish", icon: UserMultipleIcon },
    ] satisfies SettingsMenuItem[],
  },
  {
    value: "rules" satisfies SettingsTab,
    label: "Rules",
    title: "Rules",
    items: [
      { label: "Edit Scoring Rules", icon: SquareRootSquareIcon },
      { label: "Edit Roster Requirements", icon: Edit02Icon },
      { label: "Edit Lineup Locking", icon: LockIcon },
      { label: "Edit Waiver Wire Rules", icon: LockKeyIcon },
      { label: "Edit Tiebreak Rules", icon: ArrowExpandDiagonal01Icon },
      { label: "Edit Transaction Rules", icon: LockSync01Icon },
    ] satisfies SettingsMenuItem[],
  },
  {
    value: "schedule" satisfies SettingsTab,
    label: "Schedule",
    title: "Schedule",
    items: [
      { label: "Edit Regular Season Schedule", icon: Calendar03Icon },
      { label: "Edit Playoffs", icon: Calendar01Icon },
      { label: "Edit Playoff Seeding", icon: ArrowDataTransferHorizontalIcon },
    ] satisfies SettingsMenuItem[],
  },
  {
    value: "draft" satisfies SettingsTab,
    label: "Draft",
    title: "Draft",
    items: [
      { label: "Configure Draft", icon: Settings01Icon },
      { label: "Edit Draft Order", icon: ShuffleIcon },
      { label: "Fill Empty Slots", icon: AddTeamIcon },
      { label: "Open Free Agency", icon: GavelIcon },
    ] satisfies SettingsMenuItem[],
  },
  {
    value: "commish" satisfies SettingsTab,
    label: "Commish Powers",
    title: "Commish Powers",
    items: [
      { label: "Set Starting Lineups", icon: Wrench01Icon },
      { label: "Edit Past Box Score", icon: EraserIcon },
      { label: "Edit Waiver Order", icon: LeftToRightListNumberIcon },
    ] satisfies SettingsMenuItem[],
  },
  {
    value: "danger" satisfies SettingsTab,
    label: "Danger Zone",
    title: "Danger Zone",
    variant: "danger" as const,
    items: [] satisfies SettingsMenuItem[],
  },
];

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
  divisionCount: number;
  regularSeasonFinished: boolean;
  boxScoresEditable: boolean;
  owners: MembershipOwnerOption[];
};

export function LeagueSettingsTabs({
  slug,
  leagueName,
  seasonStatus,
  freeAgencyOpen,
  divisionCount,
  regularSeasonFinished,
  boxScoresEditable,
  owners,
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

    return tab;
  });

  return (
    <Tabs value={activeTab} onValueChange={setTab} className="gap-4">
      <div className="max-w-full overflow-x-auto">
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
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="outline-none">
          {tab.value === "draft" ? (
            <SettingsMenuSection
              title={tab.title}
              items={tab.items.filter(
                (item) =>
                  item.label !== "Open Free Agency" &&
                  item.label !== "Fill Empty Slots",
              )}
              variant={tab.variant}
              footer={
                <div className="flex flex-col gap-0.5">
                  <FillBotTeamsMenuItem slug={slug} />
                  <OpenFreeAgencyMenuItem
                    slug={slug}
                    seasonStatus={seasonStatus}
                    freeAgencyOpen={freeAgencyOpen}
                  />
                </div>
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
