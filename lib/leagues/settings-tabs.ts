export const SETTINGS_TAB_VALUES = [
  "league",
  "rules",
  "schedule",
  "draft",
  "commish",
  "danger",
] as const;

export type SettingsTab = (typeof SETTINGS_TAB_VALUES)[number];

export const DEFAULT_SETTINGS_TAB: SettingsTab = "league";

const SETTINGS_TAB_SET = new Set<string>(SETTINGS_TAB_VALUES);

export function parseSettingsTab(raw: string | null | undefined): SettingsTab {
  if (raw && SETTINGS_TAB_SET.has(raw)) {
    return raw as SettingsTab;
  }
  return DEFAULT_SETTINGS_TAB;
}

/** Parent settings URL for a tab (omits query for the default tab). */
export function settingsHref(leagueId: string, tab: SettingsTab = DEFAULT_SETTINGS_TAB) {
  const base = `/league/${leagueId}/settings`;
  if (tab === DEFAULT_SETTINGS_TAB) {
    return base;
  }
  return `${base}?tab=${tab}`;
}
