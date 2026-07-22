import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export type AuthUserEmail = {
  userId: string;
  email: string;
};

/** Resolve emails from Supabase Auth (`auth.users`) by profile/user id. */
export async function getEmailsForUserIds(
  userIds: Array<string | null | undefined>,
): Promise<AuthUserEmail[]> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) {
    return [];
  }

  const result = await db.execute<{ id: string; email: string }>(sql`
    select id::text as id, email::text as email
    from auth.users
    where id in (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
      and email is not null
      and email <> ''
  `);

  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Array<{ id: string; email: string }> }).rows ?? []);

  return rows
    .filter((row) => Boolean(row.email))
    .map((row) => ({ userId: row.id, email: row.email }));
}
