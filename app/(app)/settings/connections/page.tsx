import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { mcpConfig } from "@/lib/mcp/config";

export const metadata = { title: "AI connections" };
export default async function ConnectionsPage() {
  const user = await requireUser("/settings/connections");
  let config: ReturnType<typeof mcpConfig> | undefined;
  try { config = mcpConfig(); } catch { /* Render setup state without exposing configuration. */ }
  const grants = config ? await db.mcpGrant.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() }, accessHash: { not: null } }, select: { id: true, clientId: true, scopes: true, expiresAt: true }, orderBy: { createdAt: "desc" } }) : [];
  async function revoke(form: FormData) {
    "use server";
    const actor = await requireUser();
    const id = form.get("id");
    if (typeof id !== "string") return;
    await db.mcpGrant.updateMany({ where: { id, userId: actor.id }, data: { revokedAt: new Date(), codeHash: null, accessHash: null, refreshHash: null } });
    revalidatePath("/settings/connections");
  }
  return <main className="mx-auto max-w-xl px-4 py-8">
    <h1 className="font-display text-3xl">AI connections</h1>
    <p className="mt-3 text-ink-soft">Use Claude or ChatGPT to read your event briefs and find venues.</p>
    {config ? <div className="my-6 rounded-card border border-line p-5"><p>Add this URL as a custom MCP connector in your AI app:</p><code className="mt-3 block break-all text-sm">{config.resource}</code><p className="mt-3 text-sm text-ink-soft">Use the client ID and credentials supplied by your HostKit administrator, then sign in here to approve access. Client availability depends on your AI app’s plan and settings.</p></div> : <p className="my-6">Your administrator hasn’t enabled AI connections yet.</p>}
    <h2 className="font-display mt-8 text-xl">Connected apps</h2>
    {grants.length === 0 && <p className="mt-3 text-ink-soft">No active connections.</p>}
    {grants.map(g => <div key={g.id} className="mt-4 rounded-card border border-line p-5"><h3 className="font-semibold">{config?.clients.find(c => c.id === g.clientId)?.name ?? "Disconnected client"}</h3><p className="mt-2 text-sm text-ink-soft">{g.scopes.join(", ")} · Expires {g.expiresAt.toISOString().slice(0, 10)}</p><form action={revoke} className="mt-3"><input type="hidden" name="id" value={g.id}/><button className="rounded-lg border border-line px-3 py-2">Disconnect</button></form></div>)}
  </main>;
}
