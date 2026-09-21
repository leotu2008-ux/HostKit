import { redirect } from "next/navigation";
import { authorizationRequest } from "@/lib/mcp/config";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { createAuthorizationCode } from "@/lib/mcp/oauth";
import { assertRateLimit } from "@/lib/rate-limit";

export const metadata = { title: "Connect to HostKit", referrer: "no-referrer" as const };
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  let validated;
  try { validated = authorizationRequest(raw); }
  catch { return <main className="mx-auto max-w-lg p-8"><h1 className="font-display text-2xl">Unable to connect</h1><p className="mt-4">This connection request is invalid or the client is not registered. Return to your AI app and try again.</p></main>; }
  const { params, client, scopes } = validated;
  const query = new URLSearchParams(Object.entries(params).filter((pair): pair is [string, string] => typeof pair[1] === "string"));
  const user = await requireUser(`/oauth/authorize?${query}`);

  async function decide(form: FormData) {
    "use server";
    const current = await requireUser();
    const { params: p, scopes: allowed, config } = authorizationRequest(params);
    const destination = new URL(p.redirect_uri);
    if (p.state !== undefined) destination.searchParams.set("state", p.state);
    if (form.get("decision") !== "allow") {
      destination.searchParams.set("error", "access_denied");
      redirect(destination.toString());
    }
    const account = await db.user.findUnique({ where: { id: current.id }, select: { sessionVersion: true, emailVerifiedAt: true } });
    if (!account?.emailVerifiedAt) throw new Error("Verify your HostKit email before connecting.");
    await assertRateLimit(`mcp:authorize:${current.id}`, 20, 60 * 60_000);
    const code = await createAuthorizationCode({ userId: current.id, sessionVersion: account.sessionVersion, clientId: p.client_id, resource: config.resource, redirectUri: p.redirect_uri, scopes: allowed, codeChallenge: p.code_challenge });
    destination.searchParams.set("code", code);
    redirect(destination.toString());
  }
  return <main className="mx-auto max-w-lg px-6 py-16">
    <p className="font-display text-xl">HostKit</p>
    <h1 className="font-display mt-8 text-3xl">Connect {client.name}?</h1>
    <p className="mt-4 text-ink-soft">Signed in as {user.email}. This app will be able to:</p>
    <ul className="my-5 list-disc space-y-3 pl-5">
      {scopes.includes("events:read") && <li>Read event details and briefs for events you own or manage through a club.</li>}
      {scopes.includes("venues:search") && <li>Search venues in your event cities using HostKit’s maps provider. Queries and city names are sent to that provider.</li>}
    </ul>
    <p className="text-sm text-ink-soft">Access expires after 30 days. Disconnect anytime in Settings → AI connections. This connection cannot publish events, book venues, or send messages.</p>
    <form action={decide} className="mt-7 flex gap-3">
      <button name="decision" value="deny" className="rounded-lg border border-line px-5 py-3">Cancel</button>
      <button name="decision" value="allow" className="rounded-lg bg-ink px-5 py-3 text-white">Allow connection</button>
    </form>
  </main>;
}
