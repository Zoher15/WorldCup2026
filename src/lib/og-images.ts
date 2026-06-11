import { createAdminClient } from "./supabase/admin";
import { normalizeCode } from "./codes";
import { getGroupStandings } from "./groups";
import type { StandingsRow } from "./standings";
import {
  renderLeaderboardPng,
  ogContentHash,
  OG_RENDER_VERSION,
} from "./og-render";

/**
 * Pre-rendered leaderboard share images, stored per group (migration 0005),
 * content-addressed (migration 0007).
 *
 * Rendering runs server-side on the Node runtime — never on a crawler's request.
 * The /s/<code>/og endpoint calls ensureGroupOgImage, which recomputes a hash of
 * the live standings (ogContentHash) and re-renders ONLY when that hash — or the
 * layout version — differs from what's stored. So the image self-heals on any
 * change to the board (a join, a rename, a confirmed result) without enumerating
 * those events, and an unchanged board costs a few light queries, no PNG render.
 * Everything is best-effort: a render failure keeps serving the previous bytes,
 * and the endpoint falls back to the static default if there are none.
 */

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface StoredOgImage {
  pngBase64: string;
  /** The layout version that produced it (migration 0006). */
  renderVersion: number;
  /** The content fingerprint that produced it (migration 0007); null when the
   *  column isn't migrated yet, which forces a re-render on the next view. */
  contentHash: string | null;
}

/** Read the stored row for a group id, tolerating un-migrated columns. */
async function readStored(
  db: SupabaseAdmin,
  groupId: string,
): Promise<StoredOgImage | null> {
  const full = await db
    .from("group_og_images")
    .select("png_base64, render_version, content_hash")
    .eq("group_id", groupId)
    .single();
  if (!full.error && full.data) {
    return {
      pngBase64: full.data.png_base64,
      renderVersion: full.data.render_version ?? 0,
      contentHash: full.data.content_hash ?? null,
    };
  }
  // content_hash (0007) and/or render_version (0006) may not be migrated yet —
  // read the bytes alone. renderVersion 0 / contentHash null force a re-render,
  // so the endpoint still serves a correct, current image (just uncached).
  const legacy = await db
    .from("group_og_images")
    .select("png_base64")
    .eq("group_id", groupId)
    .single();
  return legacy.data
    ? { pngBase64: legacy.data.png_base64, renderVersion: 0, contentHash: null }
    : null;
}

/** The stored image for a group, or null if none has been rendered yet. */
export async function getGroupOgImage(
  code: string,
): Promise<StoredOgImage | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;
  return readStored(db, group.id);
}

/** Render the overall board and store the PNG, stamped with the current layout
 *  version and content hash. Tolerates un-migrated columns by retrying with
 *  progressively fewer of them. Returns the base64 PNG. */
async function storeRender(
  db: SupabaseAdmin,
  groupId: string,
  groupName: string,
  overall: StandingsRow[],
  hash: string,
): Promise<string> {
  const png = await renderLeaderboardPng(groupName, overall);
  const pngBase64 = Buffer.from(png).toString("base64");
  const base = {
    group_id: groupId,
    png_base64: pngBase64,
    updated_at: new Date().toISOString(),
  };

  let res = await db
    .from("group_og_images")
    .upsert(
      { ...base, render_version: OG_RENDER_VERSION, content_hash: hash },
      { onConflict: "group_id" },
    );
  if (res.error) {
    // content_hash column absent (0007 not run) — store with the version only.
    res = await db
      .from("group_og_images")
      .upsert(
        { ...base, render_version: OG_RENDER_VERSION },
        { onConflict: "group_id" },
      );
  }
  if (res.error) {
    // render_version absent too (0006 not run) — store just the bytes.
    await db.from("group_og_images").upsert(base, { onConflict: "group_id" });
  }
  return pngBase64;
}

/**
 * Ensure the stored image matches the live leaderboard, rendering only on a
 * change. Cheap when nothing moved (a hash compare over a few queries, no PNG
 * render). Best-effort: on a render failure it returns the previously stored
 * image (stale but valid) rather than throwing. Returns null only when the
 * group doesn't exist.
 */
export async function ensureGroupOgImage(
  code: string,
): Promise<StoredOgImage | null> {
  const db = createAdminClient();
  const { data: group } = await db
    .from("groups")
    .select("id, name")
    .eq("code", normalizeCode(code))
    .single();
  if (!group) return null;

  const data = await getGroupStandings(code);
  const overall = data?.standings.overall ?? [];
  const hash = ogContentHash(group.name, overall);

  const stored = await readStored(db, group.id);
  if (
    stored &&
    stored.renderVersion === OG_RENDER_VERSION &&
    stored.contentHash === hash
  ) {
    return stored; // unchanged — no render
  }

  try {
    const pngBase64 = await storeRender(db, group.id, group.name, overall, hash);
    return { pngBase64, renderVersion: OG_RENDER_VERSION, contentHash: hash };
  } catch {
    // Keep serving whatever we had; the endpoint falls back to the default if
    // there's nothing stored.
    return stored;
  }
}

/** Ensure every group's image is current. Used after the poll confirms a result
 *  (the moment standings move) and is safe to call broadly — groups whose board
 *  didn't change short-circuit on the hash without re-rendering. Returns how many
 *  were rendered (changed); best-effort per group. */
export async function regenerateAllGroupOgImages(): Promise<number> {
  const db = createAdminClient();
  const { data: groups } = await db.from("groups").select("code");
  let rendered = 0;
  for (const g of groups ?? []) {
    try {
      const before = await getGroupOgImage(g.code);
      const after = await ensureGroupOgImage(g.code);
      if (after && after.pngBase64 !== before?.pngBase64) rendered++;
    } catch {
      // skip this group; the endpoint still serves its previous (or default) image
    }
  }
  return rendered;
}
