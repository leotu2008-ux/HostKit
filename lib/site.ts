/**
 * Where absolute links point: reset and verification emails, calendar
 * links, the promote page's share URL.
 *
 * `SITE_URL` wins when set, so a link can never be steered by a request's
 * Host header. Without it, the request's own origin (Vercel sets
 * x-forwarded-host itself) — fine for previews and local development.
 */
export function siteOrigin(headers: Headers): string {
  const configured = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const proto = headers.get("x-forwarded-proto") ?? "https";
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
