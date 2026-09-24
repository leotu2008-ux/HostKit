import Image from "next/image";
import { WaveText } from "@/components/wave-text";
import { LLMS } from "@/lib/llms";
import { ButtonLink } from "@/components/ui";

/** What a connected agent can read — the host's own work. Claude and ChatGPT
 *  (OAuth) get list_events, get_event_brief and search_venues; Cursor (bearer
 *  token) gets list_events and list_guests. */
const READS = ["Events", "Briefs", "Guests", "Venues"] as const;

/**
 * The first scroll section under the landing hero.
 */
export function ConnectAgentSection() {
  return (
    <section className="py-16 md:py-24">
      <p className="font-event text-[12px] tracking-[0.14em] text-ink-mute uppercase">
        Claude, ChatGPT and Cursor
      </p>
      <h2 className="font-display mt-3 block max-w-2xl text-[28px] leading-tight text-ink md:text-[40px]">
        <WaveText text="Connect an agent" />
      </h2>
      <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-soft">
        Claude and ChatGPT can read your events and briefs and search venues.
        Cursor can read your events and guest lists.
      </p>

      <ul className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {READS.map((item) => (
          <li
            key={item}
            className="rounded-card border border-line bg-surface px-4 py-4 text-[15px] font-medium text-ink"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-[15px] font-medium text-ink">Add your preferred LLM</p>
      <ul className="mt-3 flex flex-wrap gap-2.5">
        {LLMS.map((llm) => (
          <li
            key={llm.name}
            className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-2 pr-4 pl-2.5 text-[15px] font-medium text-ink"
          >
            <Image src={llm.logo} alt="" width={24} height={24} unoptimized className="size-6" />
            {llm.name}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <ButtonLink
          href="/mcp"
          variant="secondary"
          size="lg"
          className="max-w-full whitespace-normal text-center"
        >
          Endpoint, token generation, and setup config
          <span aria-hidden>→</span>
        </ButtonLink>
      </div>
    </section>
  );
}
