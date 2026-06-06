/**
 * FIFA uses 3-letter country codes that often differ from the ISO 3166-1
 * alpha-2 codes that flag libraries (flag-icons) expect — e.g. FIFA `GER`
 * is ISO `de`, FIFA `NED` is `nl`. The home nations also have special
 * flag-icons codes (`gb-eng`, `gb-sct`).
 *
 * TEAMS maps FIFA code -> { iso (for the flag), name (for display) }.
 * Covers all 48 teams of the 2026 World Cup.
 */

export interface TeamInfo {
  /** flag-icons code (ISO 3166-1 alpha-2, lowercase; or gb-eng etc.). */
  iso: string;
  name: string;
  /** A representative flag color (hex), used for card ombre backgrounds. */
  color: string;
}

export const TEAMS: Record<string, TeamInfo> = {
  ALG: { iso: "dz", name: "Algeria", color: "#006233" },
  ARG: { iso: "ar", name: "Argentina", color: "#6CACE4" },
  AUS: { iso: "au", name: "Australia", color: "#00247D" },
  AUT: { iso: "at", name: "Austria", color: "#C8102E" },
  BEL: { iso: "be", name: "Belgium", color: "#C8102E" },
  BIH: { iso: "ba", name: "Bosnia & Herzegovina", color: "#002F6C" },
  BRA: { iso: "br", name: "Brazil", color: "#009739" },
  CAN: { iso: "ca", name: "Canada", color: "#D52B1E" },
  CPV: { iso: "cv", name: "Cape Verde", color: "#003893" },
  COL: { iso: "co", name: "Colombia", color: "#FCD116" },
  CRO: { iso: "hr", name: "Croatia", color: "#D81E05" },
  CUW: { iso: "cw", name: "Curaçao", color: "#002B7F" },
  CZE: { iso: "cz", name: "Czechia", color: "#11457E" },
  COD: { iso: "cd", name: "DR Congo", color: "#2EA2DF" },
  ECU: { iso: "ec", name: "Ecuador", color: "#FFDD00" },
  EGY: { iso: "eg", name: "Egypt", color: "#CE1126" },
  ENG: { iso: "gb-eng", name: "England", color: "#CE1124" },
  FRA: { iso: "fr", name: "France", color: "#0055A4" },
  GER: { iso: "de", name: "Germany", color: "#DD0000" },
  GHA: { iso: "gh", name: "Ghana", color: "#006B3F" },
  HAI: { iso: "ht", name: "Haiti", color: "#00209F" },
  IRN: { iso: "ir", name: "Iran", color: "#239F40" },
  IRQ: { iso: "iq", name: "Iraq", color: "#CE1126" },
  CIV: { iso: "ci", name: "Côte d'Ivoire", color: "#F77F00" },
  JPN: { iso: "jp", name: "Japan", color: "#BC002D" },
  JOR: { iso: "jo", name: "Jordan", color: "#CE1126" },
  MEX: { iso: "mx", name: "Mexico", color: "#006847" },
  MAR: { iso: "ma", name: "Morocco", color: "#C1272D" },
  NED: { iso: "nl", name: "Netherlands", color: "#FF6900" },
  NZL: { iso: "nz", name: "New Zealand", color: "#00247D" },
  NOR: { iso: "no", name: "Norway", color: "#BA0C2F" },
  PAN: { iso: "pa", name: "Panama", color: "#005293" },
  PAR: { iso: "py", name: "Paraguay", color: "#D52B1E" },
  POR: { iso: "pt", name: "Portugal", color: "#046A38" },
  QAT: { iso: "qa", name: "Qatar", color: "#8A1538" },
  KSA: { iso: "sa", name: "Saudi Arabia", color: "#006C35" },
  SCO: { iso: "gb-sct", name: "Scotland", color: "#005EB8" },
  SEN: { iso: "sn", name: "Senegal", color: "#00853F" },
  RSA: { iso: "za", name: "South Africa", color: "#007A4D" },
  KOR: { iso: "kr", name: "South Korea", color: "#003478" },
  ESP: { iso: "es", name: "Spain", color: "#AA151B" },
  SWE: { iso: "se", name: "Sweden", color: "#006AA7" },
  SUI: { iso: "ch", name: "Switzerland", color: "#D52B1E" },
  TUN: { iso: "tn", name: "Tunisia", color: "#E70013" },
  TUR: { iso: "tr", name: "Türkiye", color: "#E30A17" },
  USA: { iso: "us", name: "United States", color: "#0A3161" },
  URU: { iso: "uy", name: "Uruguay", color: "#0038A8" },
  UZB: { iso: "uz", name: "Uzbekistan", color: "#0099B5" },
};

/** Neutral colour for unknown teams / knockout placeholders. */
const NEUTRAL_COLOR = "#d6d3d1";

