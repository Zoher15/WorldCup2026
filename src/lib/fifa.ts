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
}

export const TEAMS: Record<string, TeamInfo> = {
  ALG: { iso: "dz", name: "Algeria" },
  ARG: { iso: "ar", name: "Argentina" },
  AUS: { iso: "au", name: "Australia" },
  AUT: { iso: "at", name: "Austria" },
  BEL: { iso: "be", name: "Belgium" },
  BIH: { iso: "ba", name: "Bosnia & Herzegovina" },
  BRA: { iso: "br", name: "Brazil" },
  CAN: { iso: "ca", name: "Canada" },
  CPV: { iso: "cv", name: "Cape Verde" },
  COL: { iso: "co", name: "Colombia" },
  CRO: { iso: "hr", name: "Croatia" },
  CUW: { iso: "cw", name: "Curaçao" },
  CZE: { iso: "cz", name: "Czechia" },
  COD: { iso: "cd", name: "DR Congo" },
  ECU: { iso: "ec", name: "Ecuador" },
  EGY: { iso: "eg", name: "Egypt" },
  ENG: { iso: "gb-eng", name: "England" },
  FRA: { iso: "fr", name: "France" },
  GER: { iso: "de", name: "Germany" },
  GHA: { iso: "gh", name: "Ghana" },
  HAI: { iso: "ht", name: "Haiti" },
  IRN: { iso: "ir", name: "Iran" },
  IRQ: { iso: "iq", name: "Iraq" },
  CIV: { iso: "ci", name: "Côte d'Ivoire" },
  JPN: { iso: "jp", name: "Japan" },
  JOR: { iso: "jo", name: "Jordan" },
  MEX: { iso: "mx", name: "Mexico" },
  MAR: { iso: "ma", name: "Morocco" },
  NED: { iso: "nl", name: "Netherlands" },
  NZL: { iso: "nz", name: "New Zealand" },
  NOR: { iso: "no", name: "Norway" },
  PAN: { iso: "pa", name: "Panama" },
  PAR: { iso: "py", name: "Paraguay" },
  POR: { iso: "pt", name: "Portugal" },
  QAT: { iso: "qa", name: "Qatar" },
  KSA: { iso: "sa", name: "Saudi Arabia" },
  SCO: { iso: "gb-sct", name: "Scotland" },
  SEN: { iso: "sn", name: "Senegal" },
  RSA: { iso: "za", name: "South Africa" },
  KOR: { iso: "kr", name: "South Korea" },
  ESP: { iso: "es", name: "Spain" },
  SWE: { iso: "se", name: "Sweden" },
  SUI: { iso: "ch", name: "Switzerland" },
  TUN: { iso: "tn", name: "Tunisia" },
  TUR: { iso: "tr", name: "Türkiye" },
  USA: { iso: "us", name: "United States" },
  URU: { iso: "uy", name: "Uruguay" },
  UZB: { iso: "uz", name: "Uzbekistan" },
};

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

/** Resolve a source team name to its FIFA code, or null if not a real team. */
export function codeByName(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_TO_CODE[name] ?? null;
}
