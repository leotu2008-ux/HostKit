import Link from "next/link";
import { headers } from "next/headers";
import { McpConnect } from "@/components/mcp-connect";
import { CopyButton } from "@/components/copy-button";
import { ButtonLink, Card } from "@/components/ui";
import { currentProfile } from "@/lib/session";
import { TOOLS } from "@/lib/mcp/tools";
import { PRODUCTION_MCP_URL, mcpUrl, originFromHeaders } from "@/lib/mcp/config";

export const metadata = {
  title: "Connect an agent",
  description: "Read-only HostKit tools for Cursor and Claude, over a remote MCP URL.",
};

/**
 * How to point Cursor or Claude at HostKit without cloning the repo.
 * Public, so the address is readable before you sign in. The token button
 * is the only part that needs an account.
 */
export default async function McpPage() {
  const [user, headerList] = await Promise.all([currentProfile(), headers()]);
  const here = mcpUrl(originFromHeaders(headerList));
  const onProduction = here === PRODUCTION_MCP_URL;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-8 pb-16 md:px-8 md:pt-14">
      <h1 className="font-display text-[34px] leading-[1.1] text-ink md:text-[46px]">Connect an agent</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
        Cursor and Claude can read the events you host, who is on the list, and what a school already has
        on. They see only your account, and they cannot publish, message anyone, or change a guest. Claude
        and ChatGPT can also connect with OAuth, which is a separate set of tools.
      </p>

      <Card className="mt-8 p-5">
        <h2 className="font-display text-lg text-ink">The address</h2>
        <p className="mt-1 text-[15px] text-ink-soft">
          Paste this into Cursor or Claude as a remote MCP server. Streamable HTTP, JSON answers.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <code className="min-w-0 break-all text-[15px] font-medium text-ink">{PRODUCTION_MCP_URL}</code>
          <CopyButton text={PRODUCTION_MCP_URL} label="Copy URL" />
        </div>
        {onProduction ? null : (
          <p className="mt-4 text-[13px] leading-relaxed text-ink-mute">
            This deployment answers at <span className="font-medium text-ink">{here}</span> — same path,
            this server. The configs below use it so a preview is testable. Production stays{" "}
            {PRODUCTION_MCP_URL}.
          </p>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">A token</h2>
        <p className="mt-1 mb-4 text-[15px] text-ink-soft">
          Every call carries <code className="text-ink">Authorization: Bearer</code>. The token is the same
          one the iOS app uses. It expires, and a password reset invalidates every token issued before it.
        </p>
        <McpConnect signedIn={Boolean(user)} configUrl={onProduction ? PRODUCTION_MCP_URL : here} />
        {user ? null : (
          <div className="mt-4">
            <ButtonLink href="/signin?next=%2Fmcp" variant="secondary">
              Sign in
            </ButtonLink>
          </div>
        )}
        <pre className="mt-4 overflow-x-auto rounded-xl bg-sunk p-4 text-[13px] leading-relaxed text-ink">
          <code>{`curl -X POST https://tryhosty.app/api/v1/auth/token \\
  -H 'content-type: application/json' \\
  -d '{"email":"you@school.edu","password":"..."}'`}</code>
        </pre>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">Claude and ChatGPT</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
          Those apps connect with OAuth instead of a pasted token. You approve them on a consent screen, and
          you can disconnect them under Settings → AI connections. That path does not see guest lists. It can
          list events you manage, read a brief, and search venues.
        </p>
        <ul className="mt-4 divide-y divide-line">
          <li className="py-3">
            <code className="text-[14px] font-semibold text-ink">list_events</code>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Events you own or manage through a club. No guest names.
            </p>
          </li>
          <li className="py-3">
            <code className="text-[14px] font-semibold text-ink">get_event_brief</code>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              The planning brief for one of those events.
            </p>
          </li>
          <li className="py-3">
            <code className="text-[14px] font-semibold text-ink">search_venues</code>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              Venue candidates in that event’s city. It does not book anything.
            </p>
          </li>
        </ul>
        <p className="mt-4 text-[13px] text-ink-mute">
          OAuth has to be turned on for the deployment (<code className="text-ink">MCP_PUBLIC_ORIGIN</code> and
          a registered client). The bearer token above works either way.{" "}
          <Link href="/settings/connections" className="font-medium text-ink hover:underline">
            AI connections
          </Link>
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">What the bearer token can do</h2>
        <p className="mt-1 text-[15px] text-ink-soft">Five tools, all read-only. These are the ones Cursor gets.</p>
        <ul className="mt-4 divide-y divide-line">
          {TOOLS.map((tool) => (
            <li key={tool.name} className="py-3">
              <code className="text-[14px] font-semibold text-ink">{tool.name}</code>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{tool.description}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 p-5">
        <h2 className="font-display text-lg text-ink">Running it yourself</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
          Contributors can still start the same tools over stdio, against any HostKit origin:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-sunk p-4 text-[13px] leading-relaxed text-ink">
          <code>{`HOSTKIT_URL=https://tryhosty.app HOSTKIT_TOKEN=... npm run mcp`}</code>
        </pre>
        <p className="mt-3 text-[13px] text-ink-mute">
          That needs the repo. The address above does not.
        </p>
      </Card>

      <p className="mt-6 text-[13px] text-ink-mute">
        Also in{" "}
        <Link href="/settings" className="font-medium text-ink hover:underline">
          Settings
        </Link>
        .
      </p>
    </main>
  );
}
