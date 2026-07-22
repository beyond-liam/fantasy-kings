import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { secondsToPickTime } from "@/lib/leagues/defaults";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { formatDraftScheduledAt } from "@/lib/leagues/draft-status";
import { formatLeagueLabel } from "@/lib/leagues/format";
import { resolveIrEligibleStatuses } from "@/lib/leagues/ir-eligibility";
import {
  derivePlayoffSummary,
  resolvePlayoffSettings,
} from "@/lib/leagues/playoff-settings";
import { resolveScheduleSettings } from "@/lib/leagues/schedule/settings";
import {
  labelForGameTiebreaker,
  labelForRankTiebreaker,
  resolveTiebreakerSettings,
} from "@/lib/leagues/tiebreakers";
import {
  resolveTransactionRules,
  TRADE_PROCESSING_OPTIONS,
} from "@/lib/leagues/transaction-rules";
import {
  resolveWaiverWireSettings,
  WAIVER_PROCESS_DAY_OPTIONS,
} from "@/lib/leagues/waiver-wire";
import { WAIVER_CLAIM_DEADLINE_OFFSET_HOURS, WAIVER_FCFS_OFFSET_HOURS, WAIVER_PROCESS_HOUR_UTC } from "@/lib/leagues/waivers/calendar";

export type LeagueRulesRow = {
  label: string;
  value: string;
};

export type LeagueRulesSection = {
  title: string;
  rows: LeagueRulesRow[];
};

export type LeagueRulesSeasonInput = {
  playoffTeamCount: number;
  championshipWeek: number;
  regularSeasonEndWeek: number;
  rosterMode: string;
  benchSlots: number;
  irEnabled: boolean;
  irSlots: number;
  taxiEnabled: boolean;
  taxiSlots: number;
  waiversEnabled: boolean;
  waiverType: "priority" | "faab";
  faabBudget: number | null;
  tradesEnabled: boolean;
  tradeProcessing: string;
  tradeDeadlineWeek: number | null;
  draftType: "live" | "email";
  draftStartAt: Date;
  pickTimeLimitSeconds: number;
  settings: LeagueSeasonSettings;
};

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function weekOrNone(week: number | null | undefined): string {
  return week == null ? "None" : `Week ${week}`;
}

function tradeProcessingLabel(value: string): string {
  return (
    TRADE_PROCESSING_OPTIONS.find((option) => option.value === value)?.label ??
    formatLeagueLabel(value)
  );
}

function rosterRequirementsLabel(
  settings: LeagueSeasonSettings,
  benchSlots: number,
  irEnabled: boolean,
  irSlots: number,
  taxiEnabled: boolean,
  taxiSlots: number,
): { requirements: string; totals: string } {
  const starters = (settings.rosterSlots ?? []).filter((slot) => slot.isStarter);
  const requirements =
    starters.length > 0
      ? starters
          .map((slot) => `${slot.slotCount} ${slot.positionId}`)
          .join(", ")
      : "Standard";

  const starterCount = starters.reduce((sum, slot) => sum + slot.slotCount, 0);
  const irCount = irEnabled ? irSlots : 0;
  const taxiCount = taxiEnabled ? taxiSlots : 0;
  const total = starterCount + benchSlots + irCount + taxiCount;
  const extras = [
    irCount > 0 ? `${irCount} IR` : null,
    taxiCount > 0 ? `${taxiCount} Taxi` : null,
  ].filter(Boolean);

  const totals = extras.length
    ? `${total}: ${starterCount} Starters, ${benchSlots} Bench (${extras.join(", ")})`
    : `${total}: ${starterCount} Starters, ${benchSlots} Bench`;

  return { requirements, totals };
}

function waiverPoolLabel(
  pool: ReturnType<typeof resolveWaiverWireSettings>["waiverPool"],
): string {
  if (pool === "drops_only") {
    return "Dropped players only";
  }
  return "Dropped players and free agents (game-start lock until next week)";
}

function churnPreventionLabel(
  value: ReturnType<typeof resolveWaiverWireSettings>["churnPrevention"],
): string {
  switch (value) {
    case "return_to_fa":
      return "Return recently added players to free agency";
    case "block_late_drops":
      return "Prevent drops if there isn't enough time for other owners to claim them";
    default:
      return "None";
  }
}

