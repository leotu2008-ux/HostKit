import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { tryMcpConfig } from "@/lib/mcp/oauth-config";
import { revokeMcpGrantAction } from "@/lib/actions/mcp";
import { Button, ButtonLink, Card } from "@/components/ui";

export const metadata = { title: "AI connections" };
export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireUser("/settings/connections");
  const config = tryMcpConfig();
  const grants = config
    ? await db.mcpGrant.findMany({
        where: {
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          accessHash: { not: null },
        },
        select: { id: true, clientId: true, scopes: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="font-display text-[30px] leading-tight text-ink">AI connections</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Claude and ChatGPT can read your Hosty event briefs and search venues, after you allow it. Cursor keeps
        using a bearer token.
      </p>

      {config ? (
        <Card className="mt-6 p-5">
          <h2 className="font-display text-lg text-ink">OAuth connector</h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            Add this URL as a custom MCP connector in Claude or ChatGPT. Sign in here to approve access. Use the
            client ID your Hosty administrator registered.
          </p>
          <code className="mt-4 block break-all text-sm text-ink">{config.resource}</code>
          <p className="mt-3 text-sm text-ink-soft">
            Client availability depends on your AI app’s plan and settings. This connection cannot publish events,
            book venues, or send messages.
          </p>
        </Card>
      ) : (
        <Card className="mt-6 p-5">
          <h2 className="font-display text-lg text-ink">OAuth isn’t turned on</h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            An administrator hasn’t set the OAuth connector yet. Cursor can still connect with a bearer token.
          </p>
        </Card>
      )}

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">Bearer token</h2>
        <p className="mt-2 mb-4 text-[15px] text-ink-soft">
          The address, token, and Cursor config live on the Connect an agent page. That path is separate from the
          grants below.
        </p>
        <ButtonLink href="/mcp" variant="secondary">
          Connect an agent
        </ButtonLink>
      </Card>

      <h2 className="font-display mt-8 text-xl text-ink">Connected apps</h2>
      {grants.length === 0 ? <p className="mt-3 text-ink-soft">No active OAuth connections.</p> : null}
      {grants.map((grant) => (
        <Card key={grant.id} className="mt-4 p-5">
          <h3 className="font-semibold text-ink">
            {config?.clients.find((client) => client.id === grant.clientId)?.name ?? "Disconnected client"}
          </h3>
          <p className="mt-2 text-sm text-ink-soft">
            {grant.scopes.join(", ")} · Expires {grant.expiresAt.toISOString().slice(0, 10)}
          </p>
          <form action={revokeMcpGrantAction} className="mt-3">
            <input type="hidden" name="id" value={grant.id} />
            <Button type="submit" variant="secondary">
              Disconnect
            </Button>
          </form>
        </Card>
      ))}

      <p className="mt-6 text-[13px] text-ink-mute">
        <Link href="/settings" className="font-medium text-ink hover:underline">
          Back to settings
        </Link>
      </p>
    </main>
  );
}
