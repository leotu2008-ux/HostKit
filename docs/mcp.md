# Hosty MCP

One remote endpoint, `POST /api/mcp`, accepts two credentials. They are not interchangeable, and each one advertises its own tools.

| Credential | Who uses it | Tools |
| --- | --- | --- |
| API bearer from `POST /api/v1/auth/token` | Cursor, Claude Desktop with a header, `npm run mcp` | `list_events`, `get_event`, `list_guests` |
| OAuth access token from `POST /api/oauth/token` | Claude and ChatGPT custom connectors | `list_events`, `get_event_brief`, `search_venues` |

An OAuth access token is 43 characters of base64url. The server looks that shape up as an `McpGrant` first. Anything else, including the dotted API bearer, is the existing Hosty token check. A missing or rejected credential is HTTP 401. With `MCP_PUBLIC_ORIGIN` unset, OAuth is off and the bearer path is unchanged.

The install page is [/mcp](https://tryhosty.app/mcp). OAuth grants are listed and revoked at `/settings/connections`.

## Bearer token

Signed-in users point Cursor or Claude at the hosted server and send:

```
POST https://tryhosty.app/api/mcp
Authorization: Bearer <token from POST /api/v1/auth/token>
```

Streamable HTTP, stateless, JSON responses. The same three tools run, still read-only, still scoped to that token, still by calling `/api/v1` rather than the database. `npm run mcp` remains for contributors who want stdio.

### Why the bearer path is a client, not a second door

The server holds nothing but a base URL and a bearer token. Every call goes through `/api/v1/*`, which already checks who is asking and what they may see. Reaching into the database directly would have been less code and a second place for authorisation to go wrong.

So: whatever the token's owner can see, the agent can see. Nothing more. That includes guest lists. The OAuth tools below do not.

### Get a token

```bash
curl -X POST "$HOSTY_URL/api/v1/auth/token" \
  -H 'content-type: application/json' \
  -d '{"email":"you@school.edu","password":"..."}'
```

Tokens expire, and a password reset invalidates every one issued before it. A rejected token is reported as such rather than as a bare 401.

### Run it over stdio

```bash
HOSTY_URL=https://tryhosty.app \
HOSTY_TOKEN=... \
npm run mcp
```

### Wire stdio into Claude Desktop or Claude Code

```json
{
  "mcpServers": {
    "hosty": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp-server.ts"],
      "cwd": "/path/to/Hosty",
      "env": {
        "HOSTY_URL": "https://tryhosty.app",
        "HOSTY_TOKEN": "..."
      }
    }
  }
}
```

### Bearer tools

| tool | what it answers |
|---|---|
| `list_events` | Every night you host, by date, oldest first, undated last; compare dates to today to find what's next. Start here for an id. |
| `get_event` | One event in full: when, where, capacity, published or not. |
| `list_guests` | The list, each person's RSVP and whether they came through the door, plus a summary. |

`list_guests` is the interesting one. The RSVP and the check-in are separate facts. This tool is not offered to OAuth clients.

Every bearer tool is read-only, and there is a test asserting that so a write cannot be added by accident.

## OAuth connector

This lets a signed-in Claude or ChatGPT user read their Hosty events and search venues. It does not turn a consumer AI subscription into a backend API key. The three tools do not invoke Hosty's model, send messages, publish events, or book venues. Venue searches still use the configured Google Places or Apple Maps service and its quota.

OAuth access tokens are not accepted as native API tokens, and native API tokens are not accepted as OAuth grants.

### Included

- Stateless Streamable HTTP at `/api/mcp`, using the official TypeScript SDK and JSON responses. The same route still accepts API bearers.
- `list_events` (paginated), `get_event_brief`, and `search_venues`, only when the grant's scopes allow them.
- User-owned and club-managed events only; no anonymous draft claims, guest identities, native API tokens, or account secrets exposed.
- OAuth authorization-code flow with mandatory S256 PKCE, exact registered redirects, resource binding, and an explicit consent screen.
- One-use five-minute codes, one-hour access tokens, rotating refresh tokens, and a maximum 30-day grant lifetime. Only SHA-256 credential hashes are stored. Password resets and account deletion invalidate access.
- Settings → AI connections to see and revoke connections. Revocation affects both access and refresh tokens.
- Persisted request and search limits. Request and token body size limits. No in-memory session dependency on serverless deployments.

### Deployment setup

1. Deploy with the app's Postgres database. Run `npm ci` and `npx prisma migrate deploy`. The migration adds `McpGrant`; it does not change existing event data.
2. Set `MCP_PUBLIC_ORIGIN` to the exact HTTPS deployment origin, without a trailing slash. It must be the same origin where users sign into Hosty, e.g. `https://tryhosty.app`. Never derive this setting from a request header. Leave it unset to keep OAuth off; the bearer MCP keeps working.
3. Configure one pre-registered OAuth client per AI app through `MCP_CLIENTS_JSON`. Use a new random secret of at least 32 characters for each confidential client. This is a Hosty OAuth client secret, not an Anthropic or OpenAI API key.
4. Register the exact callback URL provided by the AI app's connector configuration. Do not guess it, use wildcards, or use a callback on a domain you do not trust. For ChatGPT, the callback may be specific to that connector. If necessary, create the connector first, copy the callback, update the allowlist, and retry connecting.
5. Keep the existing auth and database settings. Configure Google Places or Apple Maps as documented in [backend.md](backend.md) if you want venue results. Without maps configuration, the tool returns a clear unavailable result.

Example environment value (replace every placeholder):

```dotenv
MCP_PUBLIC_ORIGIN=https://tryhosty.app
MCP_CLIENTS_JSON='[{"id":"hosty-claude","name":"Claude","secret":"REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS","redirectUris":["https://REPLACE_WITH_EXACT_CLAUDE_CALLBACK"]},{"id":"hosty-chatgpt","name":"ChatGPT","secret":"REPLACE_WITH_ANOTHER_RANDOM_SECRET_AT_LEAST_32_CHARS","redirectUris":["https://REPLACE_WITH_EXACT_CHATGPT_CALLBACK"]}]'
```

Public clients can omit `secret`; PKCE is still mandatory. This release uses pre-registered clients, not dynamic client registration or Client ID Metadata Documents. The connecting app must support manually supplied OAuth client credentials.

### Connect in Claude

Add a custom remote connector pointing to `https://tryhosty.app/api/mcp`. In advanced settings enter the matching client ID and secret. Click Connect, sign into Hosty, review the named app and permissions, then allow. Enable the connector in a conversation and ask:

> List my Hosty events, read the brief for my Fall social, and find three venue candidates.

See [Claude's current custom connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). App plan and organization policy determine availability.

### Connect in ChatGPT

Where your account supports custom MCP apps, add the same MCP URL with OAuth and the pre-registered ChatGPT client credentials. Copy the actual callback URL from that connector's management page into its `redirectUris` configuration. Complete the Hosty consent flow. Use the connector in a conversation.

See [ChatGPT custom MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) and [OAuth setup](https://developers.openai.com/apps-sdk/build/auth). This is a private custom connector, not an app-directory submission or embedded UI.

### Endpoints and scopes

| Endpoint | Purpose |
| --- | --- |
| `POST /api/mcp` | MCP requests. OAuth grant if the bearer is one, otherwise the API bearer. |
| `GET /.well-known/oauth-protected-resource/api/mcp` | Resource and authorization-server discovery |
| `GET /.well-known/oauth-protected-resource` | Root discovery alias |
| `GET /.well-known/oauth-authorization-server` | OAuth server metadata |
| `GET /oauth/authorize` | Login and consent |
| `POST /api/oauth/token` | Code exchange and refresh, form encoded |
| `/settings/connections` | User-controlled disconnect |
| `/mcp` | Install page: bearer setup for Cursor, plus where to add Hosty in Claude, ChatGPT and Gemini CLI |

`events:read` permits event listing and brief reads. `venues:search` permits searching in a managed event's city. Authorization requires `resource` equal to the configured MCP URL. Token requests may omit `resource` because the grant is already bound to one resource; if supplied it must match exactly. The token endpoint supports public clients, `client_secret_post`, and `client_secret_basic`.

When OAuth is configured, a 401 carries protected-resource metadata so Claude and ChatGPT can discover the authorization server. The body still names the bearer-token option. Only tools granted by the OAuth token's scopes are advertised on that session. GET is 405 because neither path holds an SSE stream open. DELETE ends a bearer session if the SDK has one; the OAuth connector has no session to delete.

Browser `Origin` values are rejected for OAuth-shaped tokens unless the origin is the Hosty origin or is listed in `MCP_ALLOWED_ORIGINS` (comma separated exact origins). API bearer clients are not origin-gated. Claude and ChatGPT normally call server-to-server with no Origin header.

## What neither path can do

Writes wait on two things. The plan's autonomy decision was drafts only, a human presses every button. And nothing should change state from here until there is an audit log to write alongside it.

When that lands, the shape already agreed for the bearer tools is:

- `draft_event` — create an unpublished event, never published
- `add_guests` — append to a list
- `propose_runsheet` — write rows marked `GENERATED`, leaving `HUMAN` rows alone

Sending, publishing and refunding stay behind a person regardless.

## Validation

```sh
npx prisma generate
npx next typegen
npm run typecheck
npm test
npm run lint
```

`tests/unit/mcp-http.test.ts` covers the bearer path, including a bearer `tools/list` while OAuth is configured. `tests/unit/mcp.test.ts` covers PKCE, exact redirects, scopes, resource binding, credential rotation, expired and revoked grants, and the OAuth tools through the real SDK transport. `tests/unit/mcp-tools.test.ts` covers the five bearer tools.

For database-backed OAuth validation, use an isolated local database and apply migrations, then run:

```sh
DATABASE_URL=postgresql://USER@127.0.0.1:PORT/TEST_DB npx tsx scripts/check-mcp.ts
```

The script accepts only loopback database hosts, creates its own test accounts and events, and removes those records in `finally`. It tests atomic code and refresh replay, database access isolation, and disconnect behavior. It does not contact a maps service.

Live connection in Claude or ChatGPT must be verified after deployment and callback configuration. SDK and local tests do not establish that an external account's connector has been activated.

## Operational notes

- Keep client secrets in deployment secrets; never commit them. Remove a client from configuration to disable all of its credentials, or disconnect a specific grant from Settings. Rotating a client secret blocks refresh with the old secret, but already-issued access tokens remain usable until expiry or revocation.
- Grant expiry is enforced on every use. Schedule cleanup of expired or revoked `McpGrant` rows according to your retention policy; cleanup is not required for expiration enforcement.
- Existing database rate limits use Hosty's fixed-window limiter; enforce tighter infrastructure-level limits if required under high concurrency.
- Venue results do not establish rental prices, capacity, or date availability. The model must confirm those independently. Google and Apple attribution and data-use requirements continue to apply to displaying provider results.
- Source text in briefs and venue data is untrusted content, not instructions.
