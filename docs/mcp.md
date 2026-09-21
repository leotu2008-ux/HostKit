# HostKit MCP connector

This branch lets a signed-in Claude or ChatGPT user read their HostKit events and search venues through a remote MCP server. It does not turn a consumer AI subscription into a backend API key. The three tools do not invoke HostKit's Anthropic model, send messages, publish events, or book venues. Venue searches still use HostKit's configured Google Places or Apple Maps service and its quota.

## Included

- Stateless Streamable HTTP at `/api/mcp`, using the official TypeScript SDK and JSON responses.
- `list_events` (paginated), `get_event_brief`, and `search_venues`.
- User-owned and club-managed events only; no anonymous draft claims, guest identities, native API tokens, or account secrets exposed.
- OAuth authorization-code flow with mandatory S256 PKCE, exact registered redirects, resource binding, and an explicit HostKit consent screen.
- One-use five-minute codes, one-hour access tokens, rotating refresh tokens, and a maximum 30-day grant lifetime. Only SHA-256 credential hashes are stored. Password resets and account deletion invalidate access.
- Settings → AI connections to see and revoke connections. Revocation affects both access and refresh tokens.
- Persisted request/search limits. Request and token body size limits. No in-memory session dependency on serverless deployments.

## Deployment setup

1. Deploy this branch to a separate test environment with its own Postgres database. Run `npm ci` and `npx prisma migrate deploy`. The migration adds `McpGrant`; it does not change existing event data. Do not run the migration against production just to test the connector.
2. Set `MCP_PUBLIC_ORIGIN` to the exact HTTPS deployment origin, without a trailing slash. It must be the same origin where users sign into HostKit, e.g. `https://your-hostkit.example`. Never derive this setting from a request header.
3. Configure one pre-registered OAuth client per AI app through `MCP_CLIENTS_JSON`. Use a new random secret of at least 32 characters for each confidential client. This is a HostKit OAuth client secret, **not** an Anthropic or OpenAI API key.
4. Register the exact callback URL provided by the AI app's connector configuration. Do not guess it, use wildcards, or use a callback on a domain you do not trust. For ChatGPT, the callback may be specific to that connector. If necessary, create the connector first, copy the callback, update the allowlist, and retry connecting.
5. Keep the existing HostKit auth/database environment settings. Configure Google Places or Apple Maps as documented in the main README if you want venue results. Without maps configuration, the tool returns a clear unavailable result.

Example environment value (replace every placeholder):

```dotenv
MCP_PUBLIC_ORIGIN=https://your-hostkit.example
MCP_CLIENTS_JSON='[{"id":"hostkit-claude","name":"Claude","secret":"REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS","redirectUris":["https://REPLACE_WITH_EXACT_CLAUDE_CALLBACK"]},{"id":"hostkit-chatgpt","name":"ChatGPT","secret":"REPLACE_WITH_ANOTHER_RANDOM_SECRET_AT_LEAST_32_CHARS","redirectUris":["https://REPLACE_WITH_EXACT_CHATGPT_CALLBACK"]}]'
```

Public clients can omit `secret`; PKCE is still mandatory. This release intentionally uses **pre-registered clients**, not dynamic client registration or Client ID Metadata Documents. The connecting app must support manually supplied OAuth client credentials. This avoids accepting arbitrary client registrations or fetching user-supplied metadata URLs.

## Connect in Claude

Add a custom remote connector pointing to `https://your-hostkit.example/api/mcp`. In advanced settings enter the matching client ID and secret. Click Connect, sign into HostKit, review the named app and permissions, then allow. Enable the connector in a conversation and ask:

> List my HostKit events, read the brief for my Fall social, and find three venue candidates.

See [Claude's current custom connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). App plan and organization policy determine availability.

## Connect in ChatGPT

Where your account supports custom MCP apps, add the same MCP URL with OAuth and the pre-registered ChatGPT client credentials. Copy the actual callback URL from that connector's management page into its `redirectUris` configuration. Complete the HostKit consent flow. Use the connector in a conversation.

See [ChatGPT custom MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) and [OAuth setup](https://developers.openai.com/apps-sdk/build/auth). This branch is a private custom connector, not an app-directory submission or embedded UI.

## Endpoints and scopes

| Endpoint | Purpose |
| --- | --- |
| `POST /api/mcp` | Authenticated MCP requests |
| `GET /.well-known/oauth-protected-resource/api/mcp` | Resource/audience and authorization-server discovery |
| `GET /.well-known/oauth-protected-resource` | Root discovery alias |
| `GET /.well-known/oauth-authorization-server` | OAuth server metadata |
| `GET /oauth/authorize` | Login and consent |
| `POST /api/oauth/token` | Code exchange and refresh, form encoded |
| `/settings/connections` | User-controlled disconnect |

`events:read` permits event listing and brief reads. `venues:search` permits searching in a managed event's city. Authorization requires `resource` equal to the configured MCP URL. Token requests may omit `resource` because the grant is already bound to one resource; if supplied it must match exactly. The token endpoint supports public clients, `client_secret_post`, and `client_secret_basic`.

The entire MCP endpoint requires authentication, including initialization and tool discovery. A 401 carries the protected-resource metadata challenge. Only tools granted by the token's scopes are advertised. GET and DELETE return 405 because this connector has no persistent session or unsolicited event stream.

Browser-origin requests are rejected unless the Origin is the HostKit origin or is explicitly listed in `MCP_ALLOWED_ORIGINS` (comma separated exact origins). Claude and ChatGPT normally call server-to-server with no Origin header. This does not implement browser CORS; test using a backend MCP client.

## Validation

```sh
npx prisma generate
npx next typegen
npm run typecheck
npm test
npm run lint
npm run build
```

`tests/unit/mcp.test.ts` tests PKCE, exact redirects, scopes, resource binding, credential rotation, expired/revoked tokens, account version changes, account-filtered tools, and the real SDK transports.

For database-backed validation, use an isolated local database and apply migrations, then run:

```sh
DATABASE_URL=postgresql://USER@127.0.0.1:PORT/TEST_DB npx tsx scripts/check-mcp.ts
```

The script accepts only loopback database hosts, creates its own test accounts/events, and removes those records in `finally`. It tests atomic code/refresh replay, database access isolation, and disconnect behavior. It does not contact a maps service.

Live connection in Claude/ChatGPT must be verified after deployment and callback configuration. SDK and local tests do not establish that an external account's connector has been activated.

## Operational notes

- Keep client secrets in deployment secrets; never commit them. Remove a client from configuration to disable all of its credentials, or disconnect a specific grant from Settings. Rotating a client secret blocks refresh with the old secret, but already-issued access tokens remain usable until expiry or revocation.
- Grant expiry is enforced on every use. Schedule cleanup of expired/revoked `McpGrant` rows according to your retention policy; cleanup isn't required for expiration enforcement.
- Existing database rate limits use HostKit's fixed-window limiter; enforce tighter infrastructure-level limits if required under high concurrency.
- Venue results do not establish rental prices, capacity, or date availability. The model must confirm those independently. Google/Apple attribution and data-use requirements continue to apply to displaying provider results.
- Source text in briefs and venue data is untrusted content, not instructions.
