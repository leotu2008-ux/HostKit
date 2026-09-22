/** The assistants that can add Hosty's MCP server, shown on the landing page
 *  and on /mcp. Logos are the vendors' marks from the MIT-licensed
 *  @lobehub/icons set, in public/llm/. */
export const LLMS = [
  { name: "Claude", logo: "/llm/claude-color.svg", how: "Settings → Connectors → Add custom connector." },
  { name: "ChatGPT", logo: "/llm/openai.svg", how: "Settings → Apps & Connectors, with developer mode on." },
  { name: "Gemini", logo: "/llm/gemini-color.svg", how: "Gemini CLI: add the address under mcpServers." },
] as const;
