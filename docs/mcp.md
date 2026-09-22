# HostKit as an MCP server

Gives an agent read access to your events, guest lists and campus calendars,
through the same v1 API the iOS client uses.

## Remote (no clone)

Signed-in users point Cursor or Claude at the hosted server. The install
page is [/mcp](https://tryhosty.app/mcp).

```
POST https://tryhosty.app/api/mcp
Authorization: Bearer <token from POST /api/v1/auth/token>
```

Streamable HTTP, stateless, JSON responses. A missing or rejected token is
HTTP 401. The same five tools run, still read-only, still scoped to that
token. `npm run mcp` below remains for contributors who want stdio.

## Why it is a client, not a second door

The server holds nothing but a base URL and a bearer token. Every call goes
through `/api/v1/*`, which already checks who is asking and what they may see.
Reaching into the database directly would have been less code and a second
place for authorisation to go wrong — quietly, and in the direction of showing
someone else's guest list.

So: whatever the token's owner can see, the agent can see. Nothing more.

## Get a token

```bash
curl -X POST "$HOSTKIT_URL/api/v1/auth/token" \
  -H 'content-type: application/json' \
  -d '{"email":"you@school.edu","password":"..."}'
```

Tokens expire, and a password reset invalidates every one issued before it.
A rejected token is reported as such rather than as a bare 401.

## Run it

```bash
HOSTKIT_URL=https://host-kit-one.vercel.app \
HOSTKIT_TOKEN=... \
npm run mcp
```

## Wire it into Claude Desktop or Claude Code

```json
{
  "mcpServers": {
    "hostkit": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp-server.ts"],
      "cwd": "/path/to/HostKit",
      "env": {
        "HOSTKIT_URL": "https://host-kit-one.vercel.app",
        "HOSTKIT_TOKEN": "..."
      }
    }
  }
}
```

## The tools

| tool | what it answers |
|---|---|
| `list_events` | Every event you host, soonest first. Start here for an id. |
| `get_event` | One event in full: when, where, capacity, published or not. |
| `list_guests` | The list, each person's RSVP **and** whether they came through the door, plus a summary. |
| `campus_events` | What a school's own calendars have on. |
| `discover_events` | Public upcoming events, filterable by city or search. |

`list_guests` is the interesting one. The RSVP and the check-in are separate
facts: someone can say yes and not turn up, or turn up having never replied.
Most tools of this kind cannot tell you the difference because most products
do not record it.

## What it deliberately cannot do

Every tool is read-only, and there is a test asserting that so a write cannot
be added by accident.

Writes wait on two things. The plan's autonomy decision was drafts only, a
human presses every button. And nothing should change state from here until
there is an audit log to write alongside it — an agent that reorders a run
sheet is fine, an agent that did so with no record of what it touched is not.

When that lands, the shape is already agreed:

- `draft_event` — create an unpublished event, never published
- `add_guests` — append to a list
- `propose_runsheet` — write rows marked `GENERATED`, leaving `HUMAN` rows alone

Sending, publishing and refunding stay behind a person regardless.

## Not yet exposed

The two things HostKit knows that nothing else does are still in review:
the busy-night warning (#48) and the turnout forecast (#49). Both become
tools the moment they are on `main`, and they are the reason this is worth
pointing an agent at in the first place.
