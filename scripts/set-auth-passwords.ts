/**
 * One-off admin helper: set the same password on every auth user (or a filter).
 *
 * Passwords are hashed by Supabase Auth — do not write plaintext into auth.users.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=… SET_PASSWORD='your-temp-password' pnpm auth:set-passwords
 *
 * Optional:
 *   SET_PASSWORD_EMAILS=a@x.com,b@y.com  — only these emails (default: all users)
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.SET_PASSWORD;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (service role from Supabase → Settings → API).",
    );
  }
  if (!password || password.length < 8) {
    throw new Error(
      "Set SET_PASSWORD to a temporary password (min 8 characters). Example:\n  SET_PASSWORD='TempPass123' pnpm auth:set-passwords",
    );
  }

  const emailFilter = (process.env.SET_PASSWORD_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const filterSet = emailFilter.length > 0 ? new Set(emailFilter) : null;

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: listData,
    error: listError,
  } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });

  if (listError) {
    throw new Error(`listUsers failed: ${listError.message}`);
  }

  const users = (listData.users ?? []).filter((user) => {
    const email = user.email?.toLowerCase();
    if (!email) return false;
    if (!filterSet) return true;
    return filterSet.has(email);
  });

  if (users.length === 0) {
    console.log("No matching auth users found.");
    return;
  }

  console.log(`Updating password for ${users.length} user(s)…`);

  for (const user of users) {
    const email = user.email ?? user.id;
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error(`  ✗ ${email}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${email}`);
  }

  console.log("Done. Testers can log in with email + the password you set.");
  console.log("Ask them to change it under Settings → Change Password.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
