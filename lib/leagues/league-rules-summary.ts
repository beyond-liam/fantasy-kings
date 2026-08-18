import type { LeagueSeasonSettings } from "@/db/schema/league-seasons";
import { secondsToPickTime } from "@/lib/leagues/defaults";
import { resolveSeasonDraftRounds } from "@/lib/leagues/draft/board";
import { resolveDraftSettings } from "@/lib/leagues/draft-settings";
import { resolveDynastySettings } from "@/lib/leagues/dynasty-settings";
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
  resolveTaxiMaxYearsExp,
  taxiMaxYearsLabel,
} from "@/lib/leagues/taxi-eligibility";
import {
  resolveTransactionRules,
  TRADE_PROCESSING_OPTIONS,
} from "@/lib/leagues/transaction-rules";
import {
  resolveWaiverWireSettings,
  WAIVER_PROCESS_DAY_OPTIONS,
} from "@/lib/leagues/waiver-wire";
import {
  formatWaiverProcessHourUk,
  WAIVER_CLAIM_DEADLINE_OFFSET_HOURS,
  WAIVER_FCFS_OFFSET_HOURS,
  WAIVER_PROCESS_HOUR_UTC,
} from "@/lib/leagues/waivers/calendar";

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

function transactionLimitsLabel(
  rules: ReturnType<typeof resolveTransactionRules>,
): string {
  switch (rules.transactionLimits) {
    case "weekly":
      return `${rules.transactionWeeklyMax} per week`;
    case "season":
      return `${rules.transactionSeasonMax} per season`;
    case "both":
      return `${rules.transactionWeeklyMax} per week, ${rules.transactionSeasonMax} per season`;
    default:
      return "Unlimited";
  }
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
  return `${pickTime.value} ${pickTime.unit} · autodraft on expiry`;
}

export function buildLeagueRulesSummary(input: {
  season: LeagueRulesSeasonInput;
}): LeagueRulesSection[] {
  const { season } = input;
  const settings = season.settings;
  const waiverWire = resolveWaiverWireSettings(
    settings.waiverWire,
    settings.transactionRules?.preseasonFreeAgents,
  );
  const transactions = resolveTransactionRules(settings.transactionRules);
  const draft = resolveDraftSettings(settings.draft);
  const dynasty = settings.dynasty
    ? resolveDynastySettings(settings.dynasty)
    : null;
  const draftRounds = resolveSeasonDraftRounds({
    rosterSlots: settings.rosterSlots,
    benchSlots: season.benchSlots,
    draft: settings.draft,
    dynasty: settings.dynasty,
  });
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
        ...(season.taxiEnabled
          ? [
              {
                label: "Taxi Eligibility",
                value: taxiMaxYearsLabel(
                  resolveTaxiMaxYearsExp(settings.taxiMaxYearsExp),
                ),
              },
              {
                label: "Prevent Taxi Re-add After Activation",
                value: yesNo(
                  settings.taxiPreventReaddAfterActivation === true,
                ),
              },
            ]
          : []),
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
          label: "Daily Drop Processing",
          value: yesNo(waiverWire.dailyDropProcessing),
        },
        {
          label: "Time on Waivers After Drop",
          value: `${waiverWire.dropWaiverHours} Hours`,
        },
        {
          label: "Process Claims On",
          value: waiverWire.dailyDropProcessing
            ? `Daily, plus ${processDaysLabel(waiverWire.processDays)} weekly for players who have already played, at ${formatWaiverProcessHourUk(WAIVER_PROCESS_HOUR_UTC)}`
            : `${processDaysLabel(waiverWire.processDays)} at ${formatWaiverProcessHourUk(WAIVER_PROCESS_HOUR_UTC)} (claims lock ${formatWaiverProcessHourUk(WAIVER_PROCESS_HOUR_UTC - WAIVER_CLAIM_DEADLINE_OFFSET_HOURS)})`,
        },
        {
          label: "First-Come-First-Served",
          value:
            waiverWire.fcfsMode === "after_process"
              ? `After end-of-week process (+${WAIVER_FCFS_OFFSET_HOURS} hours)`
              : "Never (always use waivers)",
        },
        {
          label: "Preseason Waivers",
          value: yesNo(waiverWire.preseasonWaivers),
        },
      ],
    });
  } else {
    sections.push({
      title: "Waiver Claims",
      rows: [
        { label: "Waivers", value: "Off" },
        {
          label: "Preseason Waivers",
          value: yesNo(waiverWire.preseasonWaivers),
        },
      ],
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
        label: "Prevent Cuts After Game Start",
        value: yesNo(transactions.preventCutsAfterGameStart),
      },
      {
        label: "Transaction Limits",
        value: transactionLimitsLabel(transactions),
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
        label: "Draft Rounds",
        value: String(draftRounds),
      },
      ...(dynasty
        ? [
            {
              label: "Draft Player Pool",
              value:
                dynasty.draftPlayerPool === "all"
                  ? "All available players"
                  : "Rookies only",
            },
          ]
        : []),
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
      ...(draft.pauseWindowEnabled &&
      draft.pauseWindowStart &&
      draft.pauseWindowEnd &&
      season.draftType === "email" &&
      (draft.pickTimeLimitEnabled ?? true) &&
      season.pickTimeLimitSeconds > 0
        ? [
            {
              label: "Daily Pause Window",
              value: `${draft.pauseWindowStart}–${draft.pauseWindowEnd} UK`,
            },
          ]
        : []),
      ...(draft.forceAutopickAfterTwoExpires &&
      (season.draftType === "live" ||
        ((draft.pickTimeLimitEnabled ?? true) &&
          season.pickTimeLimitSeconds > 0))
        ? [
            {
              label: "Two missed picks",
              value: "Force autopick until back online",
            },
          ]
        : []),
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
        label: "Allow Official Score Corrections",
        value: yesNo(tiebreakers.applyOfficialStatChanges),
      },
    ],
  });

  return sections;
}
