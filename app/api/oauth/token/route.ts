import { exchangeToken, OAuthError } from "@/lib/mcp/oauth";
import { assertRateLimit, clientIp, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };
  try {
    await assertRateLimit(`mcp:token:${clientIp(request.headers)}`, 60, 60_000);
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
      throw new OAuthError("invalid_request");
    }
    const reader = request.body?.getReader();
    if (!reader) throw new OAuthError("invalid_request");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new OAuthError("invalid_request");
      }
      chunks.push(value);
    }
    const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
    for (const key of form.keys()) {
      if (form.getAll(key).length !== 1) throw new OAuthError("invalid_request");
    }
    let basic: { id: string; secret: string } | undefined;
    const auth = request.headers.get("authorization");
    if (auth) {
      if (!auth.startsWith("Basic ") || form.has("client_secret")) throw new OAuthError("invalid_client", 401);
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const split = decoded.indexOf(":");
      if (split < 0) throw new OAuthError("invalid_client", 401);
      basic = {
        id: decodeURIComponent(decoded.slice(0, split)),
        secret: decodeURIComponent(decoded.slice(split + 1)),
      };
    }
    return Response.json(await exchangeToken(form, basic), { headers });
  } catch (error) {
    if (error instanceof OAuthError) return Response.json({ error: error.code }, { status: error.status, headers });
    if (error instanceof RateLimitError) {
      return Response.json(
        { error: "temporarily_unavailable" },
        { status: 429, headers: { ...headers, "Retry-After": "60" } },
      );
    }
    console.error("hosty oauth token failed", error);
    return Response.json({ error: "server_error" }, { status: 500, headers });
  }
}
