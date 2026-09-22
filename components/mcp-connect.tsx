"use client";

import { useState, useTransition } from "react";
import { issueMcpTokenAction } from "@/lib/actions/mcp";
import { claudeMcpConfig, cursorMcpConfig } from "@/lib/mcp/config";
import { CopyButton } from "@/components/copy-button";
import { Button, Field, FormError, Input } from "@/components/ui";

function ConfigBlock({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        <CopyButton text={code} label="Copy" />
      </div>
      <pre className="overflow-x-auto rounded-xl bg-sunk p-4 text-[13px] leading-relaxed text-ink">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * The token and the configs that include it. Generating is a button press,
 * not a page load, so the secret is never sitting in the first HTML response.
 */
export function McpConnect({
  signedIn,
  configUrl,
}: {
  signedIn: boolean;
  /** The URL written into the example configs. Production, unless this page is a preview. */
  configUrl: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cursor = cursorMcpConfig(configUrl, token ?? "YOUR_TOKEN");
  const claude = claudeMcpConfig(configUrl, token ?? "YOUR_TOKEN");

  function generate() {
    startTransition(async () => {
      const result = await issueMcpTokenAction();
      if ("token" in result) {
        setToken(result.token);
        setError(null);
      } else {
        setToken(null);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      {signedIn ? (
        <div className="space-y-4">
          <FormError>{error}</FormError>
          <Button type="button" onClick={generate} disabled={pending}>
            {pending ? "Generating…" : "Generate a token"}
          </Button>
          {token ? (
            <Field
              label="Your token"
              hint="Shown once. It lasts 30 days, and a password reset ends it. Don’t commit it."
            >
              <Input readOnly value={token} spellCheck={false} autoComplete="off" className="font-mono text-sm" />
            </Field>
          ) : (
            <p className="text-[15px] text-ink-soft">
              Generates a token for the account you’re signed in as, and drops it into the configs below.
            </p>
          )}
          {token ? (
            <p className="text-[13px] text-ink-mute" role="status">
              Paste that into Cursor or Claude. Generating another does not revoke this one.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[15px] text-ink-soft">
          Sign in to generate a token here, or exchange your email and password at{" "}
          <code className="text-ink">POST /api/v1/auth/token</code>.
        </p>
      )}

      <ConfigBlock title="Cursor" code={cursor} />
      <ConfigBlock title="Claude Desktop" code={claude} />
    </div>
  );
}
