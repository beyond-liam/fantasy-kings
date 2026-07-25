import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { leagueMembers, profiles } from "@/db/schema";
import { formatPersonName } from "@/lib/account/person-name";
import { db } from "@/lib/db";
import { extractMentionUsernames } from "@/lib/messages/mentions";
import {
  createNotifications,
  type CreateNotificationInput,
} from "@/lib/notifications/create";

export async function notifyMessageMentions(input: {
  body: string;
  previousBody?: string | null;
  authorUserId: string;
  authorLabel: string;
  leagueId: string;
  leagueSeasonId: string;
  leagueSlug: string;
  threadPublicId: string;
  threadTitle: string;
}) {
  const mentioned = extractMentionUsernames(input.body);
  if (mentioned.length === 0) return;

  const previous = new Set(
    input.previousBody
      ? extractMentionUsernames(input.previousBody)
      : [],
  );
  const newlyMentioned = new Set(
    mentioned.filter((username) => !previous.has(username)),
  );
  if (newlyMentioned.size === 0) return;

  const members = await db
    .select({
      userId: profiles.id,
      username: profiles.username,
    })
    .from(leagueMembers)
    .innerJoin(profiles, eq(leagueMembers.userId, profiles.id))
    .where(
      and(
        eq(leagueMembers.leagueId, input.leagueId),
        isNotNull(profiles.username),
      ),
    );

  const recipients = members.filter((member) => {
    const username = member.username?.trim().toLowerCase();
    return Boolean(username && newlyMentioned.has(username));
  });

  if (recipients.length === 0) return;

  const href = `/league/${input.leagueSlug}/messages/${input.threadPublicId}`;
  const title = "Mentioned you";
  const body = `${input.authorLabel} mentioned you in “${input.threadTitle}”`;

  const rows: CreateNotificationInput[] = recipients.map((member) => ({
    recipientUserId: member.userId,
    leagueSeasonId: input.leagueSeasonId,
    type: "message_mention",
    title,
    body,
    href,
  }));

  await createNotifications(rows);
}

export function authorLabelFromProfile(profile: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  return formatPersonName(profile);
}
