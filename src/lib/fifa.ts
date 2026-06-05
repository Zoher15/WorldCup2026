/**
 * FIFA uses 3-letter country codes that often differ from the ISO 3166-1
 * alpha-2 codes that flag libraries (flag-icons) expect — e.g. FIFA `GER`
 * is ISO `de`, FIFA `NED` is `nl`. The home nations also have special
 * flag-icons codes (`gb-eng`, `gb-sct`, `gb-wls`).
 *
 * This maps FIFA code -> { iso (for the flag), name (for display) }.
 * Covers confirmed/likely 2026 participants; extend as the field fills out.
 */

export interface TeamInfo {
  /** flag-icons code (ISO 3166-1 alpha-2, lowercase; or gb-eng etc.). */
  iso: string;
  name: string;
}

export const TEAMS: Record<string, TeamInfo> = {
  // Hosts
  USA: { iso: "us", name: "United States" },
  CAN: { iso: "ca", name: "Canada" },
  MEX: { iso: "mx", name: "Mexico" },
  // UEFA
  ENG: { iso: "gb-eng", name: "England" },
  SCO: { iso: "gb-sct", name: "Scotland" },
  WAL: { iso: "gb-wls", name: "Wales" },
  FRA: { iso: "fr", name: "France" },
  GER: { iso: "de", name: "Germany" },
  ESP: { iso: "es", name: "Spain" },
  POR: { iso: "pt", name: "Portugal" },
  NED: { iso: "nl", name: "Netherlands" },
  ITA: { iso: "it", name: "Italy" },
  BEL: { iso: "be", name: "Belgium" },
  CRO: { iso: "hr", name: "Croatia" },
  DEN: { iso: "dk", name: "Denmark" },
  SUI: { iso: "ch", name: "Switzerland" },
  POL: { iso: "pl", name: "Poland" },
  AUT: { iso: "at", name: "Austria" },
  SRB: { iso: "rs", name: "Serbia" },
  UKR: { iso: "ua", name: "Ukraine" },
  TUR: { iso: "tr", name: "Türkiye" },
  SWE: { iso: "se", name: "Sweden" },
  NOR: { iso: "no", name: "Norway" },
  CZE: { iso: "cz", name: "Czechia" },
  // CONMEBOL
  BRA: { iso: "br", name: "Brazil" },
  ARG: { iso: "ar", name: "Argentina" },
  URU: { iso: "uy", name: "Uruguay" },
  COL: { iso: "co", name: "Colombia" },
  ECU: { iso: "ec", name: "Ecuador" },
  PAR: { iso: "py", name: "Paraguay" },
  CHI: { iso: "cl", name: "Chile" },
  PER: { iso: "pe", name: "Peru" },
  // CONCACAF
  CRC: { iso: "cr", name: "Costa Rica" },
  PAN: { iso: "pa", name: "Panama" },
  JAM: { iso: "jm", name: "Jamaica" },
  HON: { iso: "hn", name: "Honduras" },
  // CAF
  MAR: { iso: "ma", name: "Morocco" },
  SEN: { iso: "sn", name: "Senegal" },
  NGA: { iso: "ng", name: "Nigeria" },
  EGY: { iso: "eg", name: "Egypt" },
  GHA: { iso: "gh", name: "Ghana" },
  CMR: { iso: "cm", name: "Cameroon" },
  ALG: { iso: "dz", name: "Algeria" },
  TUN: { iso: "tn", name: "Tunisia" },
  CIV: { iso: "ci", name: "Côte d'Ivoire" },
  RSA: { iso: "za", name: "South Africa" },
  // AFC
  JPN: { iso: "jp", name: "Japan" },
  KOR: { iso: "kr", name: "South Korea" },
  AUS: { iso: "au", name: "Australia" },
  IRN: { iso: "ir", name: "Iran" },
  KSA: { iso: "sa", name: "Saudi Arabia" },
  QAT: { iso: "qa", name: "Qatar" },
  // OFC
  NZL: { iso: "nz", name: "New Zealand" },
};

/** Look up a team by FIFA code (case-insensitive). Returns null if unknown. */
export function teamByCode(code: string | null | undefined): TeamInfo | null {
  if (!code) return null;
  return TEAMS[code.toUpperCase()] ?? null;
}
