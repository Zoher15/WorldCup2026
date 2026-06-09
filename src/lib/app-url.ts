/** Public base URL of the app, for absolute links in emails and share links. */
export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://worldcup.kachwalas.com";
}
