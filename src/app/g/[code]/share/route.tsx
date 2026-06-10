import { ImageResponse } from "next/og";
import { getUserId } from "@/lib/identity";
import { getGroupStandings } from "@/lib/groups";
import type { StandingsRow } from "@/lib/standings";

// Needs the Supabase service-role client + request cookies, so it runs on the
// Node runtime (not edge) and is always rendered fresh.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIZE = 1080;

const TAB_LABEL: Record<string, string> = {
  overall: "Overall",
  win: "Win predictor",
  scoreline: "Scoreline",
};

// Render slots place #1 in the middle, #2 left, #3 right.
const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHT = [232, 184, 160]; // indexed by rank (0 = 1st)
const PODIUM_GRADIENT = [
  "linear-gradient(180deg, #ffd23f 0%, #ff5a36 100%)",
  "linear-gradient(180deg, #e7e5e4 0%, #a8a29e 100%)",
  "linear-gradient(180deg, #fdba74 0%, #f97316 100%)",
];
const PODIUM_INK = ["#b45309", "#78716c", "#c2410c"];
const PLACE = ["1st", "2nd", "3rd"];

const truncate = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

function PodiumColumn({ row, idx }: { row: StandingsRow | undefined; idx: number }) {
  if (!row) return <div style={{ display: "flex", width: 280 }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 280 }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: PODIUM_INK[idx] }}>{PLACE[idx]}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: "#292524", maxWidth: 260, marginTop: 4, marginBottom: 10, ...truncate }}>
        {row.displayName}
      </div>
      <div
        style={{
          display: "flex",
          width: 224,
          height: PODIUM_HEIGHT[idx],
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          background: PODIUM_GRADIENT[idx],
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 14,
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.6)",
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 800, color: "#1c1917" }}>{row.points}</div>
      </div>
    </div>
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const userId = await getUserId();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const data = await getGroupStandings(code, userId);
  // Only members may render a group's standings (matches the page's gate).
  if (!data || !data.viewer.isMember) {
    return new Response("Forbidden", { status: 403 });
  }

  const tabParam = new URL(req.url).searchParams.get("tab") ?? "overall";
  const tab = tabParam in TAB_LABEL ? tabParam : "overall";
  const rows = data.standings[tab as keyof typeof data.standings] as StandingsRow[];
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3, 8);

  return new ImageResponse(
    (
      <div
        style={{
          width: SIZE,
          height: SIZE,
          display: "flex",
          flexDirection: "column",
          padding: 64,
          fontFamily: "sans-serif",
          background: "linear-gradient(160deg, #fff8ec 0%, #ffeede 45%, #ffe7f0 100%)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#6b2fb3", maxWidth: 920, ...truncate }}>
            {data.group.name}
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: "#78716c", marginTop: 6 }}>
            World Cup 2026 · {TAB_LABEL[tab]}
          </div>
        </div>

        {/* Podium */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 28, marginTop: 56 }}>
          {PODIUM_ORDER.map((idx, slot) => (
            <PodiumColumn key={slot} row={top3[idx]} idx={idx} />
          ))}
        </div>

        {/* The rest */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 44 }}>
          {rest.map((r, i) => (
            <div
              key={r.userId}
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.65)",
                borderRadius: 22,
                padding: "16px 28px",
              }}
            >
              <div style={{ display: "flex", width: 56, fontSize: 32, fontWeight: 800, color: "#a8a29e" }}>
                {i + 4}
              </div>
              <div style={{ display: "flex", flex: 1, fontSize: 34, fontWeight: 700, color: "#292524", ...truncate }}>
                {r.displayName}
              </div>
              <div style={{ display: "flex", fontSize: 38, fontWeight: 800, color: "#1c1917" }}>{r.points}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "auto" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#a8a29e" }}>worldcup.kachwalas.com</div>
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
