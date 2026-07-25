export const NOTIFICATIONS_REFRESH_EVENT = "fk:notifications-refresh";

/** Ask the header bell to refetch unread/notifications without a full page reload. */
export function requestNotificationsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}