function transactionLimitsLabel(
  value: ReturnType<typeof resolveTransactionRules>["transactionLimits"],
): string {
  switch (value) {
    case "weekly":
      return "Weekly limit only";
    case "season":
      return "Season limit only";
    case "both":
      return "Both weekly and season limits";
    default:
      return "Unlimited";
  }
}

function processDaysLabel(days: string[]): string {
  if (days.length === 0) {
    return "None";
  }
  return days
    .map(
      (day) =>
        WAIVER_PROCESS_DAY_OPTIONS.find((option) => option.value === day)
          ?.label ?? formatLeagueLabel(day),
    )
    .join(", ");
}

function pickClockLabel(input: {
  draftType: "live" | "email";
  pickTimeLimitSeconds: number;
  pickTimeLimitEnabled: boolean;
}): string {
  if (input.draftType === "email" && !input.pickTimeLimitEnabled) {
    return "Unlimited";
  }
  const pickTime = secondsToPickTime(input.pickTimeLimitSeconds);
  return `${pickTime.value} ${pickTime.unit}`;
}

export function buildLeagueRulesSummary(input: {
  season: LeagueRulesSeasonInput;
}): LeagueRulesSection[] {
  const { season } = input;
  const settings = season.settings;
  const waiverWire = resolveWaiverWireSettings(settings.waiverWire);
  const transactions = resolveTransactionRules(settings.transactionRules);
  const draft = resolveDraftSettings(settings.draft);
  const schedule = resolveScheduleSettings(settings.schedule);
  const playoffs = resolvePlayoffSettings(settings.playoffs);
  const tiebreakers = resolveTiebreakerSettings(settings.tiebreakers);
  const playoffSummary = derivePlayoffSummary({
    enabled: playoffs.enabled,
    playoffTeamCount: season.playoffTeamCount,
    championshipWeek: season.championshipWeek,
    twoWeekChampionship: playoffs.twoWeekChampionship,
  });
  const roster = rosterRequirementsLabel(
    settings,
    season.benchSlots,
    season.irEnabled,
    season.irSlots,
    season.taxiEnabled,
    season.taxiSlots,
  );
  const irStatuses = resolveIrEligibleStatuses(settings.irEligibleStatuses);

  const sections: LeagueRulesSection[] = [
    {
      title: "Rosters",
      rows: [
        {
          label: "Roster Mode",
          value: formatLeagueLabel(season.rosterMode),
        },
        { label: "Roster Requirements", value: roster.requirements },
        { label: "Totals", value: roster.totals },
        {
          label: "Injured Reserve Slots",
          value: season.irEnabled ? String(season.irSlots) : "0",
        },
        ...(season.irEnabled
          ? [
              {
                label: "IR Eligible Designations",
                value: irStatuses.join(", "),
              },
            ]
          : []),
        {
          label: "Taxi Slots",
          value: season.taxiEnabled ? String(season.taxiSlots) : "Off",
        },
      ],
    },
    {
      title: "Schedule",
      rows: [
        {
          label: "Play Each Other",
          value:
            schedule.playEachOtherTimes === 1
              ? "Once"
              : `${schedule.playEachOtherTimes} times`,
        },
        {
          label: "Regular Season Ends",
          value: `Week ${season.regularSeasonEndWeek}`,
        },
      ],
    },
    {
      title: "Playoffs",
      rows: playoffs.enabled
        ? [
            { label: "Playoffs", value: "Enabled" },
            {
              label: "Playoff Teams",
              value: String(season.playoffTeamCount),
            },
            {
              label: "Playoff Weeks",
              value: playoffSummary.playoffWeeksLabel,
            },
            {
              label: "Championship Week",
              value: `Week ${season.championshipWeek}`,
            },
            {
              label: "Two-Week Championship",
              value: yesNo(playoffs.twoWeekChampionship),
            },
            {
              label: "Re-Seed After Each Round",
              value: yesNo(playoffs.reSeedAfterEachRound),
            },
            {
              label: "First-Round Byes",
              value: String(playoffSummary.firstRoundByes),
            },
          ]
        : [{ label: "Playoffs", value: "Disabled" }],
    },
  ];

  if (season.waiversEnabled) {
    sections.push({
      title: "Waiver Claims",
      rows: [
        {
          label: "How Are Claims Resolved",
          value:
            season.waiverType === "faab"
              ? `FAAB ($${season.faabBudget ?? 0})`
              : "Waiver Priority",
        },
        ...(season.waiverType === "faab"
          ? [
              {
                label: "Allow Zero Bids",
                value: yesNo(waiverWire.allowZeroBids),
              },
            ]
          : [
              {
                label: "Reset Order Weekly",
                value: yesNo(waiverWire.resetOrderWeekly),
              },
            ]),
        {
          label: "Who is Placed on Waivers",
          value: waiverPoolLabel(waiverWire.waiverPool),
        },
        {
          label: "Time on Waivers After Drop",
          value: `${waiverWire.dropWaiverHours} Hours`,
        },
        {
          label: "Prevent Waiver Churning",
          value: churnPreventionLabel(waiverWire.churnPrevention),
        },
        {
          label: "Process Claims On",
          value: `${processDaysLabel(waiverWire.processDays)} at ${String(WAIVER_PROCESS_HOUR_UTC).padStart(2, "0")}:00 UTC (claims lock ${String(WAIVER_PROCESS_HOUR_UTC - WAIVER_CLAIM_DEADLINE_OFFSET_HOURS).padStart(2, "0")}:00 UTC)`,
        },
        {
          label: "First-Come-First-Served",
          value:
            waiverWire.fcfsMode === "after_process"
              ? `After process (+${WAIVER_FCFS_OFFSET_HOURS} hours)`
              : "Never (always use waivers)",
        },
      ],
    });
  } else {
    sections.push({
      title: "Waiver Claims",
      rows: [{ label: "Waivers", value: "Off" }],
    });
  }

  sections.push({
    title: "Transaction Rules",
    rows: [
      {
        label: "Trades",
        value: season.tradesEnabled ? "Enabled" : "Off",
      },
      ...(season.tradesEnabled
        ? [
            {
              label: "Trade Review Period",
              value: tradeProcessingLabel(season.tradeProcessing),
            },
            {
              label: "Trade Deadline",
              value: weekOrNone(season.tradeDeadlineWeek),
            },
            {
              label: "Permit Trades After Season Ends",
              value: yesNo(transactions.permitTradesAfterSeason),
            },
            {
              label: "Allow Vetoes",
              value: yesNo(transactions.allowVetoes),
            },
          ]
        : []),
      {
        label: "Add/Drop Deadline",
        value: weekOrNone(transactions.addDropDeadlineWeek),
      },
      {
        label: "Permit Add/Drops After Season Ends",
        value: yesNo(transactions.permitAddDropsAfterSeason),
      },
      {
        label: "Enforce Roster Minimums",
        value: yesNo(transactions.enforceRosterMinimums),
      },
      {
        label: "Free Agents During Preseason (After Draft)",
        value:
          transactions.preseasonFreeAgents === "always_on_waivers"
            ? "Always-on waivers"
            : "Unlocked",
      },
      {
        label: "Prevent Cuts After Game Start",
        value: yesNo(transactions.preventCutsAfterGameStart),
      },
      {
        label: "Transaction Limits",
        value: transactionLimitsLabel(transactions.transactionLimits),
      },
    ],
  });

  sections.push({
    title: "Draft",
    rows: [
      {
        label: "Draft Type",
        value: formatLeagueLabel(season.draftType),
      },
      {
        label: "Draft Style",
        value: formatLeagueLabel(draft.style),
      },
      {
        label: "Draft Date",
        value: formatDraftScheduledAt(season.draftStartAt),
      },
      {
        label: "Time Per Pick",
        value: pickClockLabel({
          draftType: season.draftType,
          pickTimeLimitSeconds: season.pickTimeLimitSeconds,
          pickTimeLimitEnabled: draft.pickTimeLimitEnabled ?? true,
        }),
      },
      {
        label: "Autopick Default",
        value: draft.autoPickEnabled ? "On" : "Off",
      },
    ],
  });

  sections.push({
    title: "Tiebreakers",
    rows: [
      {
        label: "Individual Game Tiebreakers",
        value: tiebreakers.gameTiebreakers
          .map((id, index) => `${index + 1}. ${labelForGameTiebreaker(id)}`)
          .join("\n"),
      },
      {
        label: "Break Regular Season Ties",
        value: yesNo(tiebreakers.breakRegularSeasonTies),
      },
      {
        label: "Power & Playoff Rank Tiebreakers",
        value: tiebreakers.rankTiebreakers
          .map((id, index) => `${index + 1}. ${labelForRankTiebreaker(id)}`)
          .join("\n"),
      },
      {
        label: "Retroactively Apply Official Stat Changes",
        value: yesNo(tiebreakers.applyOfficialStatChanges),
      },
    ],
  });

  return sections;
}
