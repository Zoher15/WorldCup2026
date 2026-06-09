/**
 * Where to send users after auth and form flows. `next` params come from the
 * URL/forms, so only same-origin relative paths are honored; anything else
 * (absolute URLs, missing values) falls back to the home page.
 */
export function safeNextPath(param: string | null | undefined): string {
  return param && param.startsWith("/") ? param : "/";
}
