/** Claude and ChatGPT, shown on the landing page and on /mcp. Cursor connects
 *  with a bearer token and is named in the copy, not in this list. Logos are
 *  the vendors' marks from the MIT-licensed @lobehub/icons set, in public/llm/. */
export const LLMS = [
  { name: "Claude", logo: "/llm/claude-color.svg", how: "Settings → Connectors → Add custom connector." },
  { name: "ChatGPT", logo: "/llm/openai.svg", how: "Settings → Apps & Connectors, with developer mode on." },
] as const;
