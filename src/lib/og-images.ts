import { createAdminClient } from "./supabase/admin";
import { normalizeCode } from "./codes";
import { getGroupStandings } from "./groups";
import { renderLeaderboardPng } from "./og-render";

/**
 * Pre-rendered leaderboard share images, stored per group (see migration 0005).
 *
 * Generation runs server-side on the Node runtime — during the poll when a
 * result is confirmed, and on group creation — never on a crawler's request.
 * The /s/<code>/og endpoint only reads these stored bytes, so a link preview
 * can't blank or crash (no rendering at request time). Generation is always
 * best-effort: if it fails, the endpoint falls back to the static default.
 */

/** The stored base64 PNG for a group, or null if none has been rendered yet. */
export async function getGroupOgImage(code: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;
  const { data } = await db
    .from("group_og_images")
    .select("png_base64")
    .eq("group_id", group.id)
    .single();
  return data?.png_base64 ?? null;
}

/** Render a single group's podium and store it. Throws on failure (callers
 *  decide whether to swallow it — the poll and group-creation paths do). */
export async function regenerateGroupOgImage(code: string): Promise<void> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, name")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return;

  const data = await getGroupStandings(code);
  const png = await renderLeaderboardPng(
    group.name,
    data?.standings.overall ?? [],
  );
  await db
    .from("group_og_images")
    .upsert(
      {
        group_id: group.id,
        png_base64: Buffer.from(png).toString("base64"),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "group_id" },
    );
}

/** Regenerate every group's image (used after the poll confirms a result, the
 *  only moment standings move). Best-effort per group: one failure doesn't
 *  abort the rest. Returns how many were regenerated. */
export async function regenerateAllGroupOgImages(): Promise<number> {
  const db = createAdminClient();
  const { data: groups } = await db.from("groups").select("code");
  let done = 0;
  for (const g of groups ?? []) {
    try {
      await regenerateGroupOgImage(g.code);
      done++;
    } catch {
      // skip this group; the endpoint still serves its previous (or default) image
    }
  }
  return done;
}