/** A representative flag color for a team code, or a neutral grey if unknown. */
export function teamColor(code: string | null | undefined): string {
  return teamByCode(code)?.color ?? NEUTRAL_COLOR;
}

/**
 * Maps the team names used by the openfootball source data to FIFA codes
 * (includes name variants like "Czech Republic" -> CZE, "Turkey" -> TUR).
 */
export const NAME_TO_CODE: Record<string, string> = {
  Algeria: "ALG",
  Argentina: "ARG",
  Australia: "AUS",
  Austria: "AUT",
  Belgium: "BEL",
  "Bosnia & Herzegovina": "BIH",
  Brazil: "BRA",
  Canada: "CAN",
  "Cape Verde": "CPV",
  Colombia: "COL",
  Croatia: "CRO",
  Curaçao: "CUW",
  "Czech Republic": "CZE",
  "DR Congo": "COD",
  Ecuador: "ECU",
  Egypt: "EGY",
  England: "ENG",
  France: "FRA",
  Germany: "GER",
  Ghana: "GHA",
  Haiti: "HAI",
  Iran: "IRN",
  Iraq: "IRQ",
  "Ivory Coast": "CIV",
  Japan: "JPN",
  Jordan: "JOR",
  Mexico: "MEX",
  Morocco: "MAR",
  Netherlands: "NED",
  "New Zealand": "NZL",
  Norway: "NOR",
  Panama: "PAN",
  Paraguay: "PAR",
  Portugal: "POR",
  Qatar: "QAT",
  "Saudi Arabia": "KSA",
  Scotland: "SCO",
  Senegal: "SEN",
  "South Africa": "RSA",
  "South Korea": "KOR",
  Spain: "ESP",
  Sweden: "SWE",
  Switzerland: "SUI",
  Tunisia: "TUN",
  Turkey: "TUR",
  USA: "USA",
  Uruguay: "URU",
  Uzbekistan: "UZB",
};

/** Look up a team by FIFA code (case-insensitive). Returns null if unknown. */
export function teamByCode(code: string | null | undefined): TeamInfo | null {
  if (!code) return null;
  return TEAMS[code.toUpperCase()] ?? null;
}

/**
 * Display name for a team slot: the known team's name, else a provided label
 * (e.g. a knockout placeholder like "Winner Group A"), else a fallback.
 */
export function teamLabel(
  code: string | null | undefined,
  label?: string | null,
  fallback = "To be decided",
): string {
  return teamByCode(code)?.name ?? label ?? fallback;
}

/**
 * Score providers use their own team-name spellings, different from both FIFA
 * codes and the openfootball names (e.g. "Korea Republic", "IR Iran",
 * "Czech Republic"). These aliases (normalized: lowercase, accent-free) map
 * those to our FIFA codes.
 */
const PROVIDER_ALIASES: Record<string, string> = {
  "korea republic": "KOR",
  "south korea": "KOR",
  usa: "USA",
  "united states": "USA",
  "ir iran": "IRN",
  iran: "IRN",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "czech republic": "CZE",
  czechia: "CZE",
  turkey: "TUR",
  turkiye: "TUR",
  "cape verde islands": "CPV",
  "cape verde": "CPV",
  "dr congo": "COD",
  "congo dr": "COD",
  "bosnia and herzegovina": "BIH",
  "bosnia herzegovina": "BIH",
  curacao: "CUW",
  "saudi arabia": "KSA",
  "cabo verde": "CPV",
};

function normalizeName(name: string): string {
  // NFD splits accented letters into base + combining marks; [^a-z ] then drops
  // the marks (and punctuation), so "Côte d'Ivoire" -> "cote divoire".
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * normalized team name -> FIFA code, built once. Covers display names (TEAMS),
 * the openfootball spellings (NAME_TO_CODE), and provider aliases. NAME_TO_CODE
 * and aliases are applied last so they win any normalized-key collisions.
 */
const NORMALIZED_TO_CODE: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [code, info] of Object.entries(TEAMS)) {
    map[normalizeName(info.name)] = code;
  }
  for (const [name, code] of Object.entries(NAME_TO_CODE)) {
    map[normalizeName(name)] = code;
  }
  for (const [name, code] of Object.entries(PROVIDER_ALIASES)) {
    map[name] = code; // alias keys are already normalized
  }
  return map;
})();

/** Resolve any provider's team name to our FIFA code, or null if unknown. */
function resolveTeamName(name: string | null | undefined): string | null {
  if (!name) return null;
  return NORMALIZED_TO_CODE[normalizeName(name)] ?? null;
}

/**
 * Resolve a football-data.org team to our FIFA code. Their `tla` is usually a
 * FIFA code already, so prefer it; fall back to resolving the name.
 */
export function resolveFdTeam(
  tla: string | null | undefined,
  name: string | null | undefined,
): string | null {
  if (tla && teamByCode(tla)) return tla.toUpperCase();
  return resolveTeamName(name);
}
