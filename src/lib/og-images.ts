import { createAdminClient } from "./supabase/admin";
import { normalizeCode } from "./codes";
import { getGroupStandings } from "./groups";
import { renderLeaderboardPng, OG_RENDER_VERSION } from "./og-render";

/**
 * Pre-rendered leaderboard share images, stored per group (see migration 0005).
 *
 * Generation runs server-side on the Node runtime — during the poll when a
 * result is confirmed, on group creation, and lazily on first view — never on a
 * crawler's request. The /s/<code>/og endpoint only reads these stored bytes,
 * so a link preview can't blank or crash (no rendering at request time).
 * Generation is always best-effort: if it fails, the endpoint falls back to the
 * static default.
 */

export interface StoredOgImage {
  pngBase64: string;
  /** The render version that produced it (migration 0006); a mismatch with the
   *  current OG_RENDER_VERSION tells the endpoint to re-render. */
  renderVersion: number;
}

/** The stored image for a group, or null if none has been rendered yet. */
export async function getGroupOgImage(code: string): Promise<StoredOgImage | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;
  const { data } = await db
    .from("group_og_images")
    .select("png_base64, render_version")
    .eq("group_id", group.id)
    .single();
  if (!data) return null;
  return { pngBase64: data.png_base64, renderVersion: data.render_version ?? 0 };
}

/** Render a single group's board and store it (stamped with the current render
 *  version). Throws on failure — callers decide whether to swallow it. */
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
        render_version: OG_RENDER_VERSION,
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
