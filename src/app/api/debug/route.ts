import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUser, createGroupWithOwner } from "@/lib/groups";

/**
 * Temporary diagnostic endpoint. API route responses are NOT subject to the
 * production redaction that hides server-component render errors, so this
 * surfaces the real cause of backend failures (missing env, missing tables,
 * RLS/permission errors). Returns no secrets — only booleans, row counts, and
 * error messages. Remove once the issue is diagnosed.
 */
export const dynamic = "force-dynamic";

const TABLES = [
  "users",
  "groups",
  "memberships",
  "matches",
  "predictions",
  "match_scores",
] as const;

export async function GET(request: Request) {
  const report: Record<string, unknown> = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
    },
  };

  try {
    const db = createAdminClient();
    const tables: Record<string, unknown> = {};
    for (const table of TABLES) {
      const { error, count } = await db
        .from(table)
        .select("*", { count: "exact", head: true });
      tables[table] = error
        ? { error: error.message, code: error.code }
        : { rows: count };
    }
    report.tables = tables;

    // Exercise the exact read path the group page uses, to catch a throw there.
    try {
      const { error } = await db
        .from("matches")
        .select(
          "id, kickoff_at, stage, home_goals, away_goals, advanced_code, result_confirmed",
        )
        .eq("result_confirmed", true)
        .limit(1);
      report.matchesReadPath = error
        ? { error: error.message, code: error.code }
        : "ok";
    } catch (e) {
      report.matchesReadPath = {
        threw: e instanceof Error ? e.message : String(e),
      };
    }
  } catch (e) {
    report.fatal = e instanceof Error ? e.message : String(e);
  }

  // Opt-in write test (?write=1): runs the exact create-group DB path the
  // server action uses, WITHOUT the cookie write, then cleans up. Isolates
  // whether the failure is the DB write or the cookie call in the action.
  if (new URL(request.url).searchParams.get("write") === "1") {
    try {
      const user = await ensureUser(null, "DEBUG_TEST_USER");
      const { code } = await createGroupWithOwner({
        userId: user.userId,
        groupName: "DEBUG_TEST_GROUP",
        displayName: "DEBUG_TEST",
        lateJoinPolicy: "carry_over",
      });
      // Clean up: deleting the group cascades to its membership; then the user.
      const db = createAdminClient();
      const delGroup = await db.from("groups").delete().eq("code", code);
      const delUser = await db.from("users").delete().eq("id", user.userId);
      report.writeTest = {
        ok: true,
        createdUserId: user.userId,
        createdGroupCode: code,
        cleanup: {
          group: delGroup.error?.message ?? "deleted",
          user: delUser.error?.message ?? "deleted",
        },
      };
    } catch (e) {
      report.writeTest = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      };
    }
  }

  return NextResponse.json(report, { status: 200 });
}
